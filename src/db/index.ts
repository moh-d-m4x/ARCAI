import Dexie, { type Table } from 'dexie';
import type { ArcaiDocument, AppSettings } from '../types';

export class ArcaiDatabase extends Dexie {
    documents!: Table<ArcaiDocument, number>;
    settings!: Table<AppSettings, number>;

    constructor() {
        super('ArcaiDB');
        this.version(1).stores({
            documents: '++id, type, created_date, document_date, reference_number, sender, receiver, subject',
            settings: '++id' // We'll only store one row for settings
        });
    }

    async getNextDocumentId(): Promise<number> {
        const lastDoc = await this.documents.orderBy('id').last();
        return (lastDoc?.id || 0) + 1;
    }
}

export const db = new ArcaiDatabase();

// Initialize settings if they don't exist
db.on('populate', () => {
    db.settings.add({
        aiProvider: 'gemini',
        geminiApiKey: '',
        openaiApiKey: '',
        llm7ApiKey: '',
        theme: 'light',
        language: 'ar'
    });
});
