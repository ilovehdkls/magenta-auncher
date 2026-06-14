const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function extractNatives(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return false;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const jars = fs.readdirSync(sourceDir).filter(
    (f) => f.includes('natives-windows') && f.endsWith('.jar')
  );

  if (!jars.length) {
    return false;
  }

  for (const jarName of jars) {
    const jarPath = path.join(sourceDir, jarName).replace(/\\/g, '/');
    const outPath = targetDir.replace(/\\/g, '/');
    const script = [
      "Add-Type -AssemblyName System.IO.Compression.FileSystem",
      `$z = [IO.Compression.ZipFile]::OpenRead('${jarPath.replace(/'/g, "''")}')`,
      "try {",
      `  foreach ($e in $z.Entries) {`,
      `    if ($e.Name -match '\\.dll$') {`,
      `      $dest = Join-Path '${outPath.replace(/'/g, "''")}' (Split-Path $e.Name -Leaf)`,
      '      [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)',
      '    }',
      '  }',
      '} finally { $z.Dispose() }'
    ].join('; ');

    execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
      stdio: 'pipe'
    });
  }

  return fs.readdirSync(targetDir).some((f) => f.endsWith('.dll'));
}

module.exports = { extractNatives };
