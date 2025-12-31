import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface OcrFieldWrapperProps {
    children: React.ReactNode;
    fieldName: string;
    onScanClick: (fieldName: string) => void;
    isElectron: boolean;
}

/**
 * Wrapper component that adds an OCR scan button to any input/textarea field.
 * Used in both Entry.tsx and DocumentInlineEdit.tsx for consistent OCR functionality.
 */
export const OcrFieldWrapper: React.FC<OcrFieldWrapperProps> = ({
    children,
    fieldName,
    onScanClick,
    isElectron
}) => {
    const { t } = useLanguage();

    return (
        <div className="ocr-field-wrapper">
            {children}
            {isElectron && (
                <button
                    className="ocr-select-btn"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onScanClick(fieldName);
                    }}
                    title={t('ocr_scan_field') || 'Scan text for this field'}
                    type="button"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 2H4a2 2 0 0 0-2 2v3" />
                        <path d="M17 2h3a2 2 0 0 1 2 2v3" />
                        <path d="M7 22H4a2 2 0 0 1-2-2v-3" />
                        <path d="M17 22h3a2 2 0 0 0 2-2v-3" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                </button>
            )}
        </div>
    );
};
