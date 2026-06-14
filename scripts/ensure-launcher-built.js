const fs = require('fs');
const path = require('path');

const exe = path.join(__dirname, '..', 'dist', 'Magenta DLC Launcher.exe');
if (!fs.existsSync(exe)) {
  console.error('Launcher EXE not found. Run: npm run build:protected');
  process.exit(1);
}
console.log('Launcher EXE OK:', exe);
