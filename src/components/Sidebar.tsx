import { useLanguage } from '../contexts/LanguageContext';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, X } from 'lucide-react';
import { Logo } from './Logo';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: t('dashboard'), path: '/' },
        { icon: <FileText size={20} />, label: t('entry'), path: '/entry' },
        { icon: <Settings size={20} />, label: t('settings'), path: '/settings' },
    ];

    const handleNavClick = () => {
        // Close mobile menu when navigating
        onClose();
    };

    return (
        <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-inner glass">
                {/* Mobile close button */}
                <button className="mobile-close-btn" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="brand">
                    <div className="brand-logo-wrapper">
                        <Logo size={40} />
                    </div>
                    <h1 className="brand-name">ARCAI</h1>
                </div>

                <nav className="nav-menu">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={handleNavClick}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>
        </aside>
    );
};

