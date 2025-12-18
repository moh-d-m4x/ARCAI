const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Scanner operations
    getScanners: () => ipcRenderer.invoke('get-scanners'),
    performScan: (options) => ipcRenderer.invoke('perform-scan', options),
    cancelScan: () => ipcRenderer.invoke('cancel-scan'),

    // Check if running in Electron
    isElectron: true,
});
