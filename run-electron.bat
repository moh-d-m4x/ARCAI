@echo off
set "PATH=%~dp0local_node\node-v22.12.0-win-x64;%PATH%"
set NODE_ENV=development
set VITE_DEV_PORT=5174
echo Starting Electron App...
call npm run electron
