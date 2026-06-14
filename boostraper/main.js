const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

const LAUNCHER_REPO = {
  owner: process.env.LAUNCHER_OWNER || 'ilovehdkls',
  repo: process.env.LAUNCHER_REPO || 'magenta-auncher',
  asset: process.env.LAUNCHER_ASSET || 'Magenta.DLC.Launcher.exe'
};

function launcherDownloadUrl() {
  return `https://github.com/${LAUNCHER_REPO.owner}/${LAUNCHER_REPO.repo}/releases/latest/download/${LAUNCHER_REPO.asset}`;
}

function nutprotDir() {
  return path.join(os.homedir(), 'Nutprot');
}

function sendProgress(win, pct, text) {
  if (win && !win.isDestroyed()) win.webContents.send('progress', { pct, text });
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      timeout: 600000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const total = Number(res.headers['content-length'] || 0);
      let done = 0;
      res.on('data', (chunk) => {
        done += chunk.length;
        if (onProgress && total > 0) onProgress(Math.min(99, Math.round((done / total) * 100)));
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', (e) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(e);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function installNutprot(win) {
  const dir = nutprotDir();
  fs.mkdirSync(dir, { recursive: true });
  sendProgress(win, 10, 'Downloading launcher...');

  const launcherPath = path.join(dir, 'launcher_base.exe');
  const tmp = path.join(dir, 'launcher_base.exe.download');
  const url = process.env.LAUNCHER_URL || launcherDownloadUrl();

  sendProgress(win, 20, 'Connecting to GitHub...');
  await downloadFile(url, tmp, (pct) => sendProgress(win, 20 + Math.floor(pct * 0.6), 'Downloading launcher...'));
  fs.renameSync(tmp, launcherPath);
  sendProgress(win, 85, 'Writing config...');

  const launcherTxt = [
    '# Nutprot launch module',
    'exec=launcher_base.exe',
    'module=launcher',
    'version=1.0',
    `path=${dir.replace(/\\/g, '/')}`,
    `installed=${new Date().toISOString()}`
  ].join('\r\n');
  fs.writeFileSync(path.join(dir, 'launcher.txt'), launcherTxt, 'utf8');

  sendProgress(win, 100, 'Ready');
  return launcherPath;
}

let win;

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  win = new BrowserWindow({
    width: 420,
    height: 260,
    resizable: false,
    frame: true,
    backgroundColor: '#ffffff',
    title: 'Boostraper',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  createWindow();
  try {
    const exe = await installNutprot(win);
    setTimeout(() => {
      spawn(exe, ['--nutprot'], { detached: true, stdio: 'ignore', cwd: nutprotDir() }).unref();
      app.quit();
    }, 900);
  } catch (e) {
    sendProgress(win, 0, `Error: ${e.message}`);
  }
});

ipcMain.on('window:close', () => app.quit());
