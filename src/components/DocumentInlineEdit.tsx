import React, { useState, useEffect } from 'react';
import type { ArcaiDocument } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../db';
import { Save, RotateCcw, Trash2 } from 'lucide-react';

import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NotificationModal } from './NotificationModal';

interface DocumentInlineEditProps {
    doc: ArcaiDocument;
}

export const DocumentInlineEdit: React.FC<DocumentInlineEditProps> = ({ doc }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<ArcaiDocument>>({});
    const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
    }>({ isOpen: false, message: '', type: 'info' });

    useEffect(() => {
        // Initialize form data from doc
        setFormData({ ...doc });
        setChangedFields(new Set());
    }, [doc]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Check against original doc
        const originalValue = (doc as any)[name] || '';
        // different check for null/undefined vs empty string equality if needed, 
        // but simple inequality is usually enough for form fields.
        if (value !== originalValue) {
            setChangedFields(prev => new Set(prev).add(name));
        } else {
            setChangedFields(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
        }
    };

    const handleUndo = () => {
        setFormData({ ...doc });
        setChangedFields(new Set());
    };

    const handleSave = async () => {
        if (!doc.id) return;

        try {
            await db.documents.update(doc.id, formData);
            setChangedFields(new Set());
            // Implicitly, the parent Dashboard query will update the 'doc' prop via liveQuery, 
            // causing the useEffect to re-run and sync everything up perfectly.
        } catch (error) {
            console.error("Failed to save document:", error);
            setNotification({ isOpen: true, message: t('save_failed'), type: 'error' });
        }
    };

    const getInputClass = (fieldName: string) => {
        return changedFields.has(fieldName) ? 'border-red-500 text-red-500' : '';
    };

    return (
        <div className="inline-edit-form p-4 border-t border-glass-border mt-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="form-grid">
                <div className="form-group full-width">
                    <label>{t('doc_type')}</label>
                    <select
                        name="type"
                        value={formData.type || 'Incoming'}
                        onChange={handleChange}
                        className={getInputClass('type')}
                    >
                        <option value="Incoming">{t('type_incoming')}</option>
                        <option value="Outgoing">{t('type_outgoing')}</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>ID</label>
                    <input
                        value={doc.id || ''}
                        disabled
                        className="bg-gray-100 cursor-not-allowed opacity-70"
                    />
                </div>

                <div className="form-group">
                    <label>{t('ref_number')}</label>
                    <input
                        name="reference_number"
                        value={formData.reference_number || ''}
                        onChange={handleChange}
                        className={getInputClass('reference_number')}
                    />
                </div>

                <div className="form-group">
                    <label>{t('doc_date')}</label>
                    <input
                        name="document_date"
                        value={formData.document_date || ''}
                        onChange={handleChange}
                        placeholder={t('date_placeholder')}
                        className={getInputClass('document_date')}
                    />
                </div>

                <div className="form-group">
                    <label>{t('attachments_label')}</label>
                    <input
                        name="attachments_desc"
                        value={formData.attachments_desc || ''}
                        onChange={handleChange}
                        className={getInputClass('attachments_desc')}
                    />
                </div>

                <div className="form-group">
                    <label>{t('sender_label')}</label>
                    <input
                        name="sender"
                        value={typeof formData.sender === 'object' ? (formData.sender as any)?.organization || '' : formData.sender || ''}
                        onChange={handleChange}
                        className={getInputClass('sender')}
                    />
                </div>

                <div className="form-group">
                    <label>{t('receiver_label')}</label>
                    <input
                        name="receiver"
                        value={typeof formData.receiver === 'object' ? (formData.receiver as any)?.organization || '' : formData.receiver || ''}
                        onChange={handleChange}
                        className={getInputClass('receiver')}
                    />
                </div>

                <div className="form-group">
                    <label>{t('cc_label')}</label>
                    <input
                        name="cc_distribution"
                        value={formData.cc_distribution || ''}
                        onChange={handleChange}
                        className={getInputClass('cc_distribution')}
                    />
                </div>

                <div className="form-group">
                    <label>{t('signatory_label')}</label>
                    <input
                        name="sender_signatory"
                        value={formData.sender_signatory || ''}
                        onChange={handleChange}
                        className={getInputClass('sender_signatory')}
                    />
                </div>

                <div className="form-group full-width">
                    <label>{t('subject_label')}</label>
                    <textarea
                        name="subject"
                        value={formData.subject || ''}
                        onChange={handleChange}
                        rows={2}
                        className={getInputClass('subject')}
                    />
                </div>

                <div className="form-group full-width">
                    <label>{t('summary_label')}</label>
                    <textarea
                        name="content_summary"
                        value={formData.content_summary || ''}
                        onChange={handleChange}
                        rows={4}
                        className={getInputClass('content_summary')}
                    />
                </div>
            </div>

            <div className="inline-edit-actions">
                <button
                    className={`btn btn-outline ${changedFields.size === 0 ? '' : 'btn-undo'}`}
                    onClick={handleUndo}
                    disabled={changedFields.size === 0}
                >
                    <RotateCcw size={18} /> {t('undo')}
                </button>

                <button className="btn btn-primary min-w-[120px]" onClick={handleSave} disabled={changedFields.size === 0}>
                    <Save size={18} /> {t('save_doc_btn')}
                </button>

                <button
                    className="btn btn-outline btn-delete"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    <Trash2 size={18} /> {t('delete_doc_btn')}
                </button>
            </div>

            <DeleteConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={async () => {
                    if (doc.id) await db.documents.delete(doc.id);
                }}
            />

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                message={notification.message}
                type={notification.type}
            />
        </div>
    );
};
