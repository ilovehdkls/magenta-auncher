const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const os = require('os');
const { extractNatives } = require('../scripts/extract-natives');
const { nutprotDir, runProtectionCheck, startProtectionLoop } = require('./protection');
const { isStubFile } = require('./client-install');
const { runPreparePipeline, finishLaunching } = require('./launch-pipeline');
const {
  WINDOW_W,
  WINDOW_H,
  applyWindowLock,
  registerScreenshotBlock,
  unregisterScreenshotBlock
} = require('./window-lock');

function launcherAssetsDir() {
  const local = path.join(appRoot(), 'assets');
  if (fs.existsSync(local)) return local;
  return bundledAssetsDir();
}

function launcherIconPath() {
  const dir = launcherAssetsDir();
  for (const name of ['logo-m-transparent.png', 'logo-m.png', 'logo-transparent.png', 'logo.png']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(dir, 'logo.png');
}

const userData = () => app.getPath('userData');
const storePath = () => path.join(userData(), 'magenta-store.json');
const usersPath = () => path.join(userData(), 'magenta-users.json');
const projectRoot = () => path.normalize(path.join(__dirname, '..', '..'));
const appRoot = () => (app.isPackaged ? app.getAppPath() : path.normalize(path.join(__dirname, '..')));
const resourcesRoot = () => (app.isPackaged ? process.resourcesPath : path.normalize(path.join(__dirname, '..')));

function bundledAssetsDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'assets');
  return path.join(projectRoot(), 'assets');
}

function ensureAssetsInstalled(store) {
  const src = bundledAssetsDir();
  const dst = path.join(store.installPath, 'assets');
  if (fs.existsSync(dst)) return dst;
  if (!fs.existsSync(src)) return null;
  fs.mkdirSync(dst, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const from = path.join(src, file);
    const to = path.join(dst, file);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, to);
    }
  }
  return dst;
}

function defaultInstallPath() {
  const nut = nutprotDir();
  if (fs.existsSync(path.join(nut, 'launcher.txt'))) return nut;
  return path.join(app.getPath('home'), 'Magenta');
}

const defaultStore = () => ({
  installPath: defaultInstallPath(),
  ramMb: 2048,
  session: null
});

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function stableHwidSeed() {
  const parts = [
    process.env.COMPUTERNAME,
    process.env.USERNAME,
    os.platform(),
    os.arch()
  ].filter(Boolean).join('|');
  return parts || 'unknown';
}

function getOrCreateHwid() {
  const store = readJson(storePath(), defaultStore());
  if (store.hwid && String(store.hwid).length >= 16) return String(store.hwid);
  const seed = stableHwidSeed();
  const hwid = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24).toUpperCase();
  store.hwid = hwid;
  writeJson(storePath(), store);
  return hwid;
}

function findJava() {
  if (process.env.JAVA_HOME) {
    const exe = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(exe)) return exe;
  }
  try {
    const out = execSync('where java', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const first = out.split(/\r?\n/).find((line) => line && fs.existsSync(line.trim()));
    if (first) return first.trim();
  } catch (_) {}
  return 'java';
}

function resolveGameRoot(store) {
  if (app.isPackaged) {
    ensureAssetsInstalled(store);
    return store.installPath;
  }
  const devRoot = projectRoot();
  if (fs.existsSync(path.join(devRoot, 'assets'))) return devRoot;
  if (fs.existsSync(path.join(store.installPath, 'assets'))) return store.installPath;
  return devRoot;
}

function copyNativeJarsTo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const sources = [
    path.join(resourcesRoot(), 'client', 'natives'),
    path.join(projectRoot(), 'build', 'natives'),
    path.join(projectRoot(), 'libki')
  ];
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    for (const file of fs.readdirSync(src)) {
      if (file.includes('natives-windows') && file.endsWith('.jar')) {
        fs.copyFileSync(path.join(src, file), path.join(dir, file));
      }
    }
  }
}

