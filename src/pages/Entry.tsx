import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Upload, Save, Loader2, Sparkles, ScanLine } from 'lucide-react';
import { analyzeDocumentImage } from '../services/ai';
import { db } from '../db';
import type { ArcaiDocument } from '../types';
// import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useMobileMenu } from '../contexts/MobileMenuContext';
import { ImageCarousel } from '../components/ImageCarousel';
import { ToastNotification } from '../components/ToastNotification';
import { ScannerModal } from '../components/ScannerModal';
import { MobileHeader } from '../components/MobileHeader';
import { ScreenCaptureOverlay } from '../components/ScreenCaptureOverlay';


export const Entry: React.FC = () => {
    const { t } = useLanguage();
    const { toggleMenu } = useMobileMenu();
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
    const [isDragging, setIsDragging] = useState(false);

    // Screen capture state
    const [captureFieldName, setCaptureFieldName] = useState<string | null>(null);

    // OCR install modal state
    const [ocrInstallModal, setOcrInstallModal] = useState<{
        isOpen: boolean;
        langCode: string;
        pendingImageBlob: Blob | null;
        pendingFieldName: string;
    }>({ isOpen: false, langCode: '', pendingImageBlob: null, pendingFieldName: '' });

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
            file.type.startsWith('image/')
        );

        if (droppedFiles.length > 0) {
            const newFiles = [...files, ...droppedFiles];
            setFiles(newFiles);
            if (newFiles.length > 1) {
                setFormData(prev => ({
                    ...prev,
                    attachments_desc: (newFiles.length - 1).toString()
                }));
            }
        }
    };

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

    // Screen capture handlers
    const openCapture = async (fieldName: string) => {
        // Check if we're in Electron (PC)
        const electronAPI = (window as unknown as {
            electronAPI?: {
                checkOcrLanguages: () => Promise<{ success: boolean; languages: { ar: boolean; en: boolean } }>;
            }
        }).electronAPI;

        if (!electronAPI) {
            showNotification(t('ocr_pc_only'), 'warning');
            return;
        }

        try {
            // Check if Arabic OCR is installed before opening capture
            const langCheck = await electronAPI.checkOcrLanguages();

            if (!langCheck.success || !langCheck.languages.ar) {
                // Arabic OCR not installed - show error message
                showNotification(`${t('ocr_lang_missing')}: ${t('arabic')}. ${t('ocr_go_to_settings')}`, 'error');
                return;
            }

            // OCR is available, open capture overlay
            setCaptureFieldName(fieldName);
        } catch (error) {
            console.error('Error checking OCR languages:', error);
            showNotification(`${t('ocr_error')}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    const handleCapture = async (imageBlob: Blob, fieldName: string) => {
        // Check if we're in Electron (PC)
        const electronAPI = (window as unknown as {
            electronAPI?: {
                checkOcrLanguages: () => Promise<{ success: boolean; languages: { ar: boolean; en: boolean } }>;
                installOcrLanguage: (langCode: string) => Promise<{ success: boolean; error?: string }>;
                extractText: (imageBase64: string, language: string) => Promise<{ success: boolean; text: string; error?: string }>;
            }
        }).electronAPI;

        if (!electronAPI) {
            showNotification(t('ocr_pc_only'), 'warning');
            return;
        }

        try {
            // Check if OCR languages are installed
            const langCheck = await electronAPI.checkOcrLanguages();

            if (!langCheck.success || (!langCheck.languages.ar && !langCheck.languages.en)) {
                // No OCR languages installed - show modal to prompt install
                const missingLang = !langCheck.languages.ar ? 'ar' : 'en';

                // Store pending data and show modal
                setOcrInstallModal({
                    isOpen: true,
                    langCode: missingLang,
                    pendingImageBlob: imageBlob,
                    pendingFieldName: fieldName
                });
                return; // Exit - will continue after user confirms in modal
            }

            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
            });
            reader.readAsDataURL(imageBlob);
            const imageBase64 = await base64Promise;

            // Show extracting notification
            showNotification(t('ocr_extracting_text'), 'info');

            // Perform OCR - try Arabic first since this is the primary use case
            const language = langCheck.languages.ar ? 'ar' : 'en';
            const ocrResult = await electronAPI.extractText(imageBase64, language);

            if (ocrResult.success && ocrResult.text) {
                // Set the extracted text to the target field
                setFormData(prev => ({
                    ...prev,
                    [fieldName]: ocrResult.text.trim()
                }));
                showNotification(t('ocr_success'), 'success');
            } else if (ocrResult.success && !ocrResult.text) {
                showNotification(t('ocr_no_text_found'), 'warning');
            } else {
                // Check if error is about language not installed
                const errorMsg = ocrResult.error || '';
                if (errorMsg.includes('OCR_LANG_NOT_INSTALLED')) {
                    const langName = errorMsg.includes('Arabic') ? t('arabic') : t('english');
                    showNotification(`${t('ocr_lang_missing')}: ${langName}. ${t('ocr_go_to_settings')}`, 'error');
                } else {
                    showNotification(`${t('ocr_failed')}: ${errorMsg}`, 'error');
                }
            }
        } catch (error) {
            console.error('OCR error:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            // Check if error is about language not installed
            if (errorMsg.includes('OCR_LANG_NOT_INSTALLED')) {
                const langName = errorMsg.includes('Arabic') ? t('arabic') : t('english');
                showNotification(`${t('ocr_lang_missing')}: ${langName}. ${t('ocr_go_to_settings')}`, 'error');
            } else {
                showNotification(`${t('ocr_error')}: ${errorMsg}`, 'error');
            }
        }
    };

    // Handler for OCR language install confirmation
    const handleOcrInstallConfirm = async () => {
        const { langCode, pendingImageBlob, pendingFieldName } = ocrInstallModal;
        setOcrInstallModal({ isOpen: false, langCode: '', pendingImageBlob: null, pendingFieldName: '' });

        const electronAPI = (window as unknown as {
            electronAPI?: {
                installOcrLanguage: (langCode: string) => Promise<{ success: boolean; error?: string }>;
                extractText: (imageBase64: string, language: string) => Promise<{ success: boolean; text: string; error?: string }>;
            }
        }).electronAPI;

        if (!electronAPI || !pendingImageBlob) return;

        showNotification(t('ocr_installing'), 'info');

        try {
            const installResult = await electronAPI.installOcrLanguage(langCode);

            if (installResult.success) {
                showNotification(t('ocr_install_success'), 'success');

                // Now perform OCR with the pending image
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                });
                reader.readAsDataURL(pendingImageBlob);
                const imageBase64 = await base64Promise;

                showNotification(t('ocr_extracting_text'), 'info');
                const ocrResult = await electronAPI.extractText(imageBase64, langCode);

                if (ocrResult.success && ocrResult.text) {
                    setFormData(prev => ({
                        ...prev,
                        [pendingFieldName]: ocrResult.text.trim()
                    }));
                    showNotification(t('ocr_success'), 'success');
                } else if (ocrResult.success && !ocrResult.text) {
                    showNotification(t('ocr_no_text_found'), 'warning');
                } else {
                    showNotification(`${t('ocr_failed')}: ${ocrResult.error}`, 'error');
                }
            } else {
                showNotification(`${t('ocr_install_failed')}: ${installResult.error}`, 'error');
            }
        } catch (error) {
            console.error('OCR install error:', error);
            showNotification(`${t('ocr_install_failed')}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    return (
        <div className="page-container animate-fade-in">
            {/* OCR Install Language Modal */}
            {ocrInstallModal.isOpen && ReactDOM.createPortal(
                <div className="image-viewer-overlay flex items-center justify-center animate-fade-in" style={{ zIndex: 10000 }}>
                    <div className="absolute inset-0" onClick={() => setOcrInstallModal({ isOpen: false, langCode: '', pendingImageBlob: null, pendingFieldName: '' })}></div>
                    <div className="delete-modal animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="delete-modal-icon bg-blue-500/20 text-blue-500">
                            <ScanLine size={32} />
                        </div>
                        <h3 className="delete-modal-title">
                            {ocrInstallModal.langCode === 'ar' ? t('ocr_lang_missing_ar') : t('ocr_lang_missing_en')}
                        </h3>
                        <p className="delete-modal-text">
                            {t('ocr_install_prompt')}
                        </p>
                        <div className="delete-modal-actions">
                            <button
                                className="btn btn-outline border-gray-300 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                                onClick={() => setOcrInstallModal({ isOpen: false, langCode: '', pendingImageBlob: null, pendingFieldName: '' })}
                            >
                                {t('ocr_cancel_btn')}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleOcrInstallConfirm}
                            >
                                {t('ocr_install_btn')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Mobile Header with hamburger */}
            <MobileHeader title={t('new_entry_title')} onMenuClick={toggleMenu} />

            <h1 className="page-title desktop-only">{t('new_entry_title')}</h1>

            <div className="grid-layout">
                <div className="glass-panel section">
                    <h2 className="section-title">{t('doc_image_title')}</h2>

                    <div
                        className={`upload-area ${isDragging ? 'drag-over' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
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
                            <div className="ocr-field-wrapper">
                                <input name="reference_number" value={formData.reference_number || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('reference_number')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('doc_date')}</label>
                            <div className="ocr-field-wrapper">
                                <input name="document_date" value={formData.document_date || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('document_date')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('attachments_label')}</label>
                            <div className="ocr-field-wrapper">
                                <input name="attachments_desc" value={formData.attachments_desc || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('attachments_desc')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('sender_label')}</label>
                            <div className="ocr-field-wrapper">
                                <input name="sender" value={formData.sender || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('sender')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('receiver_label')}</label>
                            <div className="ocr-field-wrapper">
                                <input name="receiver" value={formData.receiver || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('receiver')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('cc_label')}</label>
                            <div className="ocr-field-wrapper">
                                <input name="cc_distribution" value={formData.cc_distribution || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('cc_distribution')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>{t('signatory_label')}</label>
                            <div className="ocr-field-wrapper">
                                <input name="sender_signatory" value={formData.sender_signatory || ''} onChange={handleChange} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('sender_signatory')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group full-width">
                            <label>{t('subject_label')}</label>
                            <div className="ocr-field-wrapper">
                                <textarea name="subject" value={formData.subject || ''} onChange={handleChange} rows={2} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('subject')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group full-width">
                            <label>{t('summary_label')}</label>
                            <div className="ocr-field-wrapper">
                                <textarea name="content_summary" value={formData.content_summary || ''} onChange={handleChange} rows={4} />
                                {(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron && (
                                    <button className="ocr-select-btn" onClick={() => openCapture('content_summary')} title={t('ocr_scan_field') || 'Scan text for this field'}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 2H4a2 2 0 0 0-2 2v3" /><path d="M17 2h3a2 2 0 0 1 2 2v3" /><path d="M7 22H4a2 2 0 0 1-2-2v-3" /><path d="M17 22h3a2 2 0 0 0 2-2v-3" /><line x1="8" y1="12" x2="16" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ToastNotification
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                message={notification.message}
                type={notification.type}
                duration={3000}
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

            {/* Screen Capture Overlay */}
            <ScreenCaptureOverlay
                isOpen={captureFieldName !== null}
                onClose={() => setCaptureFieldName(null)}
                onCapture={handleCapture}
                fieldName={captureFieldName || ''}
                imageFile={files[0] || null}
            />
        </div>
    );
};
