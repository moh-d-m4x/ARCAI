import React, { useEffect, useState } from 'react';
import type { ArcaiDocument } from '../types';
import { FileText } from 'lucide-react';

interface DocumentThumbnailProps {
    doc: ArcaiDocument;
}

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({ doc }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (doc.image_data) {
            const url = URL.createObjectURL(doc.image_data);
            setImageUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [doc.image_data]);

    if (!imageUrl) {
        return (
            <div className="doc-thumbnail-placeholder">
                <FileText size={24} className="text-gray-400" />
            </div>
        );
    }

    return (
        <div className="doc-thumbnail-container">
            <img src={imageUrl} alt="Document Preview" className="doc-thumbnail-img" />
        </div>
    );
};