function ensureNativesExtracted(store) {
  const nativesJars = path.join(store.installPath, 'natives');
  const nativesBin = path.join(store.installPath, 'natives-bin');

  const bundledBin = path.join(resourcesRoot(), 'client', 'natives-bin');
  if (fs.existsSync(bundledBin) && fs.readdirSync(bundledBin).some((f) => f.endsWith('.dll'))) {
    fs.mkdirSync(nativesBin, { recursive: true });
    for (const file of fs.readdirSync(bundledBin)) {
      if (file.endsWith('.dll')) {
        fs.copyFileSync(path.join(bundledBin, file), path.join(nativesBin, file));
      }
    }
    return nativesBin;
  }

  copyNativeJarsTo(nativesJars);
  fs.mkdirSync(nativesBin, { recursive: true });
  extractNatives(nativesJars, nativesBin);

  if (!fs.readdirSync(nativesBin).some((f) => f.endsWith('.dll'))) {
    throw new Error(
      'Не удалось распаковать LWJGL natives. Выполните в корне: .\\gradlew.bat copyNatives, затем npm run prepare-client'
    );
  }

  return nativesBin;
}

function jarFileName(client = 'stable') {
  if (client === 'beta') return 'magenta-beta-1.0-SNAPSHOT.jar';
  return 'magenta-1.0-SNAPSHOT.jar';
}

function launchClient(store, client = 'stable') {
  const jarName = jarFileName(client);
  const targetJar = path.join(store.installPath, jarName);
  if (!fs.existsSync(targetJar) || isStubFile(targetJar)) {
    throw new Error('Клиент не загружен. Нажмите Play для загрузки.');
  }

  const gameRoot = resolveGameRoot(store);
  const assetsDir = path.join(gameRoot, 'assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Папка assets не найдена (${assetsDir}).`);
  }

  const nativesDir = ensureNativesExtracted(store);
  const java = findJava();
  const logFile = path.join(store.installPath, 'launch.log');
  const ram = Number(store.ramMb) || 2048;

  const args = [
    `-Xmx${ram}M`,
    `-Djava.library.path=${nativesDir}`,
    '-jar',
    targetJar
  ];

  fs.writeFileSync(
    logFile,
    `\n--- ${new Date().toISOString()} [${client}] ---\njava: ${java}\ncwd: ${gameRoot}\nargs: ${args.join(' ')}\n`,
    { flag: 'a' }
  );

  return new Promise((resolve) => {
    const child = spawn(java, args, {
      cwd: gameRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let output = '';
    const append = (chunk) => {
      const text = chunk.toString();
      output += text;
      fs.appendFileSync(logFile, text);
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.on('error', (err) => {
      finish({ ok: false, error: `Не удалось запустить Java: ${err.message}` });
    });

    child.on('exit', (code) => {
      if (code !== null && code !== 0) {
        const tail = output.trim().slice(-1500) || `Код выхода: ${code}`;
        finish({ ok: false, error: tail });
      }
    });

    setTimeout(() => {
      if (child.exitCode === null) {
        child.unref();
        finish({ ok: true });
      }
    }, 2800);
  });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_W,
    height: WINDOW_H,
    minWidth: WINDOW_W,
    minHeight: WINDOW_H,
    maxWidth: WINDOW_W,
    maxHeight: WINDOW_H,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: launcherIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1
    }
  });
  applyWindowLock(mainWindow);
  mainWindow.loadFile(path.join(appRoot(), 'src', 'index.html'));
}

let protectionTimer = null;

