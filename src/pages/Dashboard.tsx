import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Search, FileText, ArrowUpRight, ArrowDownLeft, Calendar, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { normalizeArabicText } from '../utils/textUtils';
import { DocumentThumbnail } from '../components/DocumentThumbnail';

import { DocumentInlineEdit } from '../components/DocumentInlineEdit';
import { ImageViewer } from '../components/ImageViewer';

export const Dashboard: React.FC = () => {
    const { dir, t } = useLanguage();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
    const [viewingDocBlob, setViewingDocBlob] = useState<Blob | null>(null);

    const toggleExpand = (id: number) => {
        setExpandedDocId(prev => prev === id ? null : id);
    };

    const documents = useLiveQuery(async () => {
        let collection = db.documents.orderBy('created_date').reverse();
        const allDocs = await collection.toArray();

        if (searchQuery) {
            // Client-side search with Arabic normalization
            const normalizedQuery = normalizeArabicText(searchQuery.toLowerCase());
            return allDocs.filter(doc =>
                normalizeArabicText(doc.subject?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.sender?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.receiver?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.reference_number?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.content_summary?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.raw_text?.toLowerCase() || '').includes(normalizedQuery)
            );
        }

        return allDocs;
    }, [searchQuery]);



    return (
        <div className="page-container animate-fade-in">
            <div className="search-header mb-6">
                <h1 className="page-title mb-0">{t('documents_title')}</h1>
                <div className="search-bar-container">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="stats-grid mb-6">
                <div className="glass-panel stat-card">
                    <h3>{t('total_docs')}</h3>
                    <p className="stat-value">{documents?.length || 0}</p>
                </div>
                <div className="glass-panel stat-card">
                    <h3>{t('incoming_docs')}</h3>
                    <p className="stat-value">{documents?.filter(d => d.type === 'Incoming').length || 0}</p>
                </div>
                <div className="glass-panel stat-card">
                    <h3>{t('outgoing_docs')}</h3>
                    <p className="stat-value">{documents?.filter(d => d.type === 'Outgoing').length || 0}</p>
                </div>
            </div>

            <div className="documents-list">
                {documents?.map(doc => (
                    <div key={doc.id} className={`glass-panel document-card ${expandedDocId === doc.id ? 'expanded' : ''}`} onClick={() => doc.id && toggleExpand(doc.id)}>
                        <div className="doc-icon">
                            {doc.type === 'Incoming' ? <ArrowDownLeft className="text-blue-500" /> : <ArrowUpRight className="text-orange-500" />}
                        </div>
                        <div className="doc-content">
                            <h3 className="doc-subject">{doc.subject || t('no_subject')}</h3>
                            <div className="doc-meta">
                                <span className="meta-item"><FileText size={14} /> {doc.reference_number}</span>
                                <span className="meta-item"><Calendar size={14} /> {doc.document_date || doc.created_date.split('T')[0]}</span>
                                <span className="meta-item"><User size={14} />
                                    {/* Handle cases where AI returns objects instead of strings */}
                                    {typeof doc.sender === 'object' ? (doc.sender as any)?.organization || t('unknown_org') : doc.sender}
                                    {dir === 'rtl' ? ' \u2190 ' : ' \u2192 '}
                                    {typeof doc.receiver === 'object' ? (doc.receiver as any)?.organization || t('unknown_org') : doc.receiver}
                                </span>
                            </div>
                            <p className="doc-summary">{doc.content_summary}</p>

                            {expandedDocId === doc.id && (
                                <DocumentInlineEdit doc={doc} />
                            )}
                        </div>
                        {/* Replaced View button with Thumbnail */}
                        <div onClick={(e) => { e.stopPropagation(); if (doc.image_data) setViewingDocBlob(doc.image_data); }}>
                            <DocumentThumbnail doc={doc} />
                        </div>
                    </div>
                ))}

                {viewingDocBlob && (
                    <ImageViewer blob={viewingDocBlob} onClose={() => setViewingDocBlob(null)} />
                )}

                {documents?.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <h3>{t('no_docs')}</h3>
                        <p>{t('start_upload')}</p>
                        <button className="btn btn-primary mt-4" onClick={() => navigate('/entry')}>
                            {t('new_entry_btn')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
