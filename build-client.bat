@echo off
cd /d "%~dp0"
echo === Building C++ Protection Module ===
call cpp-protection\build.bat
if errorlevel 1 (
  echo C++ build failed or compiler not found. Skipping.
)

echo.
echo === Preparing client (natives only) ===
call "C:\Program Files\nodejs\npm.cmd" run prepare-client
if errorlevel 1 goto fail

echo.
echo Done. JARs will be downloaded from GitHub on first launch.
echo Run: npm start
pause
exit /b 0

:fail
echo Error.
pause
exit /b 1