app.whenReady().then(async () => {
  registerScreenshotBlock();
  createWindow();
  const store = readJson(storePath(), defaultStore());
  const session = { ...store.session, hwid: getOrCreateHwid() };
  protectionTimer = startProtectionLoop({
    onThreat: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('protection:threat');
      }
    }
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (protectionTimer) clearInterval(protectionTimer);
  unregisterScreenshotBlock();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.handle('app:getPaths', () => ({
  assets: path.join(resourcesRoot(), 'assets'),
  nutprot: nutprotDir()
}));

ipcMain.handle('store:load', () => readJson(storePath(), defaultStore()));

ipcMain.handle('store:save', (_, data) => {
  const current = readJson(storePath(), defaultStore());
  writeJson(storePath(), { ...current, ...data, session: current.session });
  return readJson(storePath(), defaultStore());
});

ipcMain.handle('auth:login', async (_, { login, password }) => {
  if (!login || !password) return { ok: false, error: 'Заполните все поля' };
  const users = readJson(usersPath(), {});
  const user = users[login];
  if (!user) return { ok: false, error: 'Пользователь не найден. Зарегистрируйтесь.' };
  const hashed = hashPassword(password, user.salt);
  if (hashed !== user.password) return { ok: false, error: 'Неверный пароль' };
  const session = {
    uid: user.uid,
    login,
    token: crypto.randomBytes(32).toString('hex'),
    activated: user.activated || false
  };
  const store = readJson(storePath(), defaultStore());
  store.session = session;
  writeJson(storePath(), store);
  return { ok: true, session };
});

ipcMain.handle('auth:register', async (_, { login, password, key }) => {
  if (!login || !password) return { ok: false, error: 'Заполните все поля' };
  const users = readJson(usersPath(), {});
  if (users[login]) return { ok: false, error: 'Пользователь уже существует' };
  const salt = generateSalt();
  const hashed = hashPassword(password, salt);
  const uid = crypto.randomBytes(8).toString('hex');
  users[login] = { uid, password: hashed, salt, activated: false, created: Date.now() };
  writeJson(usersPath(), users);
  const session = { uid, login, token: crypto.randomBytes(32).toString('hex'), activated: false };
  const store = readJson(storePath(), defaultStore());
  store.session = session;
  writeJson(storePath(), store);
  return { ok: true, session };
});

ipcMain.handle('auth:activate', async (_, { key }) => {
  if (!key) return { ok: false, error: 'Введите ключ активации' };
  const store = readJson(storePath(), defaultStore());
  const session = store.session;
  if (!session) return { ok: false, error: 'Сначала войдите' };
  const users = readJson(usersPath(), {});
  const user = users[session.login];
  if (!user) return { ok: false, error: 'Пользователь не найден' };
  user.activated = true;
  user.activationKey = key;
  user.activatedAt = Date.now();
  users[session.login] = user;
  writeJson(usersPath(), users);
  session.activated = true;
  store.session = session;
  writeJson(storePath(), store);
  return { ok: true, session };
});

ipcMain.handle('auth:logout', () => {
  const store = readJson(storePath(), defaultStore());
  store.session = null;
  writeJson(storePath(), store);
  return { ok: true };
});

ipcMain.handle('auth:session', async () => {
  const store = readJson(storePath(), defaultStore());
  return store.session || null;
});

ipcMain.handle('dialog:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('shell:openFolder', (_, folder) => {
  if (folder && fs.existsSync(folder)) shell.openPath(folder);
});

ipcMain.handle('shell:openExternal', async (_, url) => {
  const u = String(url || '').trim();
  if (!u) return { ok: false };
  if (!/^https?:\/\//i.test(u)) return { ok: false };
  await shell.openExternal(u);
  return { ok: true };
});

ipcMain.handle('clipboard:writeText', (_, text) => {
  clipboard.writeText(String(text ?? ''));
  return { ok: true };
});

ipcMain.handle('app:getHwid', () => ({ ok: true, hwid: getOrCreateHwid() }));

function sendLaunchProgress(data) {
  mainWindow?.webContents.send('client:installProgress', data);
}

function buildPipelineCtx(store) {
  return {
    installPath: store.installPath,
    resourcesRoot: resourcesRoot(),
    projectRoot: projectRoot(),
    bundledAssetsDir,
    store,
    findJava,
    ensureNatives: async (s) => { ensureNativesExtracted(s); },
    onProgress: sendLaunchProgress,
    env: process.env
  };
}

ipcMain.handle('client:install', async (_, client = 'stable') => {
  try {
    const kind = client === 'beta' ? 'beta' : 'stable';
    const store = readJson(storePath(), defaultStore());
    await runPreparePipeline(kind, buildPipelineCtx(store));
    finishLaunching(sendLaunchProgress, kind);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('client:launch', async (_, client = 'stable') => {
  try {
    const kind = client === 'beta' ? 'beta' : 'stable';
    const store = readJson(storePath(), defaultStore());
    const session = store.session;
    if (!session?.activated) {
      return { ok: false, error: 'Требуется активация. Введите ключ в настройках.' };
    }
    const prot = await runProtectionCheck();
    if (!prot.ok) {
      return { ok: false, error: 'Обнаружены инструменты взлома.' };
    }
    await runPreparePipeline(kind, buildPipelineCtx(store));
    const result = await launchClient(store, kind);
    if (result.ok) finishLaunching(sendLaunchProgress, kind);
    return result;
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});
