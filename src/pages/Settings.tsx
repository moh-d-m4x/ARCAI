import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { useLanguage } from '../contexts/LanguageContext';
import { useMobileMenu } from '../contexts/MobileMenuContext';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import { MobileHeader } from '../components/MobileHeader';
import type { AIProvider } from '../types';

export const Settings: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const { toggleMenu } = useMobileMenu();
    const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [llm7Key, setLlm7Key] = useState('');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');
    const [status, setStatus] = useState('');
    const [dbStatus, setDbStatus] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [previewDocuments, setPreviewDocuments] = useState<any[]>([]);
    const [previewSettings, setPreviewSettings] = useState<any[]>([]);
    const [pendingImportData, setPendingImportData] = useState<{ documents: any[], settings: any[] } | null>(null);

    useEffect(() => {
        db.settings.toArray().then(items => {
            if (items.length > 0) {
                setAiProvider(items[0].aiProvider || 'gemini');
                setGeminiKey(items[0].geminiApiKey || '');
                setOpenaiKey(items[0].openaiApiKey || '');
                setLlm7Key(items[0].llm7ApiKey || '');
                setTheme(items[0].theme);
                if (items[0].language) {
                    setLanguage(items[0].language);
                }
                if (items[0].selectedModel) {
                    setSelectedModel(items[0].selectedModel);
                }
            }
        });
    }, [setLanguage]);

    const [availableModels, setAvailableModels] = useState<string[]>([]);

    // Clear available models when provider changes
    useEffect(() => {
        setAvailableModels([]);
    }, [aiProvider]);

    const handleSave = async () => {
        const items = await db.settings.toArray();
        const existingId = items[0]?.id;

        // Verify connection and get models for the selected provider
        try {
            setStatus(t('models_loading'));

            let models: any[] = [];

            if (aiProvider === 'gemini' && geminiKey.trim()) {
                console.log('Checking Gemini connection...');
                const { checkConnection } = await import('../services/ai');
                models = await checkConnection(geminiKey);
                setAvailableModels(models.map((m: any) => m.name));
            } else if (aiProvider === 'openai' && openaiKey.trim()) {
                console.log('Checking OpenAI connection...');
                const { checkOpenAIConnection } = await import('../services/ai');
                models = await checkOpenAIConnection(openaiKey);
                setAvailableModels(models.map((m: any) => m.id));
            } else if (aiProvider === 'llm7' && llm7Key.trim()) {
                console.log('Checking LLM7 connection...');
                const { checkLLM7Connection } = await import('../services/ai');
                models = await checkLLM7Connection(llm7Key);
                setAvailableModels(models.map((m: any) => m.id));
            } else {
                // No API key provided for selected provider
                setStatus('Please enter an API key for the selected provider');
                return;
            }

            console.log('Models received:', models);

            const settingsData = {
                aiProvider: aiProvider,
                geminiApiKey: geminiKey,
                openaiApiKey: openaiKey,
                llm7ApiKey: llm7Key,
                theme: theme,
                language: language,
                selectedModel: selectedModel
            };

            if (existingId) {
                await db.settings.update(existingId, settingsData);
            } else {
                await db.settings.add(settingsData);
            }

            setStatus(t('settings_saved'));
        } catch (error: any) {
            console.error("Failed to save settings:", error);
            setStatus(`Failed: ${error.message}`);
            // Don't clear available models on save fail, user might just have a bad key but wants to keep UI state
        }
    };

    const updateSetting = async (key: string, value: any) => {
        try {
            const items = await db.settings.toArray();
            const existingId = items[0]?.id;
            const currentSettings = items[0] || {};

            const settingsData = {
                ...currentSettings, // Fallback to existing
                aiProvider: aiProvider,
                geminiApiKey: geminiKey, // Keep current local state for these
                openaiApiKey: openaiKey,
                llm7ApiKey: llm7Key,
                theme: theme,
                language: language,
                selectedModel: selectedModel,
                [key]: value // Override with new value
            };

            if (existingId) {
                await db.settings.update(existingId, { [key]: value });
            } else {
                await db.settings.add(settingsData);
            }
            // Local state update is handled by listeners or manual set for instant feedback
            if (key === 'language') setLanguage(value);
            if (key === 'theme') setTheme(value);

        } catch (error) {
            console.error(`Failed to auto-save ${key}:`, error);
        }
    };

    return (
        <div className="page-container animate-fade-in">
            {/* Mobile Header with hamburger */}
            <MobileHeader title={t('settings')} onMenuClick={toggleMenu} />

            <h1 className="page-title desktop-only">{t('settings')}</h1>

            <div className="glass-panel section">
                <h2 className="section-title">{t('language')}</h2>
                <div className="form-group">
                    <select
                        value={language}
                        onChange={(e) => updateSetting('language', e.target.value)}
                        style={{ width: '100%', padding: '0.75rem' }}
                    >
                        <option value="ar">{t('arabic')}</option>
                        <option value="en">{t('english')}</option>
                    </select>
                </div>
            </div>

            <div className="glass-panel section">
                <h2 className="section-title">{t('theme')}</h2>
                <div className="theme-toggle-group">
                    <button
                        className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => updateSetting('theme', 'light')}
                    >
                        {t('light')}
                    </button>
                    <button
                        className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => updateSetting('theme', 'dark')}
                    >
                        {t('dark')}
                    </button>
                </div>
            </div>

            <div className="glass-panel section">
                <h2 className="section-title">{t('ai_settings_title')}</h2>

                <div className="form-group">
                    <label>{t('ai_provider_label')}</label>
                    <select
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                        style={{ width: '100%', padding: '0.75rem' }}
                    >
                        <option value="gemini">{t('provider_gemini')}</option>
                        <option value="openai">{t('provider_openai')}</option>
                        <option value="llm7">{t('provider_llm7')}</option>
                    </select>
                </div>

                {aiProvider === 'gemini' && (
                    <div className="form-group">
                        <label>{t('api_key_label')}</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="Expected: AIza..."
                        />
                    </div>
                )}

                {aiProvider === 'openai' && (
                    <div className="form-group">
                        <label>{t('openai_api_key_label')}</label>
                        <input
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                        />
                    </div>
                )}

                {aiProvider === 'llm7' && (
                    <div className="form-group">
                        <label>{t('llm7_api_key_label')}</label>
                        <input
                            type="password"
                            value={llm7Key}
                            onChange={(e) => setLlm7Key(e.target.value)}
                            placeholder="LLM7 API Key"
                        />
                    </div>
                )}

                {/* Available Models List (Moved here) */}
                {availableModels.length > 0 && (
                    <div className="form-group" style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                        <label>{t('ai_model')}</label>
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem' }}
                        >
                            {availableModels.map(model => {
                                const cleanName = model.replace('models/', '');
                                return <option key={model} value={cleanName}>{cleanName}</option>;
                            })}
                        </select>
                    </div>
                )}

                {status && (
                    <div className={`status-message ${status.includes('Failed') ? 'error' : 'success'}`} style={{
                        marginTop: '1.5rem',
                        backgroundColor: status.includes('Failed') ? '#fee2e2' : '#dcfce7',
                        color: status.includes('Failed') ? '#b91c1c' : '#166534',
                        borderColor: status.includes('Failed') ? '#fca5a5' : '#bbf7d0',
                    }}>
                        {status}
                    </div>
                )}

                <button onClick={handleSave} className="btn btn-large btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                    {t('save_settings')}
                </button>
            </div>

            <div className="glass-panel section">
                <h2 className="section-title">{t('db_settings_title')}</h2>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>{t('export_format')}</label>
                    <select
                        id="exportFormat"
                        defaultValue="json"
                        style={{ width: '100%', padding: '0.75rem' }}
                    >
                        <option value="json">{t('format_json')}</option>
                        <option value="sqlite">{t('format_sqlite')}</option>
                        <option value="excel">{t('format_excel')}</option>
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={async () => {
                            const formatSelect = document.getElementById('exportFormat') as HTMLSelectElement;
                            const format = formatSelect?.value || 'json';

                            try {
                                const documents = await db.documents.toArray();
                                const settings = await db.settings.toArray();

                                if (format === 'json') {
                                    setDbStatus(t('exporting'));
                                    // Convert Blob image data to base64 for JSON serialization
                                    const exportDocs = await Promise.all(documents.map(async (doc) => {
                                        const exportDoc: any = { ...doc };

                                        // Convert main image_data Blob to base64
                                        if (doc.image_data instanceof Blob) {
                                            const buffer = await doc.image_data.arrayBuffer();
                                            const bytes = new Uint8Array(buffer);
                                            let binary = '';
                                            bytes.forEach(b => binary += String.fromCharCode(b));
                                            exportDoc.image_data = btoa(binary);
                                            exportDoc._image_data_type = doc.image_data.type;
                                        }

                                        // Convert additional_images Blobs to base64
                                        if (doc.additional_images && doc.additional_images.length > 0) {
                                            exportDoc.additional_images = await Promise.all(doc.additional_images.map(async (img) => {
                                                if (img instanceof Blob) {
                                                    const buffer = await img.arrayBuffer();
                                                    const bytes = new Uint8Array(buffer);
                                                    let binary = '';
                                                    bytes.forEach(b => binary += String.fromCharCode(b));
                                                    return { data: btoa(binary), type: img.type };
                                                }
                                                return img;
                                            }));
                                        }

                                        return exportDoc;
                                    }));

                                    const exportData = {
                                        documents: exportDocs,
                                        settings,
                                        exportDate: new Date().toISOString(),
                                        version: 1
                                    };
                                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `arcai-backup-${new Date().toISOString().split('T')[0]}.json`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                } else if (format === 'sqlite') {
                                    setDbStatus(t('exporting'));
                                    const initSqlJs = (await import('sql.js')).default;
                                    const SQL = await initSqlJs({
                                        locateFile: () => '/sql-wasm.wasm'
                                    });
                                    const sqlDb = new SQL.Database();

                                    // Create documents table
                                    sqlDb.run(`
                                        CREATE TABLE documents (
                                            id INTEGER PRIMARY KEY,
                                            type TEXT,
                                            created_date TEXT,
                                            document_date TEXT,
                                            reference_number TEXT,
                                            sender TEXT,
                                            sender_signatory TEXT,
                                            receiver TEXT,
                                            subject TEXT,
                                            attachments_desc TEXT,
                                            cc_distribution TEXT,
                                            content_summary TEXT,
                                            raw_text TEXT,
                                            image_data TEXT,
                                            additional_images TEXT,
                                            structured_data_json TEXT
                                        )
                                    `);

                                    // Create settings table
                                    sqlDb.run(`
                                        CREATE TABLE settings (
                                            id INTEGER PRIMARY KEY,
                                            aiProvider TEXT,
                                            geminiApiKey TEXT,
                                            openaiApiKey TEXT,
                                            llm7ApiKey TEXT,
                                            theme TEXT,
                                            language TEXT,
                                            selectedModel TEXT
                                        )
                                    `);

                                    // Insert documents
                                    for (const doc of documents) {
                                        // Convert blobs to base64 strings for storage
                                        let imageDataStr: string | null = null;
                                        let additionalImagesStr: string | null = null;

                                        if (doc.image_data) {
                                            if (doc.image_data instanceof Blob) {
                                                const buffer = await doc.image_data.arrayBuffer();
                                                const bytes = new Uint8Array(buffer);
                                                let binary = '';
                                                bytes.forEach(b => binary += String.fromCharCode(b));
                                                imageDataStr = btoa(binary);
                                            } else {
                                                imageDataStr = JSON.stringify(doc.image_data);
                                            }
                                        }

                                        if (doc.additional_images && doc.additional_images.length > 0) {
                                            const base64Images: string[] = [];
                                            for (const img of doc.additional_images) {
                                                if (img instanceof Blob) {
                                                    const buffer = await img.arrayBuffer();
                                                    const bytes = new Uint8Array(buffer);
                                                    let binary = '';
                                                    bytes.forEach(b => binary += String.fromCharCode(b));
                                                    base64Images.push(btoa(binary));
                                                }
                                            }
                                            additionalImagesStr = JSON.stringify(base64Images);
                                        }

                                        // Helper to convert undefined to null (sql.js doesn't accept undefined)
                                        const n = (v: any) => v === undefined ? null : v;

                                        sqlDb.run(
                                            `INSERT INTO documents (id, type, created_date, document_date, reference_number, sender, sender_signatory, receiver, subject, attachments_desc, cc_distribution, content_summary, raw_text, image_data, additional_images, structured_data_json)
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                            [n(doc.id), n(doc.type), n(doc.created_date), n(doc.document_date), n(doc.reference_number), n(doc.sender), n(doc.sender_signatory), n(doc.receiver), n(doc.subject), n(doc.attachments_desc), n(doc.cc_distribution), n(doc.content_summary), n(doc.raw_text), n(imageDataStr), n(additionalImagesStr), doc.structured_data_json ? JSON.stringify(doc.structured_data_json) : null]
                                        );
                                    }

                                    // Insert settings
                                    // Helper to convert undefined to null
                                    const toNull = (v: any) => v === undefined ? null : v;
                                    for (const setting of settings) {
                                        sqlDb.run(
                                            `INSERT INTO settings (id, aiProvider, geminiApiKey, openaiApiKey, llm7ApiKey, theme, language, selectedModel)
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                            [toNull(setting.id), toNull(setting.aiProvider), toNull(setting.geminiApiKey), toNull(setting.openaiApiKey), toNull(setting.llm7ApiKey), toNull(setting.theme), toNull(setting.language), toNull(setting.selectedModel)]
                                        );
                                    }

                                    const data = sqlDb.export();
                                    const blob = new Blob([new Uint8Array(data)], { type: 'application/x-sqlite3' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `arcai-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    sqlDb.close();
                                } else if (format === 'excel') {
                                    setDbStatus(t('exporting'));
                                    const XLSX = await import('xlsx');

                                    // Prepare documents data for Excel (without binary image data)
                                    const excelDocs = documents.map(doc => ({
                                        id: doc.id,
                                        type: doc.type,
                                        created_date: doc.created_date,
                                        document_date: doc.document_date,
                                        reference_number: doc.reference_number,
                                        sender: doc.sender,
                                        sender_signatory: doc.sender_signatory,
                                        receiver: doc.receiver,
                                        subject: doc.subject,
                                        attachments_desc: doc.attachments_desc,
                                        cc_distribution: doc.cc_distribution,
                                        content_summary: doc.content_summary,
                                        raw_text: doc.raw_text,
                                        has_image: doc.image_data ? 'Yes' : 'No',
                                        additional_images_count: doc.additional_images?.length || 0
                                    }));

                                    // Create workbook and worksheet
                                    const wb = XLSX.utils.book_new();
                                    const ws = XLSX.utils.json_to_sheet(excelDocs);

                                    // Add worksheet to workbook
                                    XLSX.utils.book_append_sheet(wb, ws, 'Documents');

                                    // Generate Excel file
                                    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                                    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `arcai-documents-${new Date().toISOString().split('T')[0]}.xlsx`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                }
                                setDbStatus(t('export_success'));
                            } catch (error: any) {
                                console.error('Export failed:', error);
                                const errorMsg = error?.message || error?.toString() || 'Unknown error';
                                setDbStatus(`Failed: ${errorMsg}`);
                            }
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1, minWidth: '120px' }}
                    >
                        {t('export_db')}
                    </button>
                    <button
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json,.sqlite';
                            input.onchange = async (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (!file) return;

                                const fileName = file.name.toLowerCase();

                                try {
                                    if (fileName.endsWith('.json')) {
                                        const text = await file.text();
                                        const data = JSON.parse(text);

                                        // Preview documents (simplified, without blob conversion)
                                        const previewDocs = (data.documents || []).map((doc: any) => ({
                                            type: doc.type,
                                            subject: doc.subject,
                                            reference_number: doc.reference_number,
                                            document_date: doc.document_date,
                                            created_date: doc.created_date,
                                            sender: doc.sender,
                                            receiver: doc.receiver,
                                            content_summary: doc.content_summary
                                        }));

                                        setPreviewDocuments(previewDocs);
                                        setPreviewSettings(data.settings || []);
                                        setPendingImportData({ documents: data.documents || [], settings: data.settings || [] });
                                        setShowImportPreview(true);
                                    } else if (fileName.endsWith('.sqlite')) {
                                        const initSqlJs = (await import('sql.js')).default;
                                        const SQL = await initSqlJs({
                                            locateFile: () => '/sql-wasm.wasm'
                                        });

                                        const buffer = await file.arrayBuffer();
                                        const sqlDb = new SQL.Database(new Uint8Array(buffer));

                                        // Parse documents for preview
                                        const docsResult = sqlDb.exec("SELECT type, subject, reference_number, document_date, created_date, sender, receiver, content_summary FROM documents");
                                        const previewDocs: any[] = [];
                                        if (docsResult.length > 0) {
                                            const columns = docsResult[0].columns;
                                            const rows = docsResult[0].values;
                                            for (const row of rows) {
                                                const doc: any = {};
                                                columns.forEach((col, idx) => {
                                                    doc[col] = row[idx];
                                                });
                                                previewDocs.push(doc);
                                            }
                                        }

                                        // Get all documents data for actual import
                                        const allDocsResult = sqlDb.exec("SELECT * FROM documents");
                                        const fullDocs: any[] = [];
                                        if (allDocsResult.length > 0) {
                                            const columns = allDocsResult[0].columns;
                                            const rows = allDocsResult[0].values;
                                            for (const row of rows) {
                                                const doc: any = { _isSqlite: true };
                                                columns.forEach((col, idx) => {
                                                    doc[col] = row[idx];
                                                });
                                                fullDocs.push(doc);
                                            }
                                        }

                                        // Get settings
                                        const settingsResult = sqlDb.exec("SELECT * FROM settings");
                                        const settings: any[] = [];
                                        if (settingsResult.length > 0) {
                                            const columns = settingsResult[0].columns;
                                            const rows = settingsResult[0].values;
                                            for (const row of rows) {
                                                const setting: any = {};
                                                columns.forEach((col, idx) => {
                                                    setting[col] = row[idx];
                                                });
                                                settings.push(setting);
                                            }
                                        }

                                        sqlDb.close();

                                        setPreviewDocuments(previewDocs);
                                        setPreviewSettings(settings);
                                        setPendingImportData({ documents: fullDocs, settings });
                                        setShowImportPreview(true);
                                    }
                                } catch (error: any) {
                                    console.error('Preview failed:', error);
                                    setDbStatus(`${t('import_error')}: ${error.message}`);
                                }
                            };
                            input.click();
                        }}
                        className="btn btn-outline"
                        style={{
                            flex: 1,
                            minWidth: '120px',
                            border: '2px solid var(--accent-color, #6366f1)',
                            color: 'var(--text-primary)',
                            backgroundColor: 'transparent'
                        }}
                    >
                        {t('import_db')}
                    </button>
                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="btn"
                        style={{
                            flex: 1,
                            minWidth: '120px',
                            backgroundColor: '#ef4444',
                            borderColor: '#ef4444',
                            color: 'white'
                        }}
                    >
                        {t('clear_db')}
                    </button>
                </div>

                {dbStatus && (
                    <div className={`status-message ${dbStatus.includes('Failed') || dbStatus.includes(t('import_error')) ? 'error' : 'success'}`} style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: dbStatus.includes('Failed') || dbStatus.includes(t('import_error')) ? '#fee2e2' : '#dcfce7',
                        color: dbStatus.includes('Failed') || dbStatus.includes(t('import_error')) ? '#b91c1c' : '#166534',
                        border: `1px solid ${dbStatus.includes('Failed') || dbStatus.includes(t('import_error')) ? '#fca5a5' : '#bbf7d0'}`,
                    }}>
                        {dbStatus}
                    </div>
                )}
            </div>

            <DeleteConfirmModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={async () => {
                    try {
                        await db.documents.clear();
                        setDbStatus(t('clear_db_success'));
                    } catch (error: any) {
                        console.error('Clear database failed:', error);
                        setDbStatus(`Failed: ${error?.message || 'Unknown error'}`);
                    }
                }}
                title={t('clear_db')}
                message={t('clear_db_confirm')}
                confirmText={t('clear_db')}
            />

            <ImportPreviewModal
                isOpen={showImportPreview}
                documents={previewDocuments}
                settingsCount={previewSettings.length}
                onCancel={() => {
                    setShowImportPreview(false);
                    setPreviewDocuments([]);
                    setPreviewSettings([]);
                    setPendingImportData(null);
                }}
                onConfirm={async () => {
                    if (!pendingImportData) return;

                    try {
                        setDbStatus(t('importing'));

                        // Import documents
                        if (pendingImportData.documents && pendingImportData.documents.length > 0) {
                            await db.documents.clear();

                            for (const doc of pendingImportData.documents) {
                                const { id, _image_data_type, _isSqlite, ...docData } = doc;

                                // Handle JSON format (base64 image data)
                                if (!_isSqlite) {
                                    // Convert base64 image_data back to Blob
                                    if (typeof docData.image_data === 'string' && docData.image_data.length > 0) {
                                        try {
                                            const binary = atob(docData.image_data);
                                            const bytes = new Uint8Array(binary.length);
                                            for (let i = 0; i < binary.length; i++) {
                                                bytes[i] = binary.charCodeAt(i);
                                            }
                                            docData.image_data = new Blob([bytes], { type: _image_data_type || 'image/png' });
                                        } catch (e) {
                                            console.error('Failed to convert image_data:', e);
                                        }
                                    }

                                    // Convert additional_images
                                    if (docData.additional_images && Array.isArray(docData.additional_images)) {
                                        docData.additional_images = docData.additional_images.map((img: any) => {
                                            if (img && typeof img.data === 'string') {
                                                try {
                                                    const binary = atob(img.data);
                                                    const bytes = new Uint8Array(binary.length);
                                                    for (let i = 0; i < binary.length; i++) {
                                                        bytes[i] = binary.charCodeAt(i);
                                                    }
                                                    return new Blob([bytes], { type: img.type || 'image/png' });
                                                } catch (e) {
                                                    return img;
                                                }
                                            }
                                            return img;
                                        });
                                    }
                                } else {
                                    // Handle SQLite format
                                    if (typeof docData.image_data === 'string' && docData.image_data.length > 0) {
                                        try {
                                            const binary = atob(docData.image_data);
                                            const bytes = new Uint8Array(binary.length);
                                            for (let i = 0; i < binary.length; i++) {
                                                bytes[i] = binary.charCodeAt(i);
                                            }
                                            docData.image_data = new Blob([bytes], { type: 'image/png' });
                                        } catch (e) {
                                            docData.image_data = null;
                                        }
                                    }

                                    if (typeof docData.additional_images === 'string' && docData.additional_images.length > 0) {
                                        try {
                                            const images = JSON.parse(docData.additional_images);
                                            docData.additional_images = images.map((imgBase64: string) => {
                                                const binary = atob(imgBase64);
                                                const bytes = new Uint8Array(binary.length);
                                                for (let i = 0; i < binary.length; i++) {
                                                    bytes[i] = binary.charCodeAt(i);
                                                }
                                                return new Blob([bytes], { type: 'image/png' });
                                            });
                                        } catch (e) {
                                            docData.additional_images = [];
                                        }
                                    }

                                    if (typeof docData.structured_data_json === 'string') {
                                        try {
                                            docData.structured_data_json = JSON.parse(docData.structured_data_json);
                                        } catch (e) {
                                            docData.structured_data_json = null;
                                        }
                                    }
                                }

                                await db.documents.add(docData);
                            }
                        }

                        // Import settings
                        if (pendingImportData.settings && pendingImportData.settings.length > 0) {
                            await db.settings.clear();
                            for (const setting of pendingImportData.settings) {
                                const { id, ...settingWithoutId } = setting;
                                await db.settings.add(settingWithoutId);
                            }
                            const newSettings = pendingImportData.settings[0];
                            setAiProvider(newSettings.aiProvider || 'gemini');
                            setGeminiKey(newSettings.geminiApiKey || '');
                            setOpenaiKey(newSettings.openaiApiKey || '');
                            setLlm7Key(newSettings.llm7ApiKey || '');
                            if (newSettings.theme) setTheme(newSettings.theme);
                            if (newSettings.language) setLanguage(newSettings.language);
                            if (newSettings.selectedModel) setSelectedModel(newSettings.selectedModel);
                        }

                        setDbStatus(t('import_success'));
                    } catch (error: any) {
                        console.error('Import failed:', error);
                        setDbStatus(`${t('import_error')}: ${error.message}`);
                    } finally {
                        setShowImportPreview(false);
                        setPreviewDocuments([]);
                        setPreviewSettings([]);
                        setPendingImportData(null);
                    }
                }}
            />
        </div>
    );
};
