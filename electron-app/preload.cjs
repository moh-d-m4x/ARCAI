const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Scanner operations
    getScanners: () => ipcRenderer.invoke('get-scanners'),
    performScan: (options) => ipcRenderer.invoke('perform-scan', options),

    // Check if running in Electron
    isElectron: true,
});
