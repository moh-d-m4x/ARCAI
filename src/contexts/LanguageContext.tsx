import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

    // Database Settings
    'db_settings_title': { ar: 'إعدادات قاعدة البيانات', en: 'Database Settings' },
    'export_db': { ar: 'تصدير', en: 'Export' },
    'import_db': { ar: 'استيراد', en: 'Import' },
    'export_success': { ar: 'تم تصدير قاعدة البيانات بنجاح', en: 'Database exported successfully' },
    'import_success': { ar: 'تم استيراد قاعدة البيانات بنجاح', en: 'Database imported successfully' },
    'import_error': { ar: 'فشل استيراد قاعدة البيانات', en: 'Failed to import database' },
    'export_format': { ar: 'صيغة التصدير', en: 'Export Format' },
    'format_json': { ar: 'JSON (ملف نسخ احتياطي)', en: 'JSON (Backup File)' },
    'format_sqlite': { ar: 'SQLite (قاعدة بيانات)', en: 'SQLite (Database)' },
    'format_excel': { ar: 'Excel (جدول بيانات)', en: 'Excel (Spreadsheet)' },
    'exporting': { ar: 'جاري التصدير...', en: 'Exporting...' },
    'importing': { ar: 'جاري الاستيراد...', en: 'Importing...' },
    'clear_db': { ar: 'مسح الكل', en: 'Clear All' },
    'clear_db_confirm': { ar: 'هل أنت متأكد من حذف جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.', en: 'Are you sure you want to delete all data? This action cannot be undone.' },
    'clear_db_success': { ar: 'تم مسح قاعدة البيانات بنجاح', en: 'Database cleared successfully' },
    'import_preview_title': { ar: 'معاينة الاستيراد', en: 'Import Preview' },
    'documents_to_import': { ar: 'المستندات للاستيراد', en: 'Documents to Import' },
    'confirm_import': { ar: 'تأكيد الاستيراد', en: 'Confirm Import' },
    'no_documents_found': { ar: 'لم يتم العثور على مستندات', en: 'No documents found' },

    // Dashboard
    'documents_title': { ar: 'المستندات', en: 'Documents' },
    'search_placeholder': { ar: 'بحث عن الموضوع، المرسل، المحتوى...', en: 'Search subject, sender, content...' },
    'total_docs': { ar: 'كل المستندات', en: 'Total Documents' },
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
    'analyzing': { ar: 'تحليل...', en: 'Analyzing...' },
    'analyze_btn': { ar: 'تحليل', en: 'Analyze' },
    'save_doc_btn': { ar: 'حفظ المذكرة', en: 'Save Document' },
    'doc_details_title': { ar: 'تفاصيل المذكرة', en: 'Document Details' },
    'analysis_failed_error': { ar: 'فشل التحليل. تحقق من وحدة التحكم للتفاصيل. تأكد من ضبط مفتاح API.', en: 'Analysis failed. Check console for details. Ensure API Key is set.' },
    'model_overloaded_error': { ar: 'نموذج الذكاء الاصطناعي مشغول حالياً. يرجى المحاولة مرة أخرى بعد لحظات.', en: 'The AI model is currently overloaded. Please try again in a few moments.' },

    // Form Fields
    'doc_type': { ar: 'نوع المذكرة:', en: 'Type:' },
    'type_incoming': { ar: 'وارد', en: 'Incoming' },
    'type_outgoing': { ar: 'صادر', en: 'Outgoing' },
    'ref_number': { ar: 'رقم المرجع:', en: 'Reference No:' },
    'doc_date': { ar: 'تاريخ المذكرة:', en: 'Date:' },
    'date_placeholder': { ar: '', en: '' },
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
    'ok': { ar: 'حسناً', en: 'OK' },
    'save_failed': { ar: 'فشل حفظ المستند.', en: 'Failed to save document.' },
    'save_success_message': { ar: 'تم حفظ المستند بنجاح.', en: 'Document saved successfully.' },
    'go_to_page': { ar: 'انتقال', en: 'Go' },

    // Export
    'export_images': { ar: 'تصدير الصور', en: 'Export Images' },
    'print_images': { ar: 'طباعة الصور', en: 'Print Images' },
    'export_as_png': { ar: 'تصدير كـ PNG', en: 'Export as PNG' },
    'export_as_pdf': { ar: 'تصدير كـ PDF', en: 'Export as PDF' },

    // Scanner
    'scanner_btn': { ar: 'مسح ضوئي', en: 'Scan' },
    'scanner_title': { ar: 'مسح مستند', en: 'Scan Document' },
    'select_scanner': { ar: 'اختر الماسح الضوئي', en: 'Select Scanner' },
    'refresh_scanners': { ar: 'تحديث قائمة الماسحات', en: 'Refresh Scanners' },
    'no_scanners': { ar: 'لم يتم العثور على ماسح ضوئي', en: 'No scanners found' },
    'resolution': { ar: 'الدقة', en: 'Resolution' },
    'resolution_low': { ar: 'منخفضة (150 DPI)', en: 'Low (150 DPI)' },
    'resolution_mid': { ar: 'متوسطة (300 DPI)', en: 'Medium (300 DPI)' },
    'resolution_high': { ar: 'عالية (600 DPI)', en: 'High (600 DPI)' },
    'double_sided': { ar: 'مسح وجهي الصفحة', en: 'Scan both sides' },
    'start_scan': { ar: 'بدء المسح', en: 'Start Scan' },
    'scanning': { ar: 'جاري المسح...', en: 'Scanning...' },
    'save_scanned': { ar: 'حفظ الصور', en: 'Save Images' },
    'scan_error': { ar: 'فشل المسح الضوئي', en: 'Scan failed' },
    'scanned_images': { ar: 'الصور الممسوحة', en: 'Scanned Images' },
    'no_scanned_images': { ar: 'لم يتم مسح أي صور بعد', en: 'No images scanned yet' },
    'clear_scanned': { ar: 'مسح الكل', en: 'Clear All' },
    'scanner_error_electron_required': {
        ar: 'تتطلب وظيفة الماسح الضوئي تطبيق سطح المكتب',
        en: 'Scanner functionality requires Desktop Application'
    },

    // Additional Fields
    'created_date': { ar: 'تاريخ الإضافة:', en: 'Created Date:' },
    'source': { ar: 'المصدر', en: 'Source' },
    'source_auto': { ar: 'تلقائي (تغذية ثم سطح مسطح)', en: 'Automatic (Feeder then Flatbed)' },
    'source_feeder': { ar: 'تغذية تلقائية (Feeder)', en: 'Auto Feeder' },
    'source_flatbed': { ar: 'سطح مسطح (Flatbed)', en: 'Flatbed' },

    // Page Size
    'page_size': { ar: 'حجم الورق', en: 'Page Size' },
    'page_size_auto': { ar: 'تلقائي', en: 'Auto Detect' },
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

    const t = useCallback((key: string) => {
        return translations[key]?.[language] || key;
    }, [language]);

    const dir = language === 'ar' ? 'rtl' : 'ltr';

    const value = useMemo(() => ({
        language,
        setLanguage,
        t,
        dir: dir as 'rtl' | 'ltr'
    }), [language, t]);

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
