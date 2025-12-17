import React, { useState, useEffect } from 'react';
import { Upload, Save, Loader2, Sparkles, ScanLine } from 'lucide-react';
import { analyzeDocumentImage } from '../services/ai';
import { db } from '../db';
import type { ArcaiDocument } from '../types';
// import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { ImageCarousel } from '../components/ImageCarousel';
import { NotificationModal } from '../components/NotificationModal';
import { ScannerModal } from '../components/ScannerModal';


export const Entry: React.FC = () => {
    const { t } = useLanguage();
    // const navigate = useNavigate(); // Removed as we stay on page
    const [files, setFiles] = useState<File[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [formData, setFormData] = useState<Partial<ArcaiDocument>>({
        type: 'Incoming',
        created_date: new Date().toISOString(),
    });

    // Notification modal state
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
    }>({ isOpen: false, message: '', type: 'info' });

    const [nextId, setNextId] = useState<number | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    useEffect(() => {
        db.getNextDocumentId().then(setNextId);
    }, []);

    const showNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        setNotification({ isOpen: true, message, type });
    };

    const addInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(selectedFiles);

            // Automatically set attachments count if > 1 image
            if (selectedFiles.length > 1) {
                setFormData(prev => ({
                    ...prev,
                    attachments_desc: (selectedFiles.length - 1).toString()
                }));
            }
        }
    };

    const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => {
                const updated = [...prev, ...newFiles];
                // Update attachments count
                if (updated.length > 1) {
                    setFormData(prevFormData => ({
                        ...prevFormData,
                        attachments_desc: (updated.length - 1).toString()
                    }));
                }
                return updated;
            });
            // Reset input
            e.target.value = '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (files.length === 0) {
            showNotification(t('upload_image_first'), 'warning');
            return;
        }

        try {
            console.log('Attempting to save document...', formData);
            await db.documents.add({
                ...formData,
                image_data: files[0],
                additional_images: files.slice(1),
                created_date: new Date().toISOString()
            } as ArcaiDocument);

            console.log('Document saved successfully.');
            showNotification(t('save_success_message'), 'success');

            // Reset form for next entry
            setFiles([]);
            setFormData({
                type: 'Incoming',
                created_date: new Date().toISOString(),
            });
            // Refresh next ID
            db.getNextDocumentId().then(setNextId);
        } catch (error) {
            console.error('Save failed:', error);
            showNotification(t('save_failed'), 'error');
        }
    };

    const handleAnalyze = async () => {
        if (files.length === 0) return;

        setIsAnalyzing(true);
        try {
            const result = await analyzeDocumentImage(files[0]);

            // Defensive coding: Ensure flattened strings for complex AI returns
            if (result.sender && typeof result.sender === 'object') {
                result.sender = (result.sender as any).organization || (result.sender as any).name || JSON.stringify(result.sender);
            }
            if (result.receiver && typeof result.receiver === 'object') {
                result.receiver = (result.receiver as any).organization || (result.receiver as any).name || JSON.stringify(result.receiver);
            }

            setFormData(prev => {
                const newData = { ...prev, ...result };
                // Protect attachments_desc if it was already manually/automatically set
                if (prev.attachments_desc) {
                    newData.attachments_desc = prev.attachments_desc;
                }
                return newData;
            });
        } catch (error: any) {
            console.error('Full Analysis Error:', error);
            if (error?.message === 'MODEL_OVERLOADED') {
                showNotification(t('model_overloaded_error'), 'error');
            } else {
                showNotification(t('analysis_failed_error'), 'error');
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            <h1 className="page-title">{t('new_entry_title')}</h1>

            <div className="grid-layout">
                <div className="glass-panel section">
                    <h2 className="section-title">{t('doc_image_title')}</h2>

                    <div className="upload-area">
                        {files.length > 0 ? (
                            <>
                                <ImageCarousel
                                    files={files}
                                    onAddImage={() => addInputRef.current?.click()}
                                    onDeleteImage={(index) => {
                                        const newFiles = files.filter((_, i) => i !== index);
                                        setFiles(newFiles);
                                        // Update attachments count
                                        if (newFiles.length > 1) {
                                            setFormData(prev => ({
                                                ...prev,
                                                attachments_desc: (newFiles.length - 1).toString()
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                attachments_desc: ''
                                            }));
                                        }
                                    }}
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleAddFiles}
                                    hidden
                                    ref={addInputRef}
                                />
                            </>
                        ) : (
                            <label className="upload-placeholder">
                                <input type="file" accept="image/*" multiple onChange={handleFileChange} hidden />
                                <Upload size={48} className="text-gray-400 mb-2" />
                                <span>{t('click_to_upload')}</span>
                            </label>
                        )}
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={files.length === 0 || isAnalyzing}
                        className={`btn w-full mt-4 flex items-center justify-center gap-2 ${files.length === 0 || isAnalyzing
                            ? 'bg-gray-600 cursor-not-allowed opacity-50'
                            : 'btn-primary'
                            }`}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} /> {t('analyzing')}
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} /> {t('analyze_btn')}
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="btn btn-outline w-full mt-4 flex items-center justify-center gap-2"
                    >
                        <ScanLine size={20} /> {t('scanner_btn')}
                    </button>

                    <button onClick={handleSave} className="btn btn-primary btn-large mt-4 w-full">
                        <Save size={20} /> {t('save_doc_btn')}
                    </button>
                </div>

                <div className="glass-panel section">
                    <h2 className="section-title">{t('doc_details_title')}</h2>

                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>{t('doc_type')}</label>
                            <select name="type" value={formData.type} onChange={handleChange}>
                                <option value="Incoming">{t('type_incoming')}</option>
                                <option value="Outgoing">{t('type_outgoing')}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>ID</label>
                            <input value={nextId || '...'} disabled className="bg-gray-100 cursor-not-allowed opacity-70" />
                        </div>

                        <div className="form-group">
                            <label>{t('ref_number')}</label>
                            <input name="reference_number" value={formData.reference_number || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>{t('doc_date')}</label>
                            <input name="document_date" value={formData.document_date || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>{t('attachments_label')}</label>
                            <input name="attachments_desc" value={formData.attachments_desc || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>{t('sender_label')}</label>
                            <input name="sender" value={formData.sender || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>{t('receiver_label')}</label>
                            <input name="receiver" value={formData.receiver || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>{t('cc_label')}</label>
                            <input name="cc_distribution" value={formData.cc_distribution || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label>{t('signatory_label')}</label>
                            <input name="sender_signatory" value={formData.sender_signatory || ''} onChange={handleChange} />
                        </div>

                        <div className="form-group full-width">
                            <label>{t('subject_label')}</label>
                            <textarea name="subject" value={formData.subject || ''} onChange={handleChange} rows={2} />
                        </div>

                        <div className="form-group full-width">
                            <label>{t('summary_label')}</label>
                            <textarea name="content_summary" value={formData.content_summary || ''} onChange={handleChange} rows={4} />
                        </div>
                    </div>
                </div>
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                message={notification.message}
                type={notification.type}
            />

            <ScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onSave={(scannedFiles) => {
                    // Add scanned files to existing files
                    const newFiles = [...files, ...scannedFiles];
                    setFiles(newFiles);

                    // Update attachments count
                    if (newFiles.length > 1) {
                        setFormData(prev => ({
                            ...prev,
                            attachments_desc: (newFiles.length - 1).toString()
                        }));
                    }
                }}
            />
        </div>
    );
};
