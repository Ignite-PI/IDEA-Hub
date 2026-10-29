@echo off
title SBF Tower Portfolio Hub
set PATH=C:\Users\al01683\Downloads\nodejs\node-v20.18.1-win-x64;%PATH%
cd /d "%~dp0"

echo.
echo =====================================================
echo   SBF Tower Portfolio Hub
echo =====================================================
echo.

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Building the app...
call npm run build
if errorlevel 1 (
  echo Build failed. See messages above.
  pause
  exit /b 1
)

start "" http://localhost:3002
echo.
echo Running at http://localhost:3002  (close this window to stop)
echo.
node server\server.cjs
pause
