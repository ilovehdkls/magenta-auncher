const { app } = require('electron');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function nutprotDir() {
  return path.join(os.homedir(), 'Nutprot');
}

function protectionBinary() {
  const names = ['nutprot.exe'];
  const dirs = [
    path.join(__dirname),
    path.join(nutprotDir()),
    process.resourcesPath
  ];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function runProtectionScan() {
  const bin = protectionBinary();
  if (!bin) return { ok: true, msg: 'protection binary not found, skipped' };
  const result = spawnSync(bin, ['--scan'], {
    timeout: 10000,
    windowsHide: true,
    encoding: 'utf8'
  });
  const stdout = (result.stdout || '').trim();
  const ok = result.status === 0 && stdout === 'OK';
  return { ok, msg: stdout, status: result.status };
}

async function runProtectionCheck() {
  if (process.env.MAGENTA_SKIP_PROTECTION === '1') return { ok: true };
  const scan = runProtectionScan();
  if (scan.ok) return { ok: true };
  return { ok: false, hits: [scan.msg] };
}

function startProtectionLoop(ctx) {
  const tick = async () => {
    const result = await runProtectionCheck();
    if (!result.ok && typeof ctx.onThreat === 'function') {
      ctx.onThreat(result.hits);
    }
  };
  tick();
  return setInterval(tick, 60000);
}

module.exports = {
  nutprotDir,
  runProtectionCheck,
  startProtectionLoop
};
