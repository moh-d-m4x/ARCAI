const { exec } = require('child_process');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Language codes for Windows OCR
const OCR_LANGUAGES = {
    'ar': 'ar-SA',
    'en': 'en-US'
};

/**
 * Check which OCR languages are installed on the system
 * @returns {Promise<{ar: boolean, en: boolean}>}
 */
async function checkOcrLanguages() {
    const tempDir = os.tmpdir();
    const scriptFile = path.join(tempDir, `ocr_check_${Date.now()}.ps1`);
    const resultFile = path.join(tempDir, `ocr_check_result_${Date.now()}.txt`);

    const scriptContent = `
$resultFile = "${resultFile.replace(/\\/g, '\\\\')}"

try {
    Add-Type -AssemblyName "System.Runtime.WindowsRuntime"
    [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
    [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] | Out-Null
    
    $arInstalled = $false
    $enInstalled = $false
    
    try {
        $arEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("ar-SA"))
        $arInstalled = $null -ne $arEngine
    } catch {}
    
    try {
        $enEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
        $enInstalled = $null -ne $enEngine
    } catch {}
    
    "ar:$arInstalled" | Out-File -FilePath $resultFile -Encoding UTF8
    "en:$enInstalled" | Out-File -FilePath $resultFile -Encoding UTF8 -Append
} catch {
    "ERROR:$($_.Exception.Message)" | Out-File -FilePath $resultFile -Encoding UTF8
}
`;

    fs.writeFileSync(scriptFile, scriptContent, 'utf8');

    return new Promise((resolve) => {
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptFile}"`,
            { encoding: 'utf8', timeout: 30000 },
            async (error, stdout, stderr) => {
                // Clean up script file
                try { fs.unlinkSync(scriptFile); } catch (e) { }

                if (error) {
                    console.error('OCR check PowerShell error:', error.message);
                }
                if (stderr) {
                    console.error('OCR check stderr:', stderr);
                }

                // Read result file
                let result = { ar: false, en: false };
                try {
                    await new Promise(r => setTimeout(r, 200));
                    if (fs.existsSync(resultFile)) {
                        const content = fs.readFileSync(resultFile, 'utf8').trim();
                        console.log('OCR check result file content:', content);
                        fs.unlinkSync(resultFile);

                        if (content.includes('ar:True')) result.ar = true;
                        if (content.includes('en:True')) result.en = true;
                    } else {
                        console.log('OCR check result file not found:', resultFile);
                    }
                } catch (e) {
                    console.error('Error reading OCR check result:', e);
                }

                console.log('OCR languages detected:', result);
                resolve(result);
            }
        );
    });
}

/**
 * Install OCR language pack (requires admin privileges)
 * @param {string} langCode - 'ar' or 'en'
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<boolean>}
 */
