@echo off
title Renamr
cd /d "%~dp0"

:: Check for node_modules
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo Failed to install dependencies. Make sure Node.js is installed.
        echo Download from: https://nodejs.org/
        pause
        exit /b 1
    )
)

:: Launch
echo Starting Renamr...
npx electron .
