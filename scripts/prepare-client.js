const fs = require('fs');
const path = require('path');
const { extractNatives } = require('./extract-natives');

const root = path.join(__dirname, '..', '..');
const clientDir = path.join(__dirname, '..', 'client');
const libki = path.join(root, 'libki');
const nativesJars = path.join(clientDir, 'natives');
const nativesBin = path.join(clientDir, 'natives-bin');

fs.mkdirSync(clientDir, { recursive: true });
fs.mkdirSync(nativesJars, { recursive: true });
fs.mkdirSync(nativesBin, { recursive: true });

let copied = 0;
if (fs.existsSync(libki)) {
  for (const file of fs.readdirSync(libki)) {
    if (file.includes('natives-windows')) {
      fs.copyFileSync(path.join(libki, file), path.join(nativesJars, file));
      copied++;
    }
  }
}

const buildNatives = path.join(root, 'build', 'natives');
if (fs.existsSync(buildNatives)) {
  for (const file of fs.readdirSync(buildNatives)) {
    if (file.includes('natives-windows')) {
      fs.copyFileSync(path.join(buildNatives, file), path.join(nativesJars, file));
      copied++;
    }
  }
}

if (copied) {
  console.log(`Copied ${copied} native JAR(s)`);
}

if (extractNatives(nativesJars, nativesBin)) {
  const dlls = fs.readdirSync(nativesBin).filter((f) => f.endsWith('.dll'));
  console.log(`Extracted ${dlls.length} native DLL(s) to client/natives-bin/`);
} else {
  console.warn('Could not extract natives. Run gradlew copyNatives first.');
}
