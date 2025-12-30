import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type SelectionMode = 'rectangle' | 'freeform';

interface SelectionPoint {
    x: number;
    y: number;
}

interface ScreenCaptureOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageBlob: Blob, fieldName: string) => void;
    fieldName: string;
    imageFile: File | null;
}

export const ScreenCaptureOverlay: React.FC<ScreenCaptureOverlayProps> = ({
    isOpen,
    onClose,
    onCapture,
    fieldName,
    imageFile
}) => {
    const { t } = useLanguage();
    const [selectionMode, setSelectionMode] = useState<SelectionMode>('rectangle');
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<SelectionPoint | null>(null);
    const [currentPoint, setCurrentPoint] = useState<SelectionPoint | null>(null);
    const [freeformPoints, setFreeformPoints] = useState<SelectionPoint[]>([]);
    const [isClosing, setIsClosing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Zoom state
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Load image when file changes
    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setImageUrl(url);
            // Reset zoom when image changes
            setScale(1);
            setPosition({ x: 0, y: 0 });
            return () => URL.revokeObjectURL(url);
        }
    }, [imageFile]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen]);

    // Auto-focus overlay on mount so wheel events work immediately
    useEffect(() => {
        if (isOpen && overlayRef.current) {
            overlayRef.current.focus();
        }
    }, [isOpen]);

    // Prevent background scroll and handle zoom with wheel - zoom toward cursor
    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay || !isOpen) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const delta = -e.deltaY * 0.001;

            setScale(prevScale => {
                const newScale = Math.min(Math.max(0.5, prevScale + delta), 5);

                // Zoom toward cursor position
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const scaleRatio = newScale / prevScale;

                    setPosition(prevPos => {
                        const cursorX = e.clientX - rect.left - rect.width / 2 - prevPos.x;
                        const cursorY = e.clientY - rect.top - rect.height / 2 - prevPos.y;
                        return {
                            x: prevPos.x - cursorX * (scaleRatio - 1),
                            y: prevPos.y - cursorY * (scaleRatio - 1)
                        };
                    });
                }

                return newScale;
            });
        };

        overlay.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            overlay.removeEventListener('wheel', handleWheel);
        };
    }, [isOpen]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            setIsDrawing(false);
            setStartPoint(null);
            setCurrentPoint(null);
            setFreeformPoints([]);
            setScale(1);
            setPosition({ x: 0, y: 0 });
            onClose();
        }, 250);
    }, [onClose]);

    // Get mouse position in canvas internal coordinates
    // The canvas wrapper is scaled via CSS transform, so getBoundingClientRect returns scaled coords
    // We need to divide by scale to get actual canvas internal coordinates
    const getMousePosition = (e: React.MouseEvent): SelectionPoint | null => {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        // Convert from scaled screen space to canvas internal coordinates
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Middle mouse button (button === 1) for panning
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
            return;
        }

        if (e.button !== 0) return; // Only left click for drawing

        const pos = getMousePosition(e);
        if (!pos) return;

        setIsDrawing(true);
        setStartPoint(pos);
        setCurrentPoint(pos);

        if (selectionMode === 'freeform') {
            setFreeformPoints([pos]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPosition({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        if (!isDrawing) return;
        const pos = getMousePosition(e);
        if (!pos) return;

        setCurrentPoint(pos);

        if (selectionMode === 'freeform') {
            setFreeformPoints(prev => [...prev, pos]);
        }
    };

    const handleMouseUp = async (e: React.MouseEvent) => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (!isDrawing || !startPoint) return;
        const endPos = getMousePosition(e);
        if (!endPos) return;

        setIsDrawing(false);

        // Capture the selected region
        await captureSelection(startPoint, endPos);
    };

    const captureSelection = async (start: SelectionPoint, end: SelectionPoint) => {
        if (!canvasRef.current || !imageFile) return;

        const canvas = canvasRef.current;
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        // Load the actual full-resolution image
        const fullImage = new Image();
        fullImage.src = imageUrl!;

        await new Promise(resolve => {
            fullImage.onload = resolve;
        });

        const naturalWidth = fullImage.naturalWidth;
        const naturalHeight = fullImage.naturalHeight;

        // Calculate scale factors from canvas (display) to natural image size
        const scaleX = naturalWidth / canvasWidth;
        const scaleY = naturalHeight / canvasHeight;

        // Calculate selection bounds in full resolution
        let x, y, width, height;

        if (selectionMode === 'rectangle') {
            x = Math.min(start.x, end.x) * scaleX;
            y = Math.min(start.y, end.y) * scaleY;
            width = Math.abs(end.x - start.x) * scaleX;
            height = Math.abs(end.y - start.y) * scaleY;
        } else {
            // For freeform, get bounding box
            const allX = freeformPoints.map(p => p.x);
            const allY = freeformPoints.map(p => p.y);
            const minX = Math.min(...allX);
            const maxX = Math.max(...allX);
            const minY = Math.min(...allY);
            const maxY = Math.max(...allY);

            x = minX * scaleX;
            y = minY * scaleY;
            width = (maxX - minX) * scaleX;
            height = (maxY - minY) * scaleY;
        }

        // Minimum selection size check
        if (width < 10 || height < 10) {
            console.log('Selection too small, ignoring');
            handleClose();
            return;
        }

        // Create output canvas to extract the region at full resolution
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = width;
        outputCanvas.height = height;
        const ctx = outputCanvas.getContext('2d');

        if (!ctx) {
            console.error('Could not get canvas context');
            return;
        }

        // Draw the selected region from the full resolution image
        ctx.drawImage(
            fullImage,
            x, y, width, height,  // Source rectangle
            0, 0, width, height   // Destination rectangle
        );

        // If freeform, mask outside the selection
        if (selectionMode === 'freeform' && freeformPoints.length > 2) {
            // Create a mask canvas
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = width;
            maskCanvas.height = height;
            const maskCtx = maskCanvas.getContext('2d');

            if (maskCtx) {
                // Fill with white (will be the masked area)
                maskCtx.fillStyle = 'white';
                maskCtx.fillRect(0, 0, width, height);

                // Draw the freeform shape as transparent
                maskCtx.globalCompositeOperation = 'destination-out';
                maskCtx.beginPath();
                const scaledPoints = freeformPoints.map(p => ({
                    x: (p.x - Math.min(...freeformPoints.map(fp => fp.x))) * scaleX,
                    y: (p.y - Math.min(...freeformPoints.map(fp => fp.y))) * scaleY
                }));
                maskCtx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
                scaledPoints.forEach(p => maskCtx.lineTo(p.x, p.y));
                maskCtx.closePath();
                maskCtx.fill();

                // Apply mask to main canvas
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage(maskCanvas, 0, 0);
                ctx.globalCompositeOperation = 'source-over';
            }
        }

        // Convert to high-quality PNG blob for OCR
        outputCanvas.toBlob(
            (blob) => {
                if (blob) {
                    onCapture(blob, fieldName);
                }
                handleClose();
            },
            'image/png',
            1.0 // Maximum quality
        );
    };

    // Draw selection overlay on canvas
    useEffect(() => {
        if (!canvasRef.current || !imageRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Match canvas size to scaled image
        const img = imageRef.current;
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!isDrawing || !startPoint || !currentPoint) return;

        // Draw selection (points are already in canvas coordinates)
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (selectionMode === 'rectangle') {
            const x = Math.min(startPoint.x, currentPoint.x);
            const y = Math.min(startPoint.y, currentPoint.y);
            const width = Math.abs(currentPoint.x - startPoint.x);
            const height = Math.abs(currentPoint.y - startPoint.y);

            // Draw semi-transparent fill
            ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
            ctx.fillRect(x, y, width, height);

            // Draw border
            ctx.strokeRect(x, y, width, height);
        } else if (freeformPoints.length > 1) {
            // Draw freeform path
            ctx.beginPath();
            ctx.moveTo(freeformPoints[0].x, freeformPoints[0].y);
            freeformPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();

            // Fill freeform shape
            ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
            ctx.beginPath();
            ctx.moveTo(freeformPoints[0].x, freeformPoints[0].y);
            freeformPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.fill();
        }
    }, [isDrawing, startPoint, currentPoint, freeformPoints, selectionMode]);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

    if (!isOpen || !imageUrl) return null;

    return ReactDOM.createPortal(
        <div
            ref={overlayRef}
            tabIndex={-1}
            className={`screen-capture-overlay ${isClosing ? 'animate-exit' : 'animate-enter'}`}
            style={{ outline: 'none' }}
        >
            {/* Top Toolbar - Centered */}
            <div className="capture-toolbar">
                <button className="capture-close-btn" onClick={handleClose}>
                    <X size={20} />
                </button>

                <div className="capture-toolbar-center">
                    <div className="capture-mode-selector">
                        <label>{t('capture_mode_label') || 'Selection Mode:'}</label>
                        <select
                            value={selectionMode}
                            onChange={(e) => setSelectionMode(e.target.value as SelectionMode)}
                        >
                            <option value="rectangle">{t('capture_mode_rectangle') || 'Rectangle'}</option>
                            <option value="freeform">{t('capture_mode_freeform') || 'Freeform'}</option>
                        </select>
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="capture-zoom-controls">
                    <button className="capture-zoom-btn" onClick={handleZoomOut} title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                    <span className="capture-zoom-level">{Math.round(scale * 100)}%</span>
                    <button className="capture-zoom-btn" onClick={handleZoomIn} title="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                </div>
            </div>

            {/* Image Container with Selection Canvas */}
            <div
                className="capture-image-container"
                ref={containerRef}
            >
                <div
                    className="capture-image-wrapper"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center center'
                    }}
                >
                    <img
                        ref={imageRef}
                        src={imageUrl}
                        alt="Document for capture"
                        className="capture-image"
                        draggable={false}
                    />
                    <canvas
                        ref={canvasRef}
                        className="capture-canvas"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={() => {
                            if (isPanning) setIsPanning(false);
                            if (isDrawing && startPoint && currentPoint) {
                                captureSelection(startPoint, currentPoint);
                            }
                        }}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};
