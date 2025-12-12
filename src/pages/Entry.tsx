import React, { useState } from 'react';
import { Upload, Save, Loader2, Sparkles } from 'lucide-react';
import { analyzeDocumentImage } from '../services/ai';
import { db } from '../db';
import type { ArcaiDocument } from '../types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useRateLimit } from '../contexts/RateLimitContext';

export const Entry: React.FC = () => {
    const { t } = useLanguage();
    const { rateLimitState, consumeCredit, depleteAllCredits } = useRateLimit();
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [formData, setFormData] = useState<Partial<ArcaiDocument>>({
        type: 'Incoming',
        created_date: new Date().toISOString(),
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    // Rate limiting is now handled by RateLimitContext

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!file) {
            alert(t('upload_image_first'));
            return;
        }

        try {
            console.log('Attempting to save document...', formData);
            await db.documents.add({
                ...formData,
                image_data: file,
                created_date: new Date().toISOString()
            } as ArcaiDocument);

            console.log('Document saved successfully. Navigating to dashboard.');
            navigate('/');
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save document.');
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        // Check and consume credit
        if (!consumeCredit()) {
            alert(t('rate_limit_error'));
            return;
        }

        setIsAnalyzing(true);
        try {
            const result = await analyzeDocumentImage(file);

            // Defensive coding: Ensure flattened strings for complex AI returns
            if (result.sender && typeof result.sender === 'object') {
                result.sender = (result.sender as any).organization || (result.sender as any).name || JSON.stringify(result.sender);
            }
            if (result.receiver && typeof result.receiver === 'object') {
                result.receiver = (result.receiver as any).organization || (result.receiver as any).name || JSON.stringify(result.receiver);
            }

            setFormData(prev => ({ ...prev, ...result }));
        } catch (error) {
            console.error('Full Analysis Error:', error);

            // Check if this is a Google API quota error (429)
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('429') || errorMessage.includes('quota exceeded') || errorMessage.includes('Quota exceeded')) {
                // Deplete all credits when quota is exceeded
                depleteAllCredits();
                alert(t('api_quota_exceeded'));
            } else {
                alert(t('analysis_failed_error'));
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
                        {preview ? (
                            <div className="preview-container">
                                <img src={preview} alt="Preview" className="preview-image" />
                                <button className="btn btn-outline change-btn" onClick={() => { setFile(null); setPreview(null); }}>
                                    {t('change_image')}
                                </button>
                            </div>
                        ) : (
                            <label className="upload-placeholder">
                                <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                                <Upload size={48} className="text-gray-400 mb-2" />
                                <span>{t('click_to_upload')}</span>
                            </label>
                        )}
                    </div>

                    <div className="rate-limit-container mt-4 p-3 rounded-lg bg-black/20 border border-white/10">
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-sm font-medium">{t('available_credits')}</div>
                            <div className={`text-lg font-bold ${rateLimitState.availableCount === 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {rateLimitState.availableCount}/5
                            </div>
                        </div>

                        {rateLimitState.availableCount < 5 && (
                            <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-green-400 h-full transition-all duration-100 ease-linear"
                                    style={{ width: `${rateLimitState.progress}%` }}
                                />
                            </div>
                        )}

                        {rateLimitState.availableCount < 5 && (
                            <div className="text-xs text-right mt-1 text-blue-300">
                                {t('next_credit_in')} {rateLimitState.timeLeft}s
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={!file || isAnalyzing || rateLimitState.availableCount === 0}
                        className={`btn w-full mt-4 flex items-center justify-center gap-2 ${!file || isAnalyzing || rateLimitState.availableCount === 0
                            ? 'bg-gray-600 cursor-not-allowed opacity-50'
                            : 'btn-primary'
                            }`}
                        style={rateLimitState.availableCount === 0 ? { filter: 'grayscale(1)' } : {}}
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

                    <button onClick={handleSave} className="btn btn-primary btn-large mt-4 w-full">
                        <Save size={20} /> {t('save_doc_btn')}
                    </button>
                </div>

                <div className="glass-panel section">
                    <h2 className="section-title">{t('doc_details_title')}</h2>

                    <div className="form-grid">
                        <div className="form-group">
                            <label>{t('doc_type')}</label>
                            <select name="type" value={formData.type} onChange={handleChange}>
                                <option value="Incoming">{t('type_incoming')}</option>
                                <option value="Outgoing">{t('type_outgoing')}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>{t('ref_number')}</label>
                            <input name="reference_number" value={formData.reference_number || ''} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('doc_date')}</label>
                        <input name="document_date" value={formData.document_date || ''} onChange={handleChange} placeholder={t('date_placeholder')} />
                    </div>

                    <div className="form-group">
                        <label>{t('sender_label')}</label>
                        <input name="sender" value={formData.sender || ''} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>{t('signatory_label')}</label>
                        <input name="sender_signatory" value={formData.sender_signatory || ''} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>{t('receiver_label')}</label>
                        <input name="receiver" value={formData.receiver || ''} onChange={handleChange} />
                    </div>

                    <div className="form-group full-width">
                        <label>{t('subject_label')}</label>
                        <textarea name="subject" value={formData.subject || ''} onChange={handleChange} rows={2} />
                    </div>

                    <div className="form-group full-width">
                        <label>{t('attachments_label')}</label>
                        <input name="attachments_desc" value={formData.attachments_desc || ''} onChange={handleChange} />
                    </div>

                    <div className="form-group full-width">
                        <label>{t('cc_label')}</label>
                        <input name="cc_distribution" value={formData.cc_distribution || ''} onChange={handleChange} />
                    </div>

                    <div className="form-group full-width">
                        <label>{t('summary_label')}</label>
                        <textarea name="content_summary" value={formData.content_summary || ''} onChange={handleChange} rows={4} />
                    </div>

                    {/* Hidden fields for structured data could be viewed in a raw editor if needed, but keeping it simple for now */}
                </div>
            </div>
        </div>
    );
};
