const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

// Path to NAPS2 Console executable
// We check commonly expected locations
const NAPS2_PATH = path.join(__dirname, 'naps2_v7', 'App', 'NAPS2.Console.exe');

// Track active child processes and intervals for cleanup
const activeProcesses = new Set();
const activeIntervals = new Set();

async function checkNaps2() {
    return fs.existsSync(NAPS2_PATH);
}

function execNaps2(args) {
    return new Promise((resolve, reject) => {
        // NAPS2 Console arguments
        // Ensure we quote the path
        const command = `"${NAPS2_PATH}" ${args}`;
        console.log('Running NAPS2:', command);

        const childProcess = exec(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            activeProcesses.delete(childProcess);
            resolve({ error, stdout, stderr });
        });

        // Track the process
        activeProcesses.add(childProcess);

        // Clean up on process exit
        childProcess.on('exit', () => {
            activeProcesses.delete(childProcess);
        });
    });
}

// Helper to get connected physical devices via PowerShell
function getConnectedDevices() {
    return new Promise((resolve) => {
        // Get-PnpDevice -Class Image -Status OK returns physically connected imaging devices
        // Use -ErrorAction SilentlyContinue to suppress errors when no devices found
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Get-PnpDevice -Class Image -Status OK -ErrorAction Stop | Select-Object -ExpandProperty FriendlyName } catch { }"`;
        const childProcess = exec(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            activeProcesses.delete(childProcess);
            // Parse stdout into array of names (may be empty if no devices)
            const devices = stdout.split(/[\r\n]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
            console.log("Connected PnP Devices:", devices);
            resolve(devices);
        });

        activeProcesses.add(childProcess);
        childProcess.on('exit', () => activeProcesses.delete(childProcess));
    });
}

