import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
}) => {
    const { t, dir } = useLanguage();
    const [pageInput, setPageInput] = useState(currentPage.toString());

    useEffect(() => {
        setPageInput(currentPage.toString());
    }, [currentPage]);

    if (totalPages <= 1) return null;

    const handleInputKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const page = parseInt(pageInput);
            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                onPageChange(page);
            } else {
                // Reset if invalid
                setPageInput(currentPage.toString());
            }
        }
    };

    const handleBlur = () => {
        const page = parseInt(pageInput);
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
            onPageChange(page);
        } else {
            setPageInput(currentPage.toString());
        }
    };

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages = [];
        const maxVisibleButtons = 5; // e.g. 1 ... 4 5 6 ... 10

        if (totalPages <= maxVisibleButtons + 2) {
            // Show all if few
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            // Always show first
            pages.push(1);

            // Calculate start and end of visible window
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            // Adjust window if close to beginning or end
            if (currentPage <= 3) {
                end = 4;
            } else if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
            }

            // Ellipsis before window
            if (start > 2) {
                pages.push('...');
            }

            // Window
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            // Ellipsis after window
            if (end < totalPages - 1) {
                pages.push('...');
            }

            // Always show last
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="pagination-container flex flex-col items-center gap-4 mt-8 pb-8">
            <div className="flex items-center gap-2">
                <button
                    className="pagination-btn icon-btn p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    title={t('prev_page') || 'Previous'}
                >
                    {dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>

                <div className="pagination-numbers flex items-center gap-2">
                    {getPageNumbers().map((p, idx) => (
                        <React.Fragment key={idx}>
                            {p === '...' ? (
                                <span className="pagination-ellipsis px-2 text-gray-500">...</span>
                            ) : (
                                <button
                                    className={`pagination-number w-10 h-10 rounded-full flex items-center justify-center transition-all font-medium ${currentPage === p
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-110'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                        }`}
                                    onClick={() => typeof p === 'number' && onPageChange(p)}
                                >
                                    {p}
                                </button>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <button
                    className="pagination-btn icon-btn p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title={t('next_page') || 'Next'}
                >
                    {dir === 'rtl' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>
            </div>

            <div className="jump-to-page flex items-center gap-3 text-sm text-gray-400 bg-gray-800/50 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5">
                <span className="font-medium">{t('go_to_page') || 'Go to page'}</span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={handleInputKey}
                    onBlur={handleBlur}
                    className="w-12 px-0 py-1 bg-transparent border-b border-gray-600 text-center focus:border-blue-500 outline-none transition-colors text-white font-mono"
                />
                <span className="text-gray-600">/ {totalPages}</span>
            </div>
        </div>
    );
};
