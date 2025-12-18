const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

// Path to NAPS2 Console executable
// We check commonly expected locations
const NAPS2_PATH = path.join(__dirname, 'naps2_v7', 'App', 'NAPS2.Console.exe');

// Track active child processes and timeouts for cleanup
const activeProcesses = new Set();
const activeTimeouts = new Set();

// Global flag to signal cancellation
let isScanCancelled = false;
let hasLoggedDevices = false;

async function checkNaps2() {
    return fs.existsSync(NAPS2_PATH);
}

function execNaps2(argsArray, silent = false) {
    return new Promise((resolve, reject) => {
        // Double check cancellation before starting
        if (isScanCancelled) {
            reject(new Error('Scan cancelled by user'));
            return;
        }

        // Only log spawn if it's not a silenced list operation
        const isListOp = argsArray.includes('--listdevices');
        if (!isListOp || !hasLoggedDevices) {
            console.log('DEBUG: Spawning NAPS2 with args:', argsArray);
        }

        // Use stdio: 'ignore' for actual scans to prevent memory buffering
        const spawnOptions = silent ? { stdio: 'ignore' } : {};
        const childProcess = spawn(NAPS2_PATH, argsArray, spawnOptions);

        let stdout = '';
        let stderr = '';

        // Only attach data handlers if not in silent mode
        if (!silent) {
            childProcess.stdout.on('data', (data) => {
                if (stdout.length < 100000) stdout += data.toString();
            });

            childProcess.stderr.on('data', (data) => {
                if (stderr.length < 100000) stderr += data.toString();
            });
        }

        childProcess.on('close', (code) => {
            activeProcesses.delete(childProcess);
            // Only log exit if it's not a silenced list operation
            if (!isListOp || !hasLoggedDevices) {
                console.log(`DEBUG: NAPS2 process exited with code ${code}`);
            }
            resolve({ error: code !== 0 ? new Error(`Exited with code ${code}`) : null, stdout, stderr });
        });

        childProcess.on('error', (err) => {
            console.error('DEBUG: NAPS2 spawn error:', err);
            activeProcesses.delete(childProcess);
            reject(err);
        });

        // Track the process
        activeProcesses.add(childProcess);
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
            if (!hasLoggedDevices) console.log("Connected PnP Devices:", devices);
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
        if (!hasLoggedDevices) console.log('DEBUG: Listing TWAIN devices...');
        const twainResult = await execNaps2(['--listdevices', '--driver', 'twain']);
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
        if (!hasLoggedDevices) console.log('DEBUG: Listing WIA devices...');
        const wiaResult = await execNaps2(['--listdevices', '--driver', 'wia']);
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

    hasLoggedDevices = true;
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
// REFACTORED: Uses recursive setTimeout instead of setInterval to prevent fork bombs
// Helper to auto-dismiss "Epson Scan 2" error popups (Empty Feeder)
// REFACTORED: Uses recursive setTimeout instead of setInterval to prevent fork bombs
// Returns a stop function
function monitorPopup() {
    if (isScanCancelled) return () => { };

    // Internal active flag for this specific monitor instance
    let isRunning = true;

    const doCheck = () => {
        if (isScanCancelled || !isRunning) return;

        // PowerShell command to find "Epson Scan 2" window and send ENTER immediately
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$wshell = New-Object -ComObject WScript.Shell; if ($wshell.AppActivate('Epson Scan 2')) { $wshell.SendKeys('{ENTER}') }"`;

        const childProcess = exec(cmd, { timeout: 1000 }, (err) => { // 1s timeout for the command itself
            activeProcesses.delete(childProcess);

            // Schedule next check ONLY after this one completes
            // This prevents process piling (fork bomb)
            if (!isScanCancelled && isRunning) {
                // Heartbeat log every ~5 seconds (50 * 100ms) to detect zombie loops
                if (Math.random() < 0.02) console.log('DEBUG: Monitor Popup is ACTIVE...');

                const timeoutId = setTimeout(doCheck, 100); // 100ms delay between checks
                activeTimeouts.add(timeoutId);
            }
        });

        activeProcesses.add(childProcess);
        childProcess.on('exit', () => activeProcesses.delete(childProcess));
    };

    // Start the recursive check
    doCheck();

    // Return the stop function
    return () => {
        isRunning = false;
    };
}

async function performScan(scannerId, resolution = 'mid', doubleSided = false, source = 'auto', pageSize = 'a4') {
    // Reset cancel flag
    isScanCancelled = false;

    // Aggressively cleanup ANY previous session artifacts (timeouts, processes)
    // This protects against "zombie" loops from previous attempts
    await cleanup();

    // IMPORTANT: cleanup() sets isScanCancelled = true. 
    // We must reset it to false HERE to allow the new scan to proceed.
    isScanCancelled = false;

    if (!await checkNaps2()) {
        throw new Error('Scanning engine (NAPS2) not found.');
    }

    if (isScanCancelled) throw new Error('Scan cancelled');

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
        if (isScanCancelled) throw new Error('Scan cancelled');

        const tempDir = os.tmpdir();
        const filePrefix = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const outputPattern = path.join(tempDir, `${filePrefix}_$(nnnn).jpg`);

        // Args as array for spawn
        const args = [
            '-o', outputPattern,
            '--source', naps2Source,
            '--driver', driver,
            '--device', deviceName,
            '--dpi', dpi.toString(),
            '--jpegquality', '80',
            '--force'
        ];

        // Add page size if not 'auto' (let scanner auto-detect)
        if (pageSize && pageSize !== 'auto') {
            args.push('--pagesize', pageSize);
        }

        console.log(`DEBUG: Starting scan session [Source=${naps2Source}]`);

        // Start Popup Monitor if requested (e.g. for Auto-Feeder attempt)
        let stopMonitor = null;
        if (enableMonitor) {
            console.log('DEBUG: Enabling popup monitor for ' + naps2Source);
            stopMonitor = monitorPopup();
        }

        try {
            // Use silent=true to completely ignore stdout/stderr (prevents memory leak)
            const result = await execNaps2(args, true);

            if (isScanCancelled) throw new Error('Scan cancelled');

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
            if (stopMonitor) {
                stopMonitor();
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
        if (isScanCancelled) throw new Error('Scan cancelled');

        if (fallbackSource) {
            console.warn(`Primary source ${primarySource} failed (${primaryError.message}). Retrying with ${fallbackSource}...`);
            // Cleanup processes again before retry, just in case
            await cleanupProcesses();
            try {
                return await executeScanSession(fallbackSource, false);
            } catch (fallbackError) {
                if (isScanCancelled) throw new Error('Scan cancelled');
                // If fallback also fails, throw combined error or fallback error
                throw new Error(`Auto-scan failed. Feeder: ${primaryError.message}. Flatbed: ${fallbackError.message}`);
            }
        } else {
            // No fallback, rethrow
            throw primaryError;
        }
    }
}

// Cleanup function to kill all active processes, timeouts and stop monitors
async function cleanup() {
    console.log(`Cleaning up... Flagging cancellation.`);
    isScanCancelled = true;

    // Clear all timeouts
    for (const timeout of activeTimeouts) {
        clearTimeout(timeout);
    }
    activeTimeouts.clear();

    // Kill all active child processes
    console.log(`Killing ${activeProcesses.size} active processes...`);
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