async function getScanners() {
    if (!await checkNaps2()) {
        console.error('NAPS2 not found at', NAPS2_PATH);
        return [];
    }

    // Get active physical devices to filter out "ghost" drivers
    const connectedDevices = await getConnectedDevices();

    // Helper filter function
    const isConnected = (naps2Name) => {
        // If check failed (null), show all as fallback
        if (!connectedDevices) return true;
        // If no devices are connected, don't show any ghost drivers
        if (connectedDevices.length === 0) return false;

        const nameLower = naps2Name.toLowerCase();

        // 1. Strict containment check (for specific models)
        // Check if the specific model details match
        const strictMatch = connectedDevices.some(connected => {
            const connectedLower = connected.toLowerCase();
            return nameLower.includes(connectedLower) || connectedLower.includes(nameLower);
        });
        if (strictMatch) return true;

        // 2. Generic WIA fallback
        // Only trigger this if the NAPS2 name is generic (e.g. "Epson Scanner")
        // AND doesn't contain specific model numbers that differ.
        // We know standard generic names: "epson scanner", "epson scan", "scanner", "wia-epson"
        if (nameLower.includes('scanner') && !nameLower.match(/\d/)) {
            // If name has no digits (no specific model number), assume it's generic WIA
            // Check if Manufacturer matches
            const manufacturer = nameLower.split(' ')[0]; // e.g. "epson"
            return connectedDevices.some(d => d.toLowerCase().includes(manufacturer));
        }

        return false;
    };

    const scanners = [];

    // List TWAIN devices (Preferred)
    try {
        const twainResult = await execNaps2('--listdevices --driver twain');
        if (!twainResult.error) {
            twainResult.stdout.split('\n').forEach(line => {
                const name = line.trim();
                // Filter: Name must match a connected device
                if (name && !name.startsWith('Error') && isConnected(name)) {
                    scanners.push({
                        id: `twain:${name}`,
                        name: name
                    });
                }
            });
        }
    } catch (e) {
        console.error('Error listing TWAIN:', e);
    }

    // List WIA devices (Fallback)
    try {
        const wiaResult = await execNaps2('--listdevices --driver wia');
        if (!wiaResult.error) {
            wiaResult.stdout.split('\n').forEach(line => {
                const name = line.trim();
                // Filter: Name must match a connected device
                if (name && !name.startsWith('Error') && isConnected(name)) {
                    // Check if already added via TWAIN - skip if duplicate
                    // Also skip generic names like "EPSON Scanner" if a specific model already exists
                    const baseNameLower = name.toLowerCase();
                    const manufacturer = baseNameLower.split(' ')[0]; // e.g., "epson"

                    // Check for exact match or same manufacturer with more specific model
                    const alreadyExists = scanners.some(s => {
                        const existingLower = s.name.toLowerCase();
                        // Exact match
                        if (existingLower === baseNameLower) return true;
                        // Same manufacturer - prefer the one with model number (more specific)
                        if (existingLower.startsWith(manufacturer)) {
                            // If existing has model details and current is generic, skip current
                            const existingHasModel = /\w+-?\w*\d+/.test(existingLower);
                            const currentIsGeneric = baseNameLower === `${manufacturer} scanner`;
                            if (existingHasModel && currentIsGeneric) return true;
                        }
                        return false;
                    });

                    if (!alreadyExists) {
                        scanners.push({
                            id: `wia:${name}`,
                            name: name
                        });
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error listing WIA:', e);
    }

    return scanners;
}

// Helper to kill stuck processes
function cleanupProcesses() {
    return new Promise((resolve) => {
        // Kill NAPS2 and known Epson driver processes that might be hanging
        const processes = ['NAPS2.Console.exe', 'Epson Scan 2.exe', 'escndv.exe', 'escndv_t.exe'];
        const cmd = `taskkill /F /T ${processes.map(p => `/IM "${p}"`).join(' ')}`;

        console.log('Cleaning up processes:', cmd);
        // Ignore errors (e.g. if process not found)
        exec(cmd, (err) => {
            resolve();
        });
    });
}

// Helper to auto-dismiss "Epson Scan 2" error popups (Empty Feeder)
function monitorPopup(active) {
    if (!active) return null;

    const interval = setInterval(() => {
        // PowerShell command to find "Epson Scan 2" window and send ENTER immediately
        // Removed Sleep delay for faster dismissal
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$wshell = New-Object -ComObject WScript.Shell; if ($wshell.AppActivate('Epson Scan 2')) { $wshell.SendKeys('{ENTER}') }"`;

        const childProcess = exec(cmd, (err) => {
            activeProcesses.delete(childProcess);
        });
        activeProcesses.add(childProcess);
        childProcess.on('exit', () => activeProcesses.delete(childProcess));
    }, 50); // Check every 50ms for instant dismissal

    // Track the interval
    activeIntervals.add(interval);
    return interval;
}

async function performScan(scannerId, resolution = 'mid', doubleSided = false, source = 'auto') {
    // Kill any stuck previous sessions first
    await cleanupProcesses();

    if (!await checkNaps2()) {
        throw new Error('Scanning engine (NAPS2) not found.');
    }

    // Parse ID "driver:name"
    const [driver, ...nameParts] = scannerId.split(':');
    const deviceName = nameParts.join(':'); // Rejoin in case name has colons

    if (!driver || !deviceName) {
        throw new Error('Invalid scanner ID');
    }

    // Map resolution
    let dpi = 200;
    if (resolution === 'high') dpi = 300;
    if (resolution === 'low') dpi = 150;

    // Helper function to execute a single scan attempt
    const executeScanSession = async (naps2Source, enableMonitor = false) => {
        const tempDir = os.tmpdir();
        const filePrefix = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const outputPattern = path.join(tempDir, `${filePrefix}_$(nnnn).jpg`);

        const args = ` -o "${outputPattern}" --source ${naps2Source} --driver ${driver} --device "${deviceName}" --dpi ${dpi} --jpegquality 80 --force`;
        console.log(`Starting scan [Source=${naps2Source}]:`, args);

        // Start Popup Monitor if requested (e.g. for Auto-Feeder attempt)
        let monitorInterval = null;
        if (enableMonitor) {
            console.log('Enabling popup monitor for ' + naps2Source);
            monitorInterval = monitorPopup(true);
        }

        try {
            const result = await execNaps2(args);

            // Check for generated files
            const files = fs.readdirSync(tempDir)
                .filter(f => f.startsWith(filePrefix) && f.endsWith('.jpg'))
                .map(f => path.join(tempDir, f))
                .sort();

            if (files.length === 0) {
                // If no files, treat as failure
                const errorMsg = result.stderr || result.stdout || "No images scanned";
                throw new Error(errorMsg);
            }

            // Read images
            const images = [];
            for (const file of files) {
                try {
                    const data = fs.readFileSync(file);
                    const base64 = `data:image/jpeg;base64,${data.toString('base64')}`;
                    images.push(base64);
                    fs.unlinkSync(file); // Cleanup
                } catch (e) {
                    console.error('Error reading scan file:', file, e);
                }
            }
            return images;
        } finally {
            // Stop monitor
            if (monitorInterval) {
                clearInterval(monitorInterval);
                activeIntervals.delete(monitorInterval);
            }
        }
    };
    // Strategy Determination
    let primarySource = 'glass';
    let fallbackSource = null;
    let monitorPrimary = false;

    if (source === 'auto') {
        // Auto: Try Feeder/Duplex first, then Glass
        primarySource = doubleSided ? 'duplex' : 'feeder';
        fallbackSource = 'glass';
        monitorPrimary = true; // Enable popup killer for the initial feeder attempt
    } else if (source === 'feeder') {
        primarySource = doubleSided ? 'duplex' : 'feeder';
    } else {
        // Flatbed
        primarySource = 'glass';
    }

    // Execution
    try {
        console.log(`Attempting scan from ${primarySource}...`);
        return await executeScanSession(primarySource, monitorPrimary);
    } catch (primaryError) {
        if (fallbackSource) {
            console.warn(`Primary source ${primarySource} failed (${primaryError.message}). Retrying with ${fallbackSource}...`);
            // Cleanup processes again before retry, just in case
            await cleanupProcesses();
            try {
                return await executeScanSession(fallbackSource, false);
            } catch (fallbackError) {
                // If fallback also fails, throw combined error or fallback error
                throw new Error(`Auto-scan failed. Feeder: ${primaryError.message}. Flatbed: ${fallbackError.message}`);
            }
        } else {
            // No fallback, rethrow
            throw primaryError;
        }
    }
}

// Cleanup function to kill all active processes and intervals
async function cleanup() {
    console.log(`Cleaning up ${activeProcesses.size} processes and ${activeIntervals.size} intervals...`);

    // Clear all intervals
    for (const interval of activeIntervals) {
        clearInterval(interval);
    }
    activeIntervals.clear();

    // Kill all active child processes
    for (const proc of activeProcesses) {
        try {
            proc.kill('SIGTERM');
        } catch (e) {
            // Process may already be dead
        }
    }
    activeProcesses.clear();

    // Also run the general cleanup
    await cleanupProcesses();
}

module.exports = {
    getScanners,
    performScan,
    cleanup
};
