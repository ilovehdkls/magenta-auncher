const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const launcherRoot = path.join(__dirname, '..');
const konetin = path.join(launcherRoot, 'client-beta', 'konetin');
const outDir = path.join(launcherRoot, '..', 'madgenta-site', 'downloads');
const zipPath = path.join(outDir, 'beta-client.zip');
const vaultZip = path.join(launcherRoot, 'client-vault', 'beta-client.zip');

if (!fs.existsSync(path.join(konetin, 'gradlew.bat'))) {
  console.error('konetin bundle missing. Run: npm run prepare-client-beta');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(vaultZip), { recursive: true });
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const ps = `Compress-Archive -Path '${konetin.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;
execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });
fs.copyFileSync(zipPath, vaultZip);
console.log(`Beta zip -> ${zipPath}`);
