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
            performScan: (options: { scannerId: string; resolution: string; doubleSided: boolean }) => Promise<{ success: boolean; images: string[]; error?: string }>;
        };
    }
}

type Resolution = 'low' | 'mid' | 'high';

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
    const [resolution, setResolution] = useState<Resolution>('mid');
    const [doubleSided, setDoubleSided] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoadingScanners, setIsLoadingScanners] = useState(false);
    const [scannedImages, setScannedImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Load scanners when modal opens
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
                if (result.scanners.length > 0) {
                    setSelectedScanner(result.scanners[0].id);
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

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
            document.body.style.overflow = 'hidden';
            loadScanners();
        } else {
            document.body.style.overflow = 'unset';
            setIsVisible(false);
        }
    }, [isOpen, loadScanners]);

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
                doubleSided
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
                <div className="scanner-modal-content">
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
                                        onChange={(e) => setSelectedScanner(e.target.value)}
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
                                    onClick={loadScanners}
                                    disabled={isScanning || isLoadingScanners}
                                    title={t('refresh_scanners')}
                                >
                                    <RotateCw size={18} className={isLoadingScanners ? 'animate-spin' : ''} />
                                </button>
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
                                    disabled={isScanning}
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
                    <div className="scanner-preview">
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

                        <div className="scanner-preview-area">
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
