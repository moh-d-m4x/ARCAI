import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    title?: string;
    type?: NotificationType;
    buttonText?: string;
}

const iconMap = {
    info: { Icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/20' },
    success: { Icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/20' },
    warning: { Icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    error: { Icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/20' },
};

export const NotificationModal: React.FC<NotificationModalProps> = ({
    isOpen,
    onClose,
    message,
    title,
    type = 'info',
    buttonText
}) => {
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
        }, 300);
    };

    if (!isVisible && !isOpen) return null;

    const { Icon, color, bg } = iconMap[type];

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
                className={`delete-modal ${isClosing ? 'scale-out' : 'animate-scale-in'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`delete-modal-icon ${bg} ${color}`}>
                    <Icon size={32} />
                </div>

                {title && <h3 className="delete-modal-title">{title}</h3>}
                <p className="delete-modal-text">
                    {message}
                </p>

                <div className="delete-modal-actions" style={{ justifyContent: 'center' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleClose}
                        style={{ minWidth: '120px' }}
                    >
                        {buttonText || t('ok') || 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
