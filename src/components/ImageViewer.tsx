import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Trash2, ImagePlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface ImageViewerProps {
    images: Blob[];
    onClose: () => void;
    onDeleteImage?: (imageIndex: number) => void;
    onAddImages?: (files: File[], currentIndex: number) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ images, onClose, onDeleteImage, onAddImages }) => {
    const { dir } = useLanguage();
    const isRtl = dir === 'rtl';

    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const [showControls, setShowControls] = useState(true);
    const [isClosing, setIsClosing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Dynamic button positions
    // In LTR: prevBtn is Left, nextBtn is Right
    // In RTL: we keep physical positions (Left/Right) but swap functionality?
    // User said: "arrow show be on the right side to go to the next image" -> Confusing.
    // Standard RTL: Left Button = Next, Right Button = Prev.
    // Let's implement Standard RTL first.

    // We will call the Left Button "SideA" and Right Button "SideB" physically.
    const [leftBtnStyle, setLeftBtnStyle] = useState<React.CSSProperties>({});
    const [rightBtnStyle, setRightBtnStyle] = useState<React.CSSProperties>({});

    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Prevent background scroll when wheel events occur on the overlay
    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const preventScroll = (e: WheelEvent) => {
            e.preventDefault();
        };

        overlay.addEventListener('wheel', preventScroll, { passive: false });
        return () => {
            overlay.removeEventListener('wheel', preventScroll);
        };
    }, [imageUrl]);

    useEffect(() => {
        // Close the viewer if there are no images left
        if (!images || images.length === 0) {
            onClose();
            return;
        }

        // Adjust currentIndex if it's out of bounds (e.g., after deleting the last image)
        if (currentIndex >= images.length) {
            setCurrentIndex(images.length - 1);
            return;
        }

        const blob = images[currentIndex];
        const url = URL.createObjectURL(blob);
        setImageUrl(url);

        // Reset zoom/pan when changing images
        setScale(1);
        setPosition({ x: 0, y: 0 });

        document.body.style.overflow = 'hidden';

        return () => {
            URL.revokeObjectURL(url);
            document.body.style.overflow = 'unset';
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [images, currentIndex, onClose]);

    // Update button positions based on image rect
    useLayoutEffect(() => {
        if (!imageRef.current || !imageUrl) return;

        const updateButtons = () => {
            const rect = imageRef.current?.getBoundingClientRect();
            if (!rect) return;

            const padding = 20; // min distance from screen edge
            const offset = 60; // distance from image edge

            // Physical Left Button Position
            const leftPos = Math.max(padding, rect.left - offset);

            // Physical Right Button Position
            const rightPos = Math.min(window.innerWidth - padding - 40, rect.right + (offset - 40));

            setLeftBtnStyle({
                left: `${leftPos}px`,
                // Keep vertical center fixed to screen for stability, or `rect.top + rect.height / 2` 
                // Using fixed 50% is safer for UX as targets don't jump vertically during pan
                top: '50%',
                transform: 'translateY(-50%)'
            });

            setRightBtnStyle({
                left: `${rightPos}px`,
                top: '50%',
                transform: 'translateY(-50%)'
            });
        };

        // Run immediately
        updateButtons();

        // And on resize
        window.addEventListener('resize', updateButtons);
        return () => window.removeEventListener('resize', updateButtons);
    }, [scale, position, imageUrl, currentIndex]);

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex < images.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    // Determine functionality based on direction
    // LTR: LeftButton = Prev, RightButton = Next
    // RTL: LeftButton = Next, RightButton = Prev
    const onLeftClick = isRtl ? handleNext : handlePrev;
    const onRightClick = isRtl ? handlePrev : handleNext;

    // Determine visibility conditions
    // LeftClick (Next or Prev) should be visible if...
    // If isRtl: Left is Next. Visible if currentIndex < length - 1
    // If !isRtl: Left is Prev. Visible if currentIndex > 0
    const showLeftBtn = isRtl ? (currentIndex < images.length - 1) : (currentIndex > 0);
    const showRightBtn = isRtl ? (currentIndex > 0) : (currentIndex < images.length - 1);

    const handleMouseMoveControl = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 1500);
    };

    useEffect(() => {
        handleMouseMoveControl();
        window.addEventListener('mousemove', handleMouseMoveControl);

        // Keyboard navigation
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                if (isRtl) {
                    // Right arrow = Previous image in RTL
                    if (currentIndex > 0) setCurrentIndex(c => c - 1);
                } else {
                    // Right arrow = Next image in LTR
                    if (currentIndex < images.length - 1) setCurrentIndex(c => c + 1);
                }
            } else if (e.key === 'ArrowLeft') {
                if (isRtl) {
                    // Left arrow = Next image in RTL
                    if (currentIndex < images.length - 1) setCurrentIndex(c => c + 1);
                } else {
                    // Left arrow = Previous image in LTR
                    if (currentIndex > 0) setCurrentIndex(c => c - 1);
                }
            } else if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMoveControl);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentIndex, images.length, isRtl]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.5, scale + delta), 5);

        const rect = imageRef.current?.getBoundingClientRect();
        if (!rect) return;

        const cursorX = e.clientX - window.innerWidth / 2 - position.x;
        const cursorY = e.clientY - window.innerHeight / 2 - position.y;

        const scaleRatio = newScale / scale;

        const newX = position.x - cursorX * (scaleRatio - 1);
        const newY = position.y - cursorY * (scaleRatio - 1);

        setScale(newScale);
        setPosition({ x: newX, y: newY });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleDragMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    if (!imageUrl) return null;

    const content = (
        <div
            ref={overlayRef}
            className={`image-viewer-overlay ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onWheel={handleWheel}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={(e) => {
                if (isDragging) handleDragMove(e);
            }}
        // Force dir ltr for the overlay wrapper itself so that coordinate calculations work predictably?
        // Actually 'thumbnail-strip' needs RTL.
        // Let's allow inheritance but be careful with physical positioning styled with 'left'.
        >
            <div
                className="absolute inset-0"
                onClick={() => { if (!isDragging) handleClose(); }}
            />

            {/* Navigation Arrows - Physical Left */}
            {showLeftBtn && (
                <button
                    className={`nav-btn ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ ...leftBtnStyle, transition: 'opacity 0.3s, transform 0.2s, left 0.2s' }}
                    onClick={onLeftClick}
                >
                    {/* Icon: Always Left Chevron simply because it points Left? 
                        In RTL, Next is Left. A Left Pointing Arrow means "Go Left" (which is Next). Correct.
                    */}
                    <ChevronLeft size={24} />
                </button>
            )}

            {/* Navigation Arrows - Physical Right */}
            {showRightBtn && (
                <button
                    className={`nav-btn ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ ...rightBtnStyle, transition: 'opacity 0.3s, transform 0.2s, left 0.2s' }}
                    onClick={onRightClick}
                >
                    <ChevronRight size={24} />
                </button>
            )}

            {/* Controls */}
            <div className={`image-viewer-controls ${showControls ? 'visible' : 'hidden-controls'}`} dir="ltr" onClick={e => e.stopPropagation()}>
                <button className="icon-btn close-btn" onClick={handleClose}>
                    <X size={20} />
                </button>
                <button className="icon-btn" onClick={() => setScale(s => Math.max(s - 0.5, 0.5))}>
                    <ZoomOut size={20} />
                </button>
                <div style={{ color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center' }}>{Math.round(scale * 100)}%</div>
                <button className="icon-btn" onClick={() => setScale(s => Math.min(s + 0.5, 5))}>
                    <ZoomIn size={20} />
                </button>
                {onAddImages && (
                    <button
                        className="icon-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.accept = 'image/*';
                            input.onchange = (ev) => {
                                const files = Array.from((ev.target as HTMLInputElement).files || []);
                                if (files.length > 0) {
                                    onAddImages(files, currentIndex);
                                }
                            };
                            input.click();
                        }}
                        title="Add images"
                    >
                        <ImagePlus size={20} />
                    </button>
                )}
                {onDeleteImage && (
                    <button
                        className="icon-btn delete-image-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(true);
                        }}
                        title="Delete this image"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
            </div>

            {/* Main Image */}
            <div
                className={`image-viewer-content ${isClosing ? 'scale-out' : ''}`}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onClick={e => e.stopPropagation()}
            >
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={`Page ${currentIndex + 1}`}
                    draggable={false}
                    onLoad={() => {
                        // Force update of button pos when image loads and dimensions are known
                        const event = new Event('resize');
                        window.dispatchEvent(event);
                    }}
                />
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
                <div
                    className={`thumbnail-strip-container ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ transition: 'opacity 0.3s' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="thumbnail-strip">
                        {images.map((blob, idx) => (
                            <div
                                key={idx}
                                className={`thumbnail-item ${idx === currentIndex ? 'active' : ''}`}
                                onClick={() => setCurrentIndex(idx)}
                            >
                                <img src={URL.createObjectURL(blob)} alt={`Thumb ${idx}`} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
    return (
        <>
            {ReactDOM.createPortal(content, document.body)}
            <DeleteConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    if (onDeleteImage) {
                        onDeleteImage(currentIndex);
                    }
                    setShowDeleteConfirm(false);
                }}
            />
        </>
    );
};
