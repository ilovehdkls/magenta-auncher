const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const STUB_MARKER = 'MAGENTA_STUB_V1';
const STUB_MAX_BYTES = 64 * 1024;

function isStubFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return true;
    const stat = fs.statSync(filePath);
    if (stat.size <= STUB_MAX_BYTES) return true;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    return buf.slice(0, n).toString('utf8').includes(STUB_MARKER);
  } catch (_) {
    return true;
  }
}

const GITHUB_REPOS = {
  stable: { owner: 'magenta', repo: 'client-stable', asset: 'magenta-1.0-SNAPSHOT.jar' },
  beta: { owner: 'magenta', repo: 'client-beta', asset: 'magenta-beta-1.0-SNAPSHOT.jar' }
};

function githubLatestUrl(owner, repo, asset) {
  return `https://github.com/${owner}/${repo}/releases/latest/download/${asset}`;
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
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    });
    req.on('error', (e) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(e);
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function ensureStableInstalled({ installPath, onProgress, env }) {
  const repo = env?.GITHUB_STABLE_REPO || GITHUB_REPOS.stable;
  const jarName = repo.asset || 'magenta-1.0-SNAPSHOT.jar';
  const targetJar = path.join(installPath, jarName);

  if (fs.existsSync(targetJar) && !isStubFile(targetJar)) {
    onProgress?.(100);
    return targetJar;
  }

  fs.mkdirSync(installPath, { recursive: true });
  onProgress?.(5);
  const tmp = path.join(installPath, `.${jarName}.download`);
  const url = env?.STABLE_JAR_URL || githubLatestUrl(repo.owner, repo.repo, repo.asset);
  await downloadFile(url, tmp, onProgress);
  fs.renameSync(tmp, targetJar);
  onProgress?.(100);
  return targetJar;
}

async function ensureBetaInstalled({ installPath, onProgress, env }) {
  const repo = env?.GITHUB_BETA_REPO || GITHUB_REPOS.beta;
  const jarName = repo.asset || 'magenta-beta-1.0-SNAPSHOT.jar';
  const targetJar = path.join(installPath, jarName);

  if (fs.existsSync(targetJar) && !isStubFile(targetJar)) {
    onProgress?.(100);
    return targetJar;
  }

  fs.mkdirSync(installPath, { recursive: true });
  onProgress?.(5);
  const tmp = path.join(installPath, `.${jarName}.download`);
  const url = env?.BETA_JAR_URL || githubLatestUrl(repo.owner, repo.repo, repo.asset);
  await downloadFile(url, tmp, onProgress);
  fs.renameSync(tmp, targetJar);
  onProgress?.(100);
  return targetJar;
}

async function installClient(kind, ctx) {
  if (kind === 'beta') return ensureBetaInstalled(ctx);
  return ensureStableInstalled(ctx);
}

module.exports = {
  STUB_MARKER,
  isStubFile,
  installClient,
  ensureStableInstalled,
  ensureBetaInstalled
};
