@echo off
title MarkViewer Complete Setup and Packaging

echo.
echo MarkViewer Complete Setup and Packaging
echo ===========================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo    Please install Node.js v14+ from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected

REM Clean previous builds
echo ℹ️  Cleaning previous builds...
call npm run clean 2>nul

REM Install main dependencies
echo ℹ️  Installing main dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install main dependencies
    pause
    exit /b 1
)

REM Download PlantUML
echo ℹ️  Setting up PlantUML...
call npm run download-plantuml
if errorlevel 1 (
    echo ❌ Failed to download PlantUML
    pause
    exit /b 1
)

REM Install sub-project dependencies
echo ℹ️  Installing all project dependencies...
call npm run install-all
if errorlevel 1 (
    echo ❌ Failed to install project dependencies
    pause
    exit /b 1
)

REM Test the application
echo ℹ️  Testing application startup...
call npm run test-package
if errorlevel 1 (
    echo ❌ Application test failed
    pause
    exit /b 1
)

echo ✅ Application test completed

REM Create traditional packages
echo ℹ️  Creating traditional distribution packages...
call npm run package
if errorlevel 1 (
    echo ❌ Failed to create traditional packages
    pause
    exit /b 1
)

REM Create executable packages
echo ℹ️  Creating standalone executable packages...
call npm run package-executables
if errorlevel 1 (
    echo ❌ Failed to create executable packages
    pause
    exit /b 1
)

echo.
echo ✅ Complete packaging finished!
echo.
echo 📦 Available distributions:
echo.

if exist "release\" (
    dir /b release\*.zip release\*.tar.gz 2>nul
)

echo.
echo 🚀 Quick start for end users:
echo    1. Download and extract any package
echo    2. Run the installer (install.sh or install.bat)
echo    3. Launch with .\markviewer (Unix) or markviewer.bat (Windows)
echo.
echo 📁 Distribution files location: .\release\
echo.
echo ✅ Ready for distribution! 🎉
echo.
pause
