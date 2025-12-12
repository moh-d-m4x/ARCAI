/**
 * Normalizes Arabic text for better search matching
 * Handles character variations that are semantically similar
 */
export function normalizeArabicText(text: string): string {
    if (!text) return '';

    return text
        // Normalize all Alef variants to plain Alef (ا)
        .replace(/[أإآٱ]/g, 'ا')

        // Normalize Ta Marbuta (ة) to Ha (ه)
        .replace(/ة/g, 'ه')

        // Normalize Waw with hamza (ؤ) to plain Waw (و)
        .replace(/ؤ/g, 'و')

        // Normalize Ya variants to plain Ya (ي)
        .replace(/[ئى]/g, 'ي')

        // Remove Arabic diacritics (tashkeel)
        .replace(/[\u064B-\u065F]/g, '')  // Fatha, Damma, Kasra, Sukun, Shadda, etc.

        // Remove Tatweel (Arabic elongation character)
        .replace(/ـ/g, '');
}
