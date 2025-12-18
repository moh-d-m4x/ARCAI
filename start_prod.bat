@echo off
set "PATH=%~dp0local_node\node-v22.12.0-win-x64;%PATH%"
echo Building ARCAI...
call npm run build
echo Starting ARCAI Electron App (Production Mode - No RAM leak!)...
set NODE_ENV=production
npx electron electron-app/main.cjs
