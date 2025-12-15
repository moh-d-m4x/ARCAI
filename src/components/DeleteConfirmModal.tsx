import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    const [isClosing, setIsClosing] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsClosing(false);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setIsVisible(false);
        }
    }, [isOpen]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsVisible(false);
        }, 300); // 300ms matches animation duration
    };

    const handleConfirm = () => {
        onConfirm();
        handleClose();
    };

    if (!isVisible && !isOpen) return null;

    const content = (
        <div className={`image-viewer-overlay flex items-center justify-center ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} style={{ zIndex: 10000 }}>
            <div
                className="absolute inset-0"
                onClick={handleClose}
            ></div>

            <div
                className={`delete-modal ${isClosing ? 'scale-out' : 'animate-scale-in'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="delete-modal-icon">
                    <AlertTriangle size={32} />
                </div>

                <h3 className="delete-modal-title">{t('delete_doc_btn')}</h3>
                <p className="delete-modal-text">
                    {t('delete_confirm')}
                </p>

                <div className="delete-modal-actions">
                    <button
                        className="btn btn-outline border-gray-300 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                        onClick={handleClose}
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        className="btn btn-primary bg-red-500 border-red-500 hover:bg-red-600 hover:border-red-600 text-white"
                        onClick={handleConfirm}
                    >
                        {t('delete_doc_btn')}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
