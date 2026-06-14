@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\npm.cmd" install
if errorlevel 1 pause & exit /b 1
"C:\Program Files\nodejs\npm.cmd" run prepare-client
echo.
echo Готово. Запуск: start.bat
pause
