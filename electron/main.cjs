const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getScanners, performScan } = require('./scanner');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 376,
        minHeight: 676,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '../public/favicon.ico'),
        autoHideMenuBar: true,
        show: false,
    });

    // In development, load from Vite dev server
    // In production, load the built files
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
};

// IPC Handlers for scanner operations
ipcMain.handle('get-scanners', async () => {
    try {
        const scanners = await getScanners();
        return { success: true, scanners };
    } catch (error) {
        console.error('Error getting scanners:', error);
        return { success: false, error: error.message, scanners: [] };
    }
});

ipcMain.handle('perform-scan', async (event, { scannerId, resolution, doubleSided }) => {
    try {
        const images = await performScan(scannerId, resolution, doubleSided);
        return { success: true, images };
    } catch (error) {
        console.error('Error scanning:', error);
        return { success: false, error: error.message, images: [] };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
