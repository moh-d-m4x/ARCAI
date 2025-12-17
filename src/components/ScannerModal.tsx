import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ScanLine, Loader2, Trash2, Save, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Type definition for Electron API
declare global {
    interface Window {
        electronAPI?: {
            isElectron: boolean;
            getScanners: () => Promise<{ success: boolean; scanners: { id: string; name: string }[]; error?: string }>;
            performScan: (options: { scannerId: string; resolution: string; doubleSided: boolean; source: 'auto' | 'feeder' | 'flatbed' }) => Promise<{ success: boolean; images: string[]; error?: string }>;
        };
    }
}

type Resolution = 'low' | 'mid' | 'high';
type ScanSource = 'auto' | 'feeder' | 'flatbed';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (images: File[]) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
    isOpen,
    onClose,
    onSave
}) => {
    const { t } = useLanguage();
    const [isClosing, setIsClosing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Scanner state
    const [scanners, setScanners] = useState<{ id: string; name: string }[]>([]);
    const [selectedScanner, setSelectedScanner] = useState<string>('');
    const [scanSource, setScanSource] = useState<ScanSource>('auto');
    const [resolution, setResolution] = useState<Resolution>('mid');
    const [doubleSided, setDoubleSided] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoadingScanners, setIsLoadingScanners] = useState(false);
    const [scannedImages, setScannedImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const SCANNER_STORAGE_KEY = 'lastUsedScanner';

    // Save scanner to localStorage when selected
    const handleScannerSelect = (scannerId: string) => {
        setSelectedScanner(scannerId);
        localStorage.setItem(SCANNER_STORAGE_KEY, scannerId);
        // Also save the scanner name for instant display
        const scanner = scanners.find(s => s.id === scannerId);
        if (scanner) {
            localStorage.setItem(SCANNER_STORAGE_KEY + '_name', scanner.name);
        }
    };

    // Load scanners from system
    const loadScanners = useCallback(async () => {
        if (!window.electronAPI) {
            setError(t('scanner_error_electron_required'));
            return;
        }

        setIsLoadingScanners(true);
        setError(null);

        try {
            const result = await window.electronAPI.getScanners();
            if (result.success) {
                setScanners(result.scanners);

                // Try to restore last used scanner
                const savedScannerId = localStorage.getItem(SCANNER_STORAGE_KEY);
                const savedScannerExists = savedScannerId && result.scanners.some(s => s.id === savedScannerId);

                if (savedScannerExists) {
                    setSelectedScanner(savedScannerId);
                } else if (result.scanners.length > 0) {
                    // Saved scanner not found, select first available
                    setSelectedScanner(result.scanners[0].id);
                    localStorage.setItem(SCANNER_STORAGE_KEY, result.scanners[0].id);
                }
            } else {
                setError(result.error || t('scan_error'));
            }
        } catch (err) {
            console.error('Error loading scanners:', err);
            setError(t('scan_error'));
        } finally {
            setIsLoadingScanners(false);
        }
    }, [t]);

    // Smart initialization: use cached scanner immediately, verify in background
    const initializeScanners = useCallback(async () => {
        if (!window.electronAPI) {
            setError(t('scanner_error_electron_required'));
            return;
        }

        const savedScannerId = localStorage.getItem(SCANNER_STORAGE_KEY);
        const savedScannerName = localStorage.getItem(SCANNER_STORAGE_KEY + '_name');

        // If we have a cached scanner, use it immediately without showing loading
        if (savedScannerId && savedScannerName) {
            setScanners([{ id: savedScannerId, name: savedScannerName }]);
            setSelectedScanner(savedScannerId);

            // Verify in background (silently) - don't show loading spinner
            try {
                const result = await window.electronAPI.getScanners();
                if (result.success) {
                    const foundScanner = result.scanners.find(s => s.id === savedScannerId);

                    if (foundScanner) {
                        // Scanner still connected - update list and ensure correct name is cached
                        setScanners(result.scanners);
                        // Update cached name in case it was wrong or missing
                        localStorage.setItem(SCANNER_STORAGE_KEY + '_name', foundScanner.name);
                    } else {
                        // Saved scanner disconnected - update list and select new one
                        setScanners(result.scanners);
                        if (result.scanners.length > 0) {
                            setSelectedScanner(result.scanners[0].id);
                            localStorage.setItem(SCANNER_STORAGE_KEY, result.scanners[0].id);
                            localStorage.setItem(SCANNER_STORAGE_KEY + '_name', result.scanners[0].name);
                        } else {
                            setSelectedScanner('');
                        }
                    }
                }
            } catch (err) {
                console.error('Error verifying scanner:', err);
                // Keep using cached scanner on error
            }
        } else {
            // No cached scanner - do full refresh with loading indicator
            setIsLoadingScanners(true);
            setError(null);

            try {
                const result = await window.electronAPI.getScanners();
                if (result.success) {
                    setScanners(result.scanners);
                    if (result.scanners.length > 0) {
                        setSelectedScanner(result.scanners[0].id);
                        localStorage.setItem(SCANNER_STORAGE_KEY, result.scanners[0].id);
                        localStorage.setItem(SCANNER_STORAGE_KEY + '_name', result.scanners[0].name);
                    }
                } else {
                    setError(result.error || t('scan_error'));
                }
            } catch (err) {
                console.error('Error loading scanners:', err);
                setError(t('scan_error'));
            } finally {
                setIsLoadingScanners(false);
            }
        }
    }, [t]);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
            document.body.style.overflow = 'hidden';
            initializeScanners();
        } else {
            document.body.style.overflow = 'unset';
            setIsVisible(false);
        }
    }, [isOpen, initializeScanners]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsVisible(false);
            // Reset state
            setScannedImages([]);
            setCurrentImageIndex(0);
            setError(null);
        }, 300);
    };

    const handleScan = async () => {
        if (!window.electronAPI || !selectedScanner) return;

        setIsScanning(true);
        setError(null);

        try {
            const result = await window.electronAPI.performScan({
                scannerId: selectedScanner,
                resolution,
                doubleSided,
                source: scanSource
            });

            if (result.success && result.images.length > 0) {
                setScannedImages(prev => [...prev, ...result.images]);
                setCurrentImageIndex(scannedImages.length);
            } else {
                setError(result.error || t('scan_error'));
            }
        } catch (err) {
            console.error('Scan error:', err);
            setError(t('scan_error'));
        } finally {
            setIsScanning(false);
        }
    };

    const handleSave = async () => {
        if (scannedImages.length === 0) return;

        // Convert base64 images to File objects
        const files: File[] = await Promise.all(
            scannedImages.map(async (base64, index) => {
                const response = await fetch(base64);
                const blob = await response.blob();
                return new File([blob], `scan_${Date.now()}_${index}.jpg`, { type: 'image/jpeg' });
            })
        );

        onSave(files);
        handleClose();
    };

    const handleClearImages = () => {
        setScannedImages([]);
        setCurrentImageIndex(0);
    };

    const handlePrevImage = () => {
        setCurrentImageIndex(prev => (prev === 0 ? scannedImages.length - 1 : prev - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex(prev => (prev === scannedImages.length - 1 ? 0 : prev + 1));
    };

    const handleDeleteCurrentImage = () => {
        const newImages = scannedImages.filter((_, i) => i !== currentImageIndex);
        setScannedImages(newImages);
        if (currentImageIndex >= newImages.length && newImages.length > 0) {
            setCurrentImageIndex(newImages.length - 1);
        }
    };

    if (!isVisible && !isOpen) return null;

    const content = (
        <div
            className={`image-viewer-overlay flex items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            style={{ zIndex: 10000 }}
        >
            <div
                className="absolute inset-0"
                onClick={handleClose}
            ></div>

            <div
                className={`scanner-modal ${isClosing ? 'scale-out' : 'animate-scale-in'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="scanner-modal-header">
                    <div className="delete-modal-icon bg-blue-500/20 text-blue-500">
                        <ScanLine size={32} />
                    </div>
                    <h3 className="delete-modal-title">{t('scanner_title')}</h3>
                </div>

                {/* Content */}
                <div className="scanner-modal-content" style={{ height: '470px' }}>
                    {/* Left: Scanner Options */}
                    <div className="scanner-options">
                        {/* Scanner Selection */}
                        <div className="scanner-option-group">
                            <label>{t('select_scanner')}</label>
                            <div className="scanner-select-container">
                                {isLoadingScanners ? (
                                    <div className="scanner-loading-inline">
                                        <Loader2 className="animate-spin" size={20} />
                                    </div>
                                ) : (
                                    <select
                                        value={selectedScanner}
                                        onChange={(e) => handleScannerSelect(e.target.value)}
                                        disabled={isScanning || scanners.length === 0}
                                        className="scanner-select"
                                    >
                                        {scanners.length === 0 ? (
                                            <option value="">{t('no_scanners')}</option>
                                        ) : (
                                            scanners.map(scanner => (
                                                <option key={scanner.id} value={scanner.id}>
                                                    {scanner.name}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                )}

                                <button
                                    className="btn-icon-only"
                                    onClick={() => loadScanners()}
                                    disabled={isScanning || isLoadingScanners}
                                    title={t('refresh_scanners')}
                                >
                                    <RotateCw size={18} className={isLoadingScanners ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        {/* Source Selection */}
                        <div className="scanner-option-group">
                            <label>{t('source')}</label>
                            <div className="resolution-buttons">
                                <select
                                    value={scanSource}
                                    onChange={(e) => setScanSource(e.target.value as ScanSource)}
                                    disabled={isScanning}
                                    className="scanner-select"
                                >
                                    <option value="auto">{t('source_auto')}</option>
                                    <option value="feeder">{t('source_feeder')}</option>
                                    <option value="flatbed">{t('source_flatbed')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Resolution */}
                        <div className="scanner-option-group">
                            <label>{t('resolution')}</label>
                            <div className="resolution-buttons">
                                <button
                                    className={`resolution-btn ${resolution === 'low' ? 'active' : ''}`}
                                    onClick={() => setResolution('low')}
                                    disabled={isScanning}
                                >
                                    {t('resolution_low')}
                                </button>
                                <button
                                    className={`resolution-btn ${resolution === 'mid' ? 'active' : ''}`}
                                    onClick={() => setResolution('mid')}
                                    disabled={isScanning}
                                >
                                    {t('resolution_mid')}
                                </button>
                                <button
                                    className={`resolution-btn ${resolution === 'high' ? 'active' : ''}`}
                                    onClick={() => setResolution('high')}
                                    disabled={isScanning}
                                >
                                    {t('resolution_high')}
                                </button>
                            </div>
                        </div>

                        {/* Double-sided */}
                        <div className="scanner-option-group">
                            <label className="scanner-checkbox">
                                <input
                                    type="checkbox"
                                    checked={doubleSided}
                                    onChange={(e) => setDoubleSided(e.target.checked)}
                                    disabled={isScanning || scanSource === 'flatbed'}
                                />
                                <span>{t('double_sided')}</span>
                            </label>
                        </div>

                        {/* Scan Button */}
                        <button
                            className="btn btn-primary scanner-scan-btn"
                            onClick={handleScan}
                            disabled={isScanning || scanners.length === 0}
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    {t('scanning')}
                                </>
                            ) : (
                                <>
                                    <ScanLine size={20} />
                                    {t('start_scan')}
                                </>
                            )}
                        </button>

                        {/* Error Message */}
                        {error && (
                            <div className="scanner-error">
                                {error}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="scanner-actions-inline">
                            <button
                                className="btn btn-outline"
                                onClick={handleClose}
                                disabled={isScanning}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isScanning || scannedImages.length === 0}
                            >
                                <Save size={18} />
                                {t('save_scanned')}
                            </button>
                        </div>
                    </div>

                    {/* Right: Preview Area */}
                    <div className="scanner-preview" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                        <div className="scanner-preview-header">
                            <h4>{t('scanned_images')} ({scannedImages.length})</h4>
                            {scannedImages.length > 0 && (
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={handleClearImages}
                                >
                                    {t('clear_scanned')}
                                </button>
                            )}
                        </div>

                        <div className="scanner-preview-area" style={{ flex: 1, minHeight: '500px' }}>
                            {scannedImages.length > 0 ? (
                                <div className="scanner-carousel">
                                    <img
                                        src={scannedImages[currentImageIndex]}
                                        alt={`Scan ${currentImageIndex + 1}`}
                                    />

                                    {/* Navigation */}
                                    {scannedImages.length > 1 && (
                                        <>
                                            <button
                                                className="carousel-nav carousel-nav-prev"
                                                onClick={handlePrevImage}
                                            >
                                                <ChevronLeft size={24} />
                                            </button>
                                            <button
                                                className="carousel-nav carousel-nav-next"
                                                onClick={handleNextImage}
                                            >
                                                <ChevronRight size={24} />
                                            </button>
                                        </>
                                    )}

                                    {/* Counter */}
                                    {scannedImages.length > 1 && (
                                        <div className="carousel-counter" dir="ltr">
                                            {currentImageIndex + 1} / {scannedImages.length}
                                        </div>
                                    )}

                                    {/* Delete button */}
                                    <button
                                        className="scanner-delete-btn"
                                        onClick={handleDeleteCurrentImage}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="scanner-preview-empty">
                                    <ScanLine size={48} className="text-gray-400" />
                                    <p>{t('no_scanned_images')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions Moved to scanner-options */}
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
