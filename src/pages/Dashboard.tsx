import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Search, FileText, ArrowUpRight, ArrowDownLeft, Calendar, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { normalizeArabicText } from '../utils/textUtils';
import { DocumentThumbnail } from '../components/DocumentThumbnail';
import type { ArcaiDocument } from '../types';

import { DocumentInlineEdit } from '../components/DocumentInlineEdit';
import { ImageViewer } from '../components/ImageViewer';
import { Pagination } from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

export const Dashboard: React.FC = () => {
    const { dir, t } = useLanguage();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
    const [viewingDoc, setViewingDoc] = useState<ArcaiDocument | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [filterType, setFilterType] = useState<'all' | 'Incoming' | 'Outgoing'>('all');

    const toggleExpand = (id: number) => {
        setExpandedDocId(prev => prev === id ? null : id);
    };

    const data = useLiveQuery(async () => {
        let collection = db.documents.orderBy('created_date').reverse();

        // Apply type filter if not 'all'
        if (filterType !== 'all') {
            collection = collection.filter(doc => doc.type === filterType);
        }

        if (searchQuery) {
            // Client-side search with Arabic normalization
            // For search, we currently need to load all to filter correctly
            const allDocs = await collection.toArray();
            const normalizedQuery = normalizeArabicText(searchQuery.toLowerCase());
            const filtered = allDocs.filter(doc =>
                normalizeArabicText(doc.subject?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.sender?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.receiver?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.reference_number?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.content_summary?.toLowerCase() || '').includes(normalizedQuery) ||
                normalizeArabicText(doc.raw_text?.toLowerCase() || '').includes(normalizedQuery)
            );

            // Slice the filtered results for pagination
            const offset = (currentPage - 1) * ITEMS_PER_PAGE;
            return {
                docs: filtered.slice(offset, offset + ITEMS_PER_PAGE),
                total: filtered.length,
                incomingCount: 0, // Will be recalculated below locally if needed, or we can just fetch global counts
                outgoingCount: 0  // Global counts are better fetched separately so they don't change with search/filter?
                // User request implies filtering the LIST, but usually stats cards show GLOBAL totals unless specified.
                // However, "make clickable to filter" usually means the cards act as tabs.
                // The numbers on the cards usually represent the count of that category.
            };
        }

        // Optimized path for main view: DB-level pagination
        // We need counts for the cards always, regardless of current filter
        const totalCount = await db.documents.count();
        const incomingCount = await db.documents.where('type').equals('Incoming').count();
        const outgoingCount = await db.documents.where('type').equals('Outgoing').count();

        // The collection is already filtered by type if needed
        const totalFiltered = await collection.count();

        const docs = await collection
            .offset((currentPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .toArray();

        return { docs, total: totalFiltered, totalCount, incomingCount, outgoingCount };
    }, [searchQuery, currentPage, filterType]);

    const documents = data?.docs;
    // For pagination, we use the total of the CURRENT filtered view
    const totalDocsForPagination = data?.total || 0;

    // For the cards, we likely want the global counts (Total, Incoming, Outgoing)
    // regardless of what is currently selected, so the user sees "Oh there are 14 incoming" even if viewing 'all'.
    const displayTotalCount = data?.totalCount ?? 0; // Fallback? useLiveQuery usually returns undefined initially
    const displayIncomingCount = data?.incomingCount ?? 0;
    const displayOutgoingCount = data?.outgoingCount ?? 0;

    const totalPages = Math.ceil(totalDocsForPagination / ITEMS_PER_PAGE);

    // We already have paginated docs, so no need to slice again
    const displayedDocuments = documents;

    // Get images for the viewing document
    const getDocImages = (doc: ArcaiDocument): Blob[] => {
        const images: Blob[] = [];
        if (doc.image_data) images.push(doc.image_data);
        if (doc.additional_images) images.push(...doc.additional_images);
        return images;
    };

    const handleDeleteImage = async (imageIndex: number) => {
        if (!viewingDoc || !viewingDoc.id) return;

        const allImages = getDocImages(viewingDoc);

        // Calculate the new total count after deletion (current total - 1)
        const newTotalCount = allImages.length - 1;
        const newAttachmentsDesc = newTotalCount > 1 ? (newTotalCount - 1).toString() : '';

        // If it's the only image, delete it and set image_data to undefined
        if (allImages.length <= 1) {
            await db.documents.update(viewingDoc.id, {
                image_data: undefined,
                additional_images: undefined,
                attachments_desc: ''
            });
            setViewingDoc(null);
            return;
        }

        // Determine which blob we're deleting
        if (imageIndex === 0) {
            // Deleting the main image: promote the first additional image to main
            const newMain = viewingDoc.additional_images?.[0];
            const newAdditional = viewingDoc.additional_images?.slice(1) || [];
            await db.documents.update(viewingDoc.id, {
                image_data: newMain,
                additional_images: newAdditional.length > 0 ? newAdditional : undefined,
                attachments_desc: newAttachmentsDesc
            });
        } else {
            // Deleting an additional image
            const newAdditional = [...(viewingDoc.additional_images || [])];
            newAdditional.splice(imageIndex - 1, 1); // imageIndex - 1 because index 0 is main image
            await db.documents.update(viewingDoc.id, {
                additional_images: newAdditional.length > 0 ? newAdditional : undefined,
                attachments_desc: newAttachmentsDesc
            });
        }

        // Refresh the viewing document from DB to show updated images
        const updatedDoc = await db.documents.get(viewingDoc.id);
        if (updatedDoc) {
            setViewingDoc(updatedDoc);
        } else {
            // Document was deleted entirely, close viewer
            setViewingDoc(null);
        }
    };

    const handleAddImages = async (docId: number, files: File[], insertAtIndex?: number) => {
        if (files.length === 0) return;

        // Get current document
        const doc = await db.documents.get(docId);
        if (!doc) return;

        let newAdditional: Blob[] = [];
        let newImageData: Blob | undefined = doc.image_data;

        if (doc.image_data) {
            // Document already has images
            const currentAdditional = doc.additional_images || [];
            newAdditional = [...currentAdditional];

            if (typeof insertAtIndex === 'number') {
                newAdditional.splice(insertAtIndex, 0, ...files);
            } else {
                newAdditional = [...newAdditional, ...files];
            }
        } else {
            // No existing images
            newImageData = files[0];
            if (files.length > 1) {
                newAdditional = files.slice(1);
            }
        }

        // Calculate attachments description (Total - 1)
        const totalImages = (newImageData ? 1 : 0) + newAdditional.length;
        const newAttachmentsDesc = totalImages > 1 ? (totalImages - 1).toString() : '';

        await db.documents.update(docId, {
            image_data: newImageData,
            additional_images: newAdditional.length > 0 ? newAdditional : undefined,
            attachments_desc: newAttachmentsDesc
        });

        // If we are currently viewing this doc, update the state to reflect changes immediately
        if (viewingDoc && viewingDoc.id === docId) {
            const updatedDoc = await db.documents.get(docId);
            if (updatedDoc) setViewingDoc(updatedDoc);
        }
    };



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
                <div
                    className={`glass-panel stat-card cursor-pointer transition-all ${filterType === 'all' ? 'active' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                >
                    <h3>{t('total_docs')}</h3>
                    <p className="stat-value">{displayTotalCount}</p>
                </div>
                <div
                    className={`glass-panel stat-card cursor-pointer transition-all ${filterType === 'Incoming' ? 'active' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    onClick={() => { setFilterType('Incoming'); setCurrentPage(1); }}
                >
                    <h3>{t('incoming_docs')}</h3>
                    <p className="stat-value">{displayIncomingCount}</p>
                </div>
                <div
                    className={`glass-panel stat-card cursor-pointer transition-all ${filterType === 'Outgoing' ? 'active' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    onClick={() => { setFilterType('Outgoing'); setCurrentPage(1); }}
                >
                    <h3>{t('outgoing_docs')}</h3>
                    <p className="stat-value">{displayOutgoingCount}</p>
                </div>
            </div>

            <div className="documents-list">
                {displayedDocuments?.map(doc => (
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
                        <div onClick={(e) => { e.stopPropagation(); if (doc.image_data) setViewingDoc(doc); }}>
                            <DocumentThumbnail
                                doc={doc}
                                onAddImages={(files) => doc.id && handleAddImages(doc.id, files)}
                            />
                        </div>
                    </div>
                ))}

                {viewingDoc && (
                    <ImageViewer
                        images={getDocImages(viewingDoc)}
                        onClose={() => setViewingDoc(null)}
                        onDeleteImage={handleDeleteImage}
                        onAddImages={(files, index) => viewingDoc.id && handleAddImages(viewingDoc.id, files, index)}
                    />
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

            {/* Pagination Controls */}
            {documents && documents.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}
        </div>
    );
};
