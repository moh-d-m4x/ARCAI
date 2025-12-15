import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerProps {
    blob: Blob;
    onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ blob, onClose }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const [showControls, setShowControls] = useState(true);
    const [isClosing, setIsClosing] = useState(false); // New state for exit animation

    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        document.body.style.overflow = 'hidden';

        return () => {
            URL.revokeObjectURL(url);
            document.body.style.overflow = 'unset';
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [blob]);

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
        return () => window.removeEventListener('mousemove', handleMouseMoveControl);
    }, []);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300); // Match animation duration
    };

    const handleWheel = (e: React.WheelEvent) => {
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
            className={`image-viewer-overlay ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onWheel={handleWheel}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={(e) => {
                if (isDragging) handleDragMove(e);
            }}
        >
            <div
                className="absolute inset-0"
                onClick={() => { if (!isDragging) handleClose(); }}
            />

            <div className={`image-viewer-controls ${showControls ? 'visible' : 'hidden-controls'}`} onClick={e => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => setScale(s => Math.min(s + 0.5, 5))}>
                    <ZoomIn size={20} />
                </button>
                <div style={{ color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center' }}>{Math.round(scale * 100)}%</div>
                <button className="icon-btn" onClick={() => setScale(s => Math.max(s - 0.5, 0.5))}>
                    <ZoomOut size={20} />
                </button>
                <button className="icon-btn close-btn" onClick={handleClose}>
                    <X size={20} />
                </button>
            </div>

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
                    alt="Full Document"
                    draggable={false}
                />
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
