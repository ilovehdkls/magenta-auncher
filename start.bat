@echo off
cd /d "%~dp0"
if not exist "node_modules\electron" (
  echo Сначала запусти install.bat
  pause
  exit /b 1
)
set MAGENTA_SKIP_PROTECTION=1
"C:\Program Files\nodejs\npm.cmd" start
