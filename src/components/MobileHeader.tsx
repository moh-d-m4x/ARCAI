import React from 'react';
import { Menu } from 'lucide-react';

interface MobileHeaderProps {
    title: string;
    onMenuClick: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ title, onMenuClick }) => {
    return (
        <div className="mobile-header">
            <button
                className="mobile-menu-toggle"
                onClick={onMenuClick}
                aria-label="Toggle menu"
            >
                <Menu size={24} />
            </button>
            <h1 className="mobile-header-title">{title}</h1>
        </div>
    );
};
