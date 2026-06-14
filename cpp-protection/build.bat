@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo === Building Nutprot Protection Module ===

where cl.exe >nul 2>nul
if %errorlevel% equ 0 (
    echo Found MSVC compiler, compiling...
    cl /nologo /O2 /GS- /D "_CRT_SECURE_NO_WARNINGS" main.cpp /Fe:"nutprot.exe" /link /SUBSYSTEM:CONSOLE
    if !errorlevel! equ 0 (
        echo Build successful: nutprot.exe
        goto :done
    ) else (
        echo MSVC build failed, trying MinGW...
    )
)

where g++.exe >nul 2>nul
if %errorlevel% equ 0 (
    echo Found MinGW compiler, compiling...
    g++ -O2 -s -static main.cpp -o nutprot.exe
    if !errorlevel! equ 0 (
        echo Build successful: nutprot.exe
        goto :done
    ) else (
        echo MinGW build failed.
    )
)

echo No suitable C++ compiler found.
echo Install Visual Studio Build Tools or MinGW-w64.
exit /b 1

:done
if exist nutprot.exe (
    copy /y nutprot.exe "..\electron\nutprot.exe" >nul
    echo Copied nutprot.exe to electron/
)
exit /b 0
