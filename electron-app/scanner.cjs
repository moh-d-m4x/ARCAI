const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

// Path to NAPS2 Console executable
// We check commonly expected locations
const NAPS2_PATH = path.join(__dirname, 'naps2_v7', 'App', 'NAPS2.Console.exe');

async function checkNaps2() {
    return fs.existsSync(NAPS2_PATH);
}

function execNaps2(args) {
    return new Promise((resolve, reject) => {
        // NAPS2 Console arguments
        // Ensure we quote the path
        const command = `"${NAPS2_PATH}" ${args}`;
        console.log('Running NAPS2:', command);

        exec(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
        });
    });
}

async function getScanners() {
    if (!await checkNaps2()) {
        console.error('NAPS2 not found at', NAPS2_PATH);
        return [];
    }

    const scanners = [];

    // List TWAIN devices (Preferred)
    try {
        const twainResult = await execNaps2('--listdevices --driver twain');
        if (!twainResult.error) {
            twainResult.stdout.split('\n').forEach(line => {
                const name = line.trim();
                if (name && !name.startsWith('Error')) {
                    scanners.push({
                        id: `twain:${name}`,
                        name: `${name} (TWAIN - RECOMMENDED for Feeder)`
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
                if (name && !name.startsWith('Error')) {
                    // Check if already added via TWAIN (simple generic check)
                    // Just add it but mark it
                    scanners.push({
                        id: `wia:${name}`,
                        name: `${name} (WIA - Flatbed/Backup)`
                    });
                }
            });
        }
    } catch (e) {
        console.error('Error listing WIA:', e);
    }

    return scanners;
}

async function performScan(scannerId, resolution = 'mid', doubleSided = false) {
    if (!await checkNaps2()) {
        throw new Error('Scanning engine (NAPS2) not found.');
    }

    // Parse ID "driver:name"
    const [driver, ...nameParts] = scannerId.split(':');
    const deviceName = nameParts.join(':'); // Rejoin in case name has colons

    if (!driver || !deviceName) {
        throw new Error('Invalid scanner ID');
    }

    const tempDir = os.tmpdir();
    // Use NAPS2 placeholder $(nnnn) for numbering
    const filePrefix = `scan_${Date.now()}`;
    const outputPattern = path.join(tempDir, `${filePrefix}_$(nnnn).jpg`);

    // Map resolution
    let dpi = 200;
    if (resolution === 'high') dpi = 300;
    if (resolution === 'low') dpi = 150;

    // Map source
    // NAPS2 sources: "glass", "feeder", "duplex"
    let source = 'glass';
    // Logic: If user specifically clicked button? 
    // Wait, performScan is called by UI.
    // The UI calls performScan.
    // In previous logic: We tried Feeder first, fallback to glass?
    // Actually, user wants ADF.
    // The current UI might not have a "Source" selector explicitly passed to performScan?
    // Looking at previous code: `useFeeder` was determined by checking paper status.
    // NAPS2 does not expose paper status check easily via CLI?
    // Can we just try "feeder" and if it fails, try "glass"?
    // OR: NAPS2 --source feeder might fail if empty?
    // The user's request was specifically "detecting the upper feeder".
    // So I should default to 'feeder' or 'duplex'.
    // If I use 'feeder', it forces ADF.

    if (doubleSided) {
        source = 'duplex';
    } else {
        source = 'feeder';
    }

    // Command construction
    // --noprofile is required to use raw args
    // --force to overwrite
    const args = ` -o "${outputPattern}" --source ${source} --driver ${driver} --device "${deviceName}" --dpi ${dpi} --jpegquality 80 --force`;

    console.log('Starting scan:', args);
    const result = await execNaps2(args);

    if (result.error && result.stderr) {
        console.error("Scan Error:", result.stderr);
        // Fallback: If 'feeder' empty/error, maybe try 'glass' if it was a generic error?
        // But user wants feeder.
        // NAPS2 might return error if empty.
        // "No documents found in feeder"
        throw new Error('Scan failed: ' + result.stderr + (result.stdout || ''));
    }

    // Find generated files
    // They will match scan_TIMESTAMP_1.jpg, ..._2.jpg, etc.
    const files = fs.readdirSync(tempDir)
        .filter(f => f.startsWith(filePrefix) && f.endsWith('.jpg'))
        .map(f => path.join(tempDir, f))
        .sort(); // Ensure order by filename

    if (files.length === 0) {
        // Log the NAPS2 output to understand why it failed silently
        console.error("NAPS2 Output:", result.stdout);
        console.error("NAPS2 Stderr:", result.stderr);
        throw new Error(`No images scanned. NAPS2 Output: ${result.stdout} ${result.stderr}`);
    }

    // Read and convert to base64
    const images = [];
    for (const file of files) {
        try {
            const data = fs.readFileSync(file);
            const base64 = `data:image/jpeg;base64,${data.toString('base64')}`;
            images.push(base64);

            // Cleanup
            fs.unlinkSync(file);
        } catch (e) {
            console.error('Error processing scan file:', file, e);
        }
    }

    return images;
}

module.exports = {
    getScanners,
    performScan
};
