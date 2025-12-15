import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

type Language = 'ar' | 'en';

interface Translations {
    [key: string]: {
        ar: string;
        en: string;
    };
}

const translations: Translations = {
    // Sidebar
    'dashboard': { ar: 'المستندات', en: 'Documents' },
    'entry': { ar: 'ادخال', en: 'Entry' },
    'settings': { ar: 'الإعدادات', en: 'Settings' },
    'brandName': { ar: 'أرشيفي', en: 'ARCAI' }, // Optional Arabic brand name?

    // Settings
    'theme': { ar: 'المظهر', en: 'Theme' },
    'language': { ar: 'اللغة / Language', en: 'Language / اللغة' },
    'light': { ar: 'فاتح', en: 'Light' },
    'dark': { ar: 'داكن', en: 'Dark' },
    'arabic': { ar: 'العربية', en: 'Arabic' },
    'english': { ar: 'English', en: 'English' },
    'ai_model': { ar: 'نموذج الذكاء الاصطناعي', en: 'AI Model' },
    'save_settings': { ar: 'حفظ الإعدادات', en: 'Save Settings' },
    'settings_saved': { ar: 'تم حفظ الإعدادات بنجاح', en: 'Settings saved successfully' },
    'ai_provider_label': { ar: 'مزود الذكاء الاصطناعي', en: 'AI Provider' },
    'provider_gemini': { ar: 'جوجل جيميناي', en: 'Google Gemini' },
    'provider_openai': { ar: 'أوبن إيه آي', en: 'OpenAI' },
    'provider_llm7': { ar: 'إل إل إم ٧', en: 'LLM7.io' },
    'api_key_label': { ar: 'مفتاح واجهة برمجة تطبيقات Gemini', en: 'Gemini API Key' },
    'openai_api_key_label': { ar: 'مفتاح واجهة برمجة تطبيقات OpenAI', en: 'OpenAI API Key' },
    'llm7_api_key_label': { ar: 'مفتاح واجهة برمجة تطبيقات LLM7.io', en: 'LLM7.io API Key' },
    'validate_key': { ar: 'تحقق من المفتاح وتحديث النماذج', en: 'Verify Key & Update Models' },
    'models_loading': { ar: 'جاري تحميل النماذج...', en: 'Loading models...' },
    'ai_settings_title': { ar: 'إعدادات الذكاء الاصطناعي', en: 'AI Settings' },

    // Dashboard
    'documents_title': { ar: 'المستندات', en: 'Documents' },
    'search_placeholder': { ar: 'بحث عن الموضوع، المرسل، المحتوى...', en: 'Search subject, sender, content...' },
    'total_docs': { ar: 'المستندات الكلية', en: 'Total Documents' },
    'incoming_docs': { ar: 'المستندات الواردة', en: 'Incoming Documents' },
    'outgoing_docs': { ar: 'المستندات الصادرة', en: 'Outgoing Documents' },
    'no_docs': { ar: 'لا توجد مستندات', en: 'No documents found' },
    'start_upload': { ar: 'قم برفع مستند جديد للبدء', en: 'Upload a new entry to get started.' },
    'new_entry_btn': { ar: '+ ادخال جديد', en: '+ New Entry' },
    'view_btn': { ar: 'عرض', en: 'View' },
    'no_subject': { ar: 'بدون موضوع', en: 'No Subject' },
    'unknown_org': { ar: 'غير معروف', en: 'Unknown' },

    // Entry
    'new_entry_title': { ar: 'ادخال', en: 'New Entry' },
    'doc_image_title': { ar: 'صورة المذكرة', en: 'Document Image' },
    'change_image': { ar: 'تغيير الصورة', en: 'Change Image' },
    'click_to_upload': { ar: 'اضغط هنا لاختيار مستند', en: 'Click to upload document' },
    'available_credits': { ar: 'النقاط المتاحة', en: 'Credits Available' },
    'next_credit_in': { ar: 'النقطة التالية في', en: 'Next credit in' },
    'analyzing': { ar: 'تحليل...', en: 'Analyzing...' },
    'analyze_btn': { ar: 'تحليل', en: 'Analyze' },
    'save_doc_btn': { ar: 'حفظ المذكرة', en: 'Save Document' },
    'doc_details_title': { ar: 'تفاصيل المذكرة', en: 'Document Details' },
    'analysis_failed_error': { ar: 'فشل التحليل. تحقق من وحدة التحكم للتفاصيل. تأكد من ضبط مفتاح API.', en: 'Analysis failed. Check console for details. Ensure API Key is set.' },
    'api_quota_exceeded': { ar: 'تم تجاوز حصة Google API اليومية. يرجى الانتظار حتى غداً أو الترقية إلى خطة مدفوعة.', en: 'Google API daily quota exceeded. Please wait until tomorrow or upgrade to a paid plan.' },
    'rate_limit_error': { ar: 'تم الوصول إلى الحد المسموح. يرجى الانتظار حتى يتم تجديد النقاط.', en: 'Rate limit reached. Please wait for a slot to refill.' },

    // Form Fields
    'doc_type': { ar: 'نوع المذكرة:', en: 'Type:' },
    'type_incoming': { ar: 'وارد', en: 'Incoming' },
    'type_outgoing': { ar: 'صادر', en: 'Outgoing' },
    'ref_number': { ar: 'رقم المرجع:', en: 'Reference No:' },
    'doc_date': { ar: 'تاريخ المذكرة:', en: 'Date:' },
    'date_placeholder': { ar: 'YYYY-MM-DD او نص', en: 'YYYY-MM-DD or Text' },
    'sender_label': { ar: 'الجهة:', en: 'Sender:' },
    'signatory_label': { ar: 'الختم/التوقيع:', en: 'Signatory:' },
    'receiver_label': { ar: 'المستلم:', en: 'Receiver:' },
    'subject_label': { ar: 'الموضوع:', en: 'Subject:' },
    'attachments_label': { ar: 'المرفقات:', en: 'Attachments:' },
    'cc_label': { ar: 'نسخة إلى:', en: 'Copy To:' },
    'summary_label': { ar: 'محتوى المذكرة بشكل مختصر:', en: 'Summary:' },
    'confirm_selection': { ar: 'تأكيد الاختيار', en: 'Confirm Selection' },
    'upload_image_first': { ar: 'يرجى رفع صورة أولاً.', en: 'Please upload an image first.' },
    'undo': { ar: 'تراجع', en: 'Undo' },
    'delete_doc_btn': { ar: 'حذف', en: 'Delete' },
    'delete_confirm': { ar: 'هل أنت متأكد من حذف هذا المستند؟', en: 'Are you sure you want to delete this document?' },
    'cancel': { ar: 'إلغاء', en: 'Cancel' },
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
    dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to 'ar' initially, will be updated from DB
    const [language, setLanguage] = useState<Language>('ar');

    // Load settings from DB
    const settings = useLiveQuery(() => db.settings.toArray());

    useEffect(() => {
        if (settings && settings.length > 0) {
            const savedLang = settings[0].language as Language;
            if (savedLang) {
                setLanguage(savedLang);
            }
        }
    }, [settings]);

    useEffect(() => {
        // Update DOM direction
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.dir = dir;
        document.documentElement.lang = language;
    }, [language]);

    const t = (key: string) => {
        return translations[key]?.[language] || key;
    };

    const dir = language === 'ar' ? 'rtl' : 'ltr';

    const value = {
        language,
        setLanguage: (lang: Language) => {
            setLanguage(lang);
        },
        t,
        dir: dir as 'rtl' | 'ltr'
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
