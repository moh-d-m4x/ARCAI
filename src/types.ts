export type DocumentType = 'Incoming' | 'Outgoing';

export interface ArcaiDocument {
    id?: number;
    type: DocumentType;
    created_date: string; // ISO String
    document_date: string; // Extracted date
    reference_number: string;
    sender: string;
    sender_signatory?: string;
    receiver: string;
    subject: string;
    attachments_desc?: string;
    cc_distribution?: string;
    content_summary: string;
    structured_data_json?: any; // For tables/flexible data
    image_data: Blob; // The actual scanner image
    raw_text: string; // OCR content
}

export type AIProvider = 'gemini' | 'openai' | 'llm7';

export interface AppSettings {
    id?: number;
    aiProvider: AIProvider; // Selected AI provider
    geminiApiKey: string;
    openaiApiKey: string;
    llm7ApiKey: string;
    theme: 'light' | 'dark';
    language: 'ar' | 'en'; // Added language preference
    selectedModel?: string;
}
