@echo off
echo Starting ARCAI Application...
echo.
REM Navigate to the project directory
cd /d "%~dp0"
REM Check if node_modules exists, if not install dependencies
if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
    echo.
)
REM Start Vite dev server + Electron
echo Starting Vite dev server + Electron...
npx concurrently -k "npm run dev" "npx wait-on http://localhost:5173 && npm run electron"
pause