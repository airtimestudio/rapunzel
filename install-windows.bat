@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Rapunzel Installer for Windows
echo   "Let down your hair extensions!"
echo ========================================
echo.

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%

:: Get script directory
set "SCRIPT_DIR=%~dp0"
set "NATIVE_APP_DIR=%SCRIPT_DIR%native-app"
set "EXTENSION_DIR=%SCRIPT_DIR%extension"

:: Check if directories exist
if not exist "%NATIVE_APP_DIR%" (
    echo [ERROR] native-app directory not found at: %NATIVE_APP_DIR%
    pause
    exit /b 1
)

echo [OK] Found native-app directory

:: Run the install script
echo.
echo Registering native messaging host with Firefox...
cd /d "%NATIVE_APP_DIR%"
node install.js install
if %errorlevel% neq 0 (
    echo [ERROR] Installation failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo IMPORTANT: How Native Messaging Works
echo -------------------------------------
echo The native helper runs AUTOMATICALLY when Firefox
echo needs it - you don't need to start it manually!
echo.
echo Next Steps:
echo -----------
echo 1. Open Firefox
echo 2. Go to: about:debugging#/runtime/this-firefox
echo 3. Click "Load Temporary Add-on"
echo 4. Select: %EXTENSION_DIR%\manifest.json
echo 5. Click the Rapunzel icon in toolbar
echo 6. Set your extensions folder path
echo 7. Click "Let Down Your Hair!"
echo.
pause
