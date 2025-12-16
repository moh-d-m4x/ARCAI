import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { FileText, ArrowUpRight, ArrowDownLeft, Calendar, User, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PreviewDocument {
    type: string;
    subject?: string;
    reference_number?: string;
    document_date?: string;
    created_date?: string;
    sender?: string;
    receiver?: string;
    content_summary?: string;
}

interface ImportPreviewModalProps {
    isOpen: boolean;
    documents: PreviewDocument[];
    settingsCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
    isOpen,
    documents,
    settingsCount,
    onConfirm,
    onCancel
}) => {
    const { dir, t } = useLanguage();
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
            onCancel();
            setIsVisible(false);
        }, 300);
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
                className={`import-preview-modal ${isClosing ? 'scale-out' : 'animate-scale-in'}`}
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    width: '90%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--glass-border)'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{t('import_preview_title')}</h2>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Stats */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: 'rgba(var(--accent-rgb), 0.1)',
                    borderRadius: '8px'
                }}>
                    <span><strong>{documents.length}</strong> {t('documents_to_import')}</span>
                    {settingsCount > 0 && (
                        <span>• <strong>{settingsCount}</strong> Settings</span>
                    )}
                </div>

                {/* Documents List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    {documents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            {t('no_documents_found')}
                        </div>
                    ) : (
                        documents.map((doc, index) => (
                            <div
                                key={index}
                                className="glass-panel document-card"
                                style={{
                                    cursor: 'default',
                                    padding: '1rem',
                                    display: 'flex',
                                    gap: '1rem',
                                    alignItems: 'flex-start'
                                }}
                            >
                                <div className="doc-icon">
                                    {doc.type === 'Incoming' ? (
                                        <ArrowDownLeft className="text-blue-500" />
                                    ) : (
                                        <ArrowUpRight className="text-orange-500" />
                                    )}
                                </div>
                                <div className="doc-content" style={{ flex: 1 }}>
                                    <h3 className="doc-subject" style={{ margin: '0 0 0.5rem 0' }}>
                                        {doc.subject || t('no_subject')}
                                    </h3>
                                    <div className="doc-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        <span className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <FileText size={14} /> {doc.reference_number || '-'}
                                        </span>
                                        <span className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Calendar size={14} /> {doc.document_date || doc.created_date?.split('T')[0] || '-'}
                                        </span>
                                        <span className="meta-item" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <User size={14} />
                                            {typeof doc.sender === 'object' ? (doc.sender as any)?.organization || '-' : doc.sender || '-'}
                                            {dir === 'rtl' ? ' ← ' : ' → '}
                                            {typeof doc.receiver === 'object' ? (doc.receiver as any)?.organization || '-' : doc.receiver || '-'}
                                        </span>
                                    </div>
                                    {doc.content_summary && (
                                        <p className="doc-summary" style={{
                                            margin: '0.5rem 0 0 0',
                                            fontSize: '0.9rem',
                                            color: 'var(--text-secondary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}>
                                            {doc.content_summary}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        className="btn btn-outline"
                        onClick={handleClose}
                        style={{ minWidth: '120px' }}
                    >
                        {t('cancel')}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        style={{ minWidth: '120px' }}
                        disabled={documents.length === 0}
                    >
                        {t('confirm_import')}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
