import React, { useEffect, useState, useRef } from 'react';
import type { ArcaiDocument } from '../types';
import { Upload } from 'lucide-react';

interface DocumentThumbnailProps {
    doc: ArcaiDocument;
    onAddImages?: (files: File[]) => void;
}

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({ doc, onAddImages }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (doc.image_data) {
            const url = URL.createObjectURL(doc.image_data);
            setImageUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        } else {
            setImageUrl(null);
        }
    }, [doc.image_data]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && onAddImages) {
            const selectedFiles = Array.from(e.target.files);
            onAddImages(selectedFiles);
        }
        // Reset input so user can select the same file again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    if (!imageUrl) {
        return (
            <label className="doc-thumbnail-placeholder">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    hidden
                />
                <Upload size={24} className="text-gray-400" />
            </label>
        );
    }

    return (
        <div className="doc-thumbnail-container">
            <img src={imageUrl} alt="Document Preview" className="doc-thumbnail-img" />
        </div>
    );
};
