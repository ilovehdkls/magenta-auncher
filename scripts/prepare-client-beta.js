const fs = require('fs');
const path = require('path');

const konetinRoot = process.env.KONETIN_PATH
  || path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'konetin');
const launcherRoot = path.join(__dirname, '..');
const betaDir = path.join(launcherRoot, 'client-beta');
const konetinBundle = path.join(betaDir, 'konetin');
const clientDir = path.join(launcherRoot, 'client');

const jarNames = ['rockstar-1.0.0.jar', 'rockstar-1.0.0-dev.jar'];
const skipDirs = new Set(['.gradle', '.git', 'build', 'run', 'launcher', 'holdmy', 'skyshader', 'node_modules']);

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(src, dst, filter) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (filter && !filter(entry.name, path.join(src, entry.name))) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(from, to, filter);
    else copyFile(from, to);
  }
}

function findModJar() {
  for (const name of jarNames) {
    const p = path.join(konetinRoot, 'build', 'libs', name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

if (!fs.existsSync(konetinRoot)) {
  console.error(`Konetin not found: ${konetinRoot}`);
  process.exit(1);
}

const modJar = findModJar();
if (!modJar) {
  console.error('Mod JAR not found. Run in konetin: gradlew.bat remapJar -x :launcher:build');
  process.exit(1);
}

if (fs.existsSync(betaDir)) {
  fs.rmSync(betaDir, { recursive: true, force: true });
}
fs.mkdirSync(betaDir, { recursive: true });

copyDir(konetinRoot, konetinBundle, (name) => !skipDirs.has(name));

for (const file of ['build.gradle', 'gradle.properties', 'gradlew', 'gradlew.bat', 'settings.gradle']) {
  const src = path.join(konetinRoot, file);
  if (fs.existsSync(src)) copyFile(src, path.join(konetinBundle, file));
}
copyDir(path.join(konetinRoot, 'gradle'), path.join(konetinBundle, 'gradle'));
copyDir(path.join(konetinRoot, 'src'), path.join(konetinBundle, 'src'));

fs.writeFileSync(
  path.join(konetinBundle, 'settings.gradle'),
  "pluginManagement {\n    repositories {\n        maven { url = 'https://maven.fabricmc.net/' }\n        gradlePluginPortal()\n        mavenCentral()\n    }\n}\n\nrootProject.name = 'rockstar'\n",
  'utf8'
);

const modsDir = path.join(konetinBundle, 'run', 'mods');
fs.mkdirSync(modsDir, { recursive: true });
copyFile(modJar, path.join(modsDir, 'rockstar-1.0.0.jar'));

const betaJarDst = path.join(clientDir, 'magenta-beta-1.0-SNAPSHOT.jar');
fs.mkdirSync(clientDir, { recursive: true });
copyFile(modJar, betaJarDst);

console.log(`Bundled konetin -> ${konetinBundle}`);
console.log(`Beta mod JAR -> ${betaJarDst}`);
