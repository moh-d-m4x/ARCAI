import React, { useEffect, useState } from 'react';
import { db } from '../db';
import { useLanguage } from '../contexts/LanguageContext';
import { useRateLimit } from '../contexts/RateLimitContext';
import type { AIProvider } from '../types';

export const Settings: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const { resetRateLimit } = useRateLimit();
    const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [llm7Key, setLlm7Key] = useState('');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');
    const [status, setStatus] = useState('');

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

            // Reset rate limit to give fresh credits with new API key
            resetRateLimit();

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
            <h1 className="page-title">{t('settings')}</h1>

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
        </div>
    );
};
