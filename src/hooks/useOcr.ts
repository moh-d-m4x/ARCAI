import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface UseOcrOptions {
    onTextExtracted: (fieldName: string, text: string) => void;
    showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const useOcr = ({ onTextExtracted, showNotification }: UseOcrOptions) => {
    const { t } = useLanguage();
    const [captureFieldName, setCaptureFieldName] = useState<string | null>(null);

    const openCapture = (fieldName: string) => {
        const electronAPI = (window as unknown as {
            electronAPI?: { isElectron: boolean }
        }).electronAPI;

        if (!electronAPI) {
            showNotification(t('ocr_pc_only'), 'warning');
            return;
        }

        setCaptureFieldName(fieldName);
    };

    const handleCapture = async (imageBlob: Blob, fieldName: string) => {
        const electronAPI = (window as unknown as {
            electronAPI?: {
                extractText: (imageBase64: string, language: string) => Promise<{ success: boolean; text: string; error?: string }>;
            }
        }).electronAPI;

        if (!electronAPI) {
            showNotification(t('ocr_pc_only'), 'warning');
            return;
        }

        try {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
            });
            reader.readAsDataURL(imageBlob);
            const imageBase64 = await base64Promise;

            showNotification(t('ocr_extracting_text'), 'info');

            const ocrResult = await electronAPI.extractText(imageBase64, 'ar');

            if (ocrResult.success && ocrResult.text) {
                onTextExtracted(fieldName, ocrResult.text.trim());
                showNotification(t('ocr_success'), 'success');
            } else if (ocrResult.success && !ocrResult.text) {
                showNotification(t('ocr_no_text_found'), 'warning');
            } else {
                showNotification(`${t('ocr_failed')}: ${ocrResult.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('OCR error:', error);
            showNotification(`${t('ocr_error')}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    const closeCapture = () => {
        setCaptureFieldName(null);
    };

    const isElectron = !!(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron;

    return {
        captureFieldName,
        openCapture,
        handleCapture,
        closeCapture,
        isElectron
    };
};
