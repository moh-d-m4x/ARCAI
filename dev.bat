@echo off
set "PATH=%~dp0local_node\node-v22.12.0-win-x64;%PATH%"
echo Starting ARCAI Development Server...
npm run dev
