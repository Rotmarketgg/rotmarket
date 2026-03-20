@echo off
title RotMarket Dev Server
color 0A

:start
cls
echo.
echo  =======================================
echo    ROTMARKET.GG - Dev Server
echo  =======================================
echo.

:: Kill any process already using port 3000
echo  Clearing port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Move to the rotmarket folder (same directory as this .bat file)
cd /d "%~dp0rotmarket"

if not exist "package.json" (
    echo.
    echo  ERROR: package.json not found.
    echo  Make sure this file is in the same folder as your rotmarket project.
    echo.
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo  node_modules not found. Running npm install...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  npm install failed. Check your Node.js installation.
        pause
        exit /b 1
    )
)

echo.
echo  Starting dev server at http://localhost:3000
echo.
echo  Press Ctrl+C to stop the server.
echo  After stopping, press any key to restart.
echo  Close this window to exit completely.
echo.
echo  =======================================
echo.

call npm run dev

echo.
echo  Server stopped.
echo.
echo  =======================================
echo   Press any key to restart...
echo   Close this window to exit.
echo  =======================================
echo.
pause >nul
goto start
