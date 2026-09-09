@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto missing_node
where npm >nul 2>&1
if errorlevel 1 goto missing_node
if not exist node_modules goto setup
if not exist dist\index.html goto setup
goto launch
:setup
call npm run setup
if errorlevel 1 goto failed
:launch
if not defined PORT set PORT=5173
echo Open http://127.0.0.1:%PORT% in your browser.
call npm start
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo Install Node.js 22.12 or newer from https://nodejs.org/ then try again.
:failed
pause
exit /b 1
