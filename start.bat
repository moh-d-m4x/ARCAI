@echo off
set "PATH=%~dp0local_node\node-v22.12.0-win-x64;%PATH%"
echo Starting ARCAI Electron App...
REM Ensure dev environment and matching port
set NODE_ENV=development
set VITE_DEV_PORT=5174

REM Start Vite dev server and Electron together using concurrently
REM wait-on waits for the Vite server to be ready before launching Electron
npx concurrently -n "Vite,Electron" -c "green,blue" "npx vite --port 5174" "npx wait-on http://localhost:5174 && npm run electron"
