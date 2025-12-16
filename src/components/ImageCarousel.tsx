import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface ImageCarouselProps {
    files: File[];
    onDeleteImage?: (index: number) => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ files, onDeleteImage }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    // Generate and cleanup object URLs properly
    useEffect(() => {
        const urls = files.map(file => URL.createObjectURL(file));
        setImageUrls(urls);

        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files]);

    // Reset index if files change and index is out of bounds
    useEffect(() => {
        if (currentIndex >= files.length && files.length > 0) {
            setCurrentIndex(files.length - 1);
        }
    }, [files.length, currentIndex]);

    const handleDeleteCurrent = () => {
        if (onDeleteImage) {
            onDeleteImage(currentIndex);
            // Adjust index if we're deleting the last image
            if (currentIndex >= files.length - 1 && currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
            }
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev === 0 ? files.length - 1 : prev - 1));
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev === files.length - 1 ? 0 : prev + 1));
    };

    const handleDotClick = (index: number) => {
        setCurrentIndex(index);
    };

    if (files.length === 0 || imageUrls.length === 0) return null;

    return (
        <div className="carousel-container">
            {/* Main Image */}
            <img
                src={imageUrls[currentIndex]}
                alt={`Preview ${currentIndex + 1}`}
                className="carousel-image"
            />

            {/* Navigation Arrows - only show if multiple images */}
            {files.length > 1 && (
                <>
                    <button
                        className="carousel-nav carousel-nav-prev"
                        onClick={handlePrev}
                        aria-label="Previous image"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        className="carousel-nav carousel-nav-next"
                        onClick={handleNext}
                        aria-label="Next image"
                    >
                        <ChevronRight size={24} />
                    </button>
                </>
            )}

            {/* Counter Badge - use dir=ltr to prevent number reversal in RTL */}
            {files.length > 1 && (
                <div className="carousel-counter" dir="ltr">
                    {currentIndex + 1} / {files.length}
                </div>
            )}

            {/* Dot Indicators */}
            {files.length > 1 && (
                <div className="carousel-dots">
                    {files.map((_, index) => (
                        <button
                            key={index}
                            className={`carousel-dot ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => handleDotClick(index)}
                            aria-label={`Go to image ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Delete Button - top right corner */}
            {onDeleteImage && (
                <button className="carousel-delete-btn" onClick={handleDeleteCurrent} aria-label="Delete current image">
                    <Trash2 size={18} />
                </button>
            )}
        </div>
    );
};
