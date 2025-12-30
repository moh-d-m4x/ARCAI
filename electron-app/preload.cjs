const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Scanner operations
    getScanners: () => ipcRenderer.invoke('get-scanners'),
    performScan: (options) => ipcRenderer.invoke('perform-scan', options),
    cancelScan: () => ipcRenderer.invoke('cancel-scan'),

    // OCR operations
    checkOcrLanguages: () => ipcRenderer.invoke('ocr:check-languages'),
    installOcrLanguage: (langCode) => ipcRenderer.invoke('ocr:install-language', langCode),
    uninstallOcrLanguage: (langCode) => ipcRenderer.invoke('ocr:uninstall-language', langCode),
    extractText: (imageBase64, language) => ipcRenderer.invoke('ocr:extract-text', { imageBase64, language }),
    onOcrInstallProgress: (callback) => {
        ipcRenderer.on('ocr:install-progress', (event, data) => callback(data));
    },
    removeOcrInstallProgressListener: () => {
        ipcRenderer.removeAllListeners('ocr:install-progress');
    },
    onOcrUninstallProgress: (callback) => {
        ipcRenderer.on('ocr:uninstall-progress', (event, data) => callback(data));
    },
    removeOcrUninstallProgressListener: () => {
        ipcRenderer.removeAllListeners('ocr:uninstall-progress');
    },

    // Check if running in Electron
    isElectron: true,
});