async function installOcrLanguage(langCode, onProgress) {
    const winLangCode = OCR_LANGUAGES[langCode];
    if (!winLangCode) {
        throw new Error(`Unknown language code: ${langCode} `);
    }

    const tempDir = os.tmpdir();
    const scriptFile = path.join(tempDir, `ocr_install_${Date.now()}.ps1`);
    const resultFile = path.join(tempDir, `ocr_install_result_${Date.now()}.txt`);
    const startedFile = path.join(tempDir, `ocr_install_started_${Date.now()}.txt`);

    // Create PowerShell script file - writes 'started' marker immediately when UAC is accepted
    const scriptContent = `
$ErrorActionPreference = 'Stop'
$resultFile = "${resultFile.replace(/\\/g, '\\\\')}"
$startedFile = "${startedFile.replace(/\\/g, '\\\\')}"

# Write started marker immediately (indicates UAC was accepted)
"STARTED" | Out-File -FilePath $startedFile -Encoding UTF8

try {
    $capability = "Language.OCR~~~${winLangCode}~0.0.1.0"
    
    # Check if already installed
    $state = Get-WindowsCapability -Online -Name $capability

    if ($state.State -eq 'Installed') {
        "SUCCESS:Already installed" | Out-File -FilePath $resultFile -Encoding UTF8
        exit 0
    }
    
    # Install the capability
    Add-WindowsCapability -Online -Name $capability | Out-Null
    
    # Verify installation
    $state = Get-WindowsCapability -Online -Name $capability
    if ($state.State -eq 'Installed') {
        "SUCCESS:Installed" | Out-File -FilePath $resultFile -Encoding UTF8
    } else {
        "FAILED:Installation did not complete" | Out-File -FilePath $resultFile -Encoding UTF8
    }
} catch {
    "FAILED:$($_.Exception.Message)" | Out-File -FilePath $resultFile -Encoding UTF8
}
`;

    return new Promise((resolve, reject) => {
        // Write script to temp file
        fs.writeFileSync(scriptFile, scriptContent, 'utf8');

        if (onProgress) {
            onProgress(10, 'Requesting admin privileges...');
        }

        // Poll for 'started' marker file to detect UAC acceptance
        let uacAccepted = false;
        const pollInterval = setInterval(() => {
            if (fs.existsSync(startedFile)) {
                uacAccepted = true;
                clearInterval(pollInterval);
                try { fs.unlinkSync(startedFile); } catch (e) { }
                if (onProgress) {
                    onProgress(30, 'Downloading from Windows Update...');
                }
            }
        }, 1000);

        // Run the script with elevation using Start-Process -Wait -WindowStyle Hidden
        const command = `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptFile}"'`;

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "${command}"`,
            { encoding: 'utf8', timeout: 300000 }, // 5 minute timeout
            async (error, stdout, stderr) => {
                // Stop polling
                clearInterval(pollInterval);
                try { fs.unlinkSync(startedFile); } catch (e) { }

                // Clean up script file
                try { fs.unlinkSync(scriptFile); } catch (e) { }

                if (onProgress) {
                    onProgress(90, 'Verifying installation...');
                }

                // Check result file
                let result = '';
                try {
                    // Wait a moment for file to be written
                    await new Promise(r => setTimeout(r, 500));

                    if (fs.existsSync(resultFile)) {
                        result = fs.readFileSync(resultFile, 'utf8').trim();
                        fs.unlinkSync(resultFile);
                    }
                } catch (e) {
                    console.error('Error reading result file:', e);
                }

                if (result.startsWith('SUCCESS:')) {
                    if (onProgress) onProgress(100, 'Complete');
                    resolve(true);
                } else if (result.startsWith('FAILED:')) {
                    const errorMsg = result.substring(7);
                    reject(new Error(errorMsg));
                } else {
                    // No result file - might have been cancelled or failed silently
                    // Double-check by verifying installation
                    const langs = await checkOcrLanguages();
                    const installed = langCode === 'ar' ? langs.ar : langs.en;

                    if (installed) {
                        if (onProgress) onProgress(100, 'Complete');
                        resolve(true);
                    } else {
                        reject(new Error('Installation was cancelled or failed'));
                    }
                }
            }
        );
    });
}

/**
 * Perform OCR on an image using OcrTool.exe (C# Windows OCR)
 * @param {Buffer} imageBuffer - Image data as Buffer
 * @param {string} language - Language code ('ar', 'en', or 'ar+en')
 * @returns {Promise<string>} - Extracted text
 */
async function performOcr(imageBuffer, language = 'ar') {
    // Save image to temp file
    const tempDir = os.tmpdir();
    const tempImageFile = path.join(tempDir, `ocr_image_${Date.now()}.png`);
    const tempResultFile = path.join(tempDir, `ocr_result_${Date.now()}.txt`);

    fs.writeFileSync(tempImageFile, imageBuffer);

    // Determine which language to use
    let ocrLang = 'ar-SA'; // Default to Arabic
    if (language === 'en') {
        ocrLang = 'en-US';
    }

    // Path to OcrTool.exe (in ocr-tool/publish folder, or bundled with app)
    let ocrToolPath;
    if (app.isPackaged) {
        // In production, it's in the resources folder (extraResources)
        ocrToolPath = path.join(process.resourcesPath, 'ocr-tool', 'OcrTool.exe');
    } else {
        // In development, it's in the local source folder
        ocrToolPath = path.join(__dirname, 'ocr-tool', 'publish', 'OcrTool.exe');
    }

    return new Promise((resolve, reject) => {
        console.log('Running OCR Tool from:', ocrToolPath); // Debug log

        exec(`"${ocrToolPath}" "${tempImageFile}" "${tempResultFile}" "${ocrLang}"`,
            { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 60000, windowsHide: true },
            async (error, stdout, stderr) => {
                // Clean up temp image file
                try { fs.unlinkSync(tempImageFile); } catch (e) { }

                // Read result file
                let result = '';
                try {
                    await new Promise(r => setTimeout(r, 100));
                    if (fs.existsSync(tempResultFile)) {
                        result = fs.readFileSync(tempResultFile, 'utf8').trim();
                        fs.unlinkSync(tempResultFile);
                    }
                } catch (e) {
                    console.error('Error reading OCR result file:', e);
                }

                if (result.startsWith('TEXT:')) {
                    let text = result.substring(5).trim();

                    // For Arabic, reverse word order within each line for correct RTL reading
                    if (ocrLang === 'ar-SA' && text) {
                        text = text.split('\n').map(line => {
                            if (/[\u0600-\u06FF]/.test(line)) {
                                return line.split(/\s+/).reverse().join(' ');
                            }
                            return line;
                        }).join('\n');
                    }

                    resolve(text);
                } else if (result.startsWith('ERROR:')) {
                    const errorMsg = result.substring(6).trim();
                    // Check if it's a language not installed error
                    if (errorMsg.includes('not available') || errorMsg.includes('OCR engine')) {
                        const langName = ocrLang === 'ar-SA' ? 'Arabic' : 'English';
                        reject(new Error(`OCR_LANG_NOT_INSTALLED:${langName}`));
                    } else {
                        reject(new Error(errorMsg));
                    }
                } else if (error) {
                    console.error('OCR tool error:', error.message);
                    console.error('stderr:', stderr);
                    // Check if it's related to language not installed
                    if (error.message.includes('not available') || stderr.includes('not available')) {
                        const langName = ocrLang === 'ar-SA' ? 'Arabic' : 'English';
                        reject(new Error(`OCR_LANG_NOT_INSTALLED:${langName}`));
                    } else {
                        reject(new Error(`OCR processing failed: ${error.message}`));
                    }
                } else {
                    // No result found
                    resolve('');
                }
            }
        );
    });
}
/**
 * Uninstall OCR language pack (requires admin privileges)
 * @param {string} langCode - 'ar' or 'en'
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<boolean>}
 */
async function uninstallOcrLanguage(langCode, onProgress) {
    const winLangCode = OCR_LANGUAGES[langCode];
    if (!winLangCode) {
        throw new Error(`Unknown language code: ${langCode}`);
    }

    const tempDir = os.tmpdir();
    const scriptFile = path.join(tempDir, `ocr_uninstall_${Date.now()}.ps1`);
    const resultFile = path.join(tempDir, `ocr_uninstall_result_${Date.now()}.txt`);

    // Create PowerShell script file
    const scriptContent = `
$ErrorActionPreference = 'Stop'
$resultFile = "${resultFile.replace(/\\/g, '\\\\')}"

try {
    $capability = "Language.OCR~~~${winLangCode}~0.0.1.0"
    
    # Check if installed
    $state = Get-WindowsCapability -Online -Name $capability
    
    if ($state.State -ne 'Installed') {
        "SUCCESS:Not installed" | Out-File -FilePath $resultFile -Encoding UTF8
        exit 0
    }
    
    # Remove the capability
    Remove-WindowsCapability -Online -Name $capability | Out-Null
    
    # Verify removal
    $state = Get-WindowsCapability -Online -Name $capability
    if ($state.State -ne 'Installed') {
        "SUCCESS:Removed" | Out-File -FilePath $resultFile -Encoding UTF8
    } else {
        "FAILED:Removal did not complete" | Out-File -FilePath $resultFile -Encoding UTF8
    }
} catch {
    "FAILED:$($_.Exception.Message)" | Out-File -FilePath $resultFile -Encoding UTF8
}
`;

    return new Promise((resolve, reject) => {
        // Write script to temp file
        fs.writeFileSync(scriptFile, scriptContent, 'utf8');

        if (onProgress) {
            onProgress(10, 'Requesting admin privileges...');
        }

        // Run the script with elevation
        const command = `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptFile}"'`;

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "${command}"`,
            { encoding: 'utf8', timeout: 300000 },
            async (error, stdout, stderr) => {
                // Clean up script file
                try { fs.unlinkSync(scriptFile); } catch (e) { }

                if (onProgress) {
                    onProgress(90, 'Verifying removal...');
                }

                // Check result file
                let result = '';
                try {
                    await new Promise(r => setTimeout(r, 500));

                    if (fs.existsSync(resultFile)) {
                        result = fs.readFileSync(resultFile, 'utf8').trim();
                        fs.unlinkSync(resultFile);
                    }
                } catch (e) {
                    console.error('Error reading result file:', e);
                }

                if (result.startsWith('SUCCESS:')) {
                    if (onProgress) onProgress(100, 'Complete');
                    resolve(true);
                } else if (result.startsWith('FAILED:')) {
                    const errorMsg = result.substring(7);
                    reject(new Error(errorMsg));
                } else {
                    // Double-check by verifying removal
                    const langs = await checkOcrLanguages();
                    const stillInstalled = langCode === 'ar' ? langs.ar : langs.en;

                    if (!stillInstalled) {
                        if (onProgress) onProgress(100, 'Complete');
                        resolve(true);
                    } else {
                        reject(new Error('Removal was cancelled or failed'));
                    }
                }
            }
        );
    });
}

module.exports = {
    checkOcrLanguages,
    installOcrLanguage,
    uninstallOcrLanguage,
    performOcr,
    OCR_LANGUAGES
};
