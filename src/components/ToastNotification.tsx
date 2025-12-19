import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastNotificationProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    type?: ToastType;
    duration?: number; // Duration in milliseconds, default 3000
}

const iconMap = {
    info: { Icon: Info, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    success: { Icon: CheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    warning: { Icon: AlertTriangle, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
    error: { Icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

const borderColorMap = {
    info: 'rgba(59, 130, 246, 0.3)',
    success: 'rgba(34, 197, 94, 0.3)',
    warning: 'rgba(234, 179, 8, 0.3)',
    error: 'rgba(239, 68, 68, 0.3)',
};

export const ToastNotification: React.FC<ToastNotificationProps> = ({
    isOpen,
    onClose,
    message,
    type = 'info',
    duration = 3000
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsExiting(false);

            // Auto-dismiss after duration
            const timer = setTimeout(() => {
                handleClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [isOpen, duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 300);
    };

    if (!isVisible && !isOpen) return null;

    const { Icon, color, bg } = iconMap[type];
    const borderColor = borderColorMap[type];

    const content = (
        <div
            className={`toast-notification ${isExiting ? 'toast-exit' : 'toast-enter'}`}
            style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: `translateX(-50%) ${isExiting ? 'translateY(-100px)' : 'translateY(0)'}`,
                zIndex: 10001,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 20px',
                borderRadius: '12px',
                background: 'var(--glass-bg, rgba(255, 255, 255, 0.95))',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${borderColor}`,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
                maxWidth: '90vw',
                minWidth: '280px',
                animation: isExiting ? 'toastSlideOut 0.3s ease-out forwards' : 'toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: bg,
                    flexShrink: 0,
                }}
            >
                <Icon size={20} style={{ color }} />
            </div>

            <span
                style={{
                    flex: 1,
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: 'var(--text-primary, #1a1a1a)',
                    lineHeight: 1.4,
                }}
            >
                {message}
            </span>

            <button
                onClick={handleClose}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-secondary, #666)',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                }}
            >
                <X size={16} />
            </button>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
