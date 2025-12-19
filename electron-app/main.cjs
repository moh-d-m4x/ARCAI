const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { getScanners, performScan, cleanup: cleanupScanner } = require('./scanner.cjs');

// Disable security warnings in development (CSP warning cannot be avoided with Vite HMR)
// The packaged app will have proper CSP applied
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;
let isQuitting = false;

const createWindow = () => {
    // Determine if running in dev mode:
    // - Explicitly set via NODE_ENV=production means NOT dev
    // - Otherwise, check if packaged
    const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
    console.log(`Running in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);


    // Set Content Security Policy (only in production to avoid Vite HMR conflicts)
    if (!isDev) {
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self'; " +
                        "script-src 'self'; " +
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                        "font-src 'self' https://fonts.gstatic.com; " +
                        "img-src 'self' data: blob: file:; " +
                        "connect-src 'self' https://generativelanguage.googleapis.com; " +
                        "media-src 'self' data: blob: file:;"
                    ]
                }
            });
        });
    }

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 376,
        minHeight: 676,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '../public/favicon.ico'),
        autoHideMenuBar: true,
        show: false,
    });

    // In development, load from Vite dev server
    // In production, load the built files
    if (isDev) {
        // Try different ports in case default is in use
        const devPort = process.env.VITE_DEV_PORT || 5173;
        mainWindow.loadURL(`http://localhost:${devPort}`);
        // DevTools can be opened manually with Ctrl+Shift+I
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
};

app.whenReady().then(() => {
    // Register IPC Handlers for scanner operations
    ipcMain.handle('get-scanners', async () => {
        try {
            const scanners = await getScanners();
            return { success: true, scanners };
        } catch (error) {
            console.error('Error getting scanners:', error);
            return { success: false, error: error.message, scanners: [] };
        }
    });

    ipcMain.handle('perform-scan', async (event, { scannerId, resolution, doubleSided, source, pageSize }) => {
        try {
            const images = await performScan(scannerId, resolution, doubleSided, source, pageSize);
            return { success: true, images };
        } catch (error) {
            console.error('Error scanning:', error);
            return { success: false, error: error.message, images: [] };
        }
    });

    ipcMain.handle('cancel-scan', async () => {
        try {
            await cleanupScanner();
            return { success: true };
        } catch (error) {
            console.error('Error cancelling scan:', error);
            return { success: false, error: error.message };
        }
    });

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

// Cleanup before quitting
app.on('before-quit', async (event) => {
    if (isQuitting) return;
    isQuitting = true;

    console.log('Cleaning up before quit...');

    // Remove IPC handlers to release references
    ipcMain.removeHandler('get-scanners');
    ipcMain.removeHandler('perform-scan');

    // Cleanup scanner processes
    try {
        await cleanupScanner();
    } catch (e) {
        console.error('Error during scanner cleanup:', e);
    }
});

// Force exit after quit to ensure Node process terminates
app.on('quit', () => {
    console.log('App quit, forcing process exit...');
    // Use setTimeout to allow any final cleanup, then force exit
    setTimeout(() => {
        process.exit(0);
    }, 500);
});
