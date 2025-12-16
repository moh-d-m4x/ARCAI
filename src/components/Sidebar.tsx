import { useLanguage } from '../contexts/LanguageContext';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings } from 'lucide-react';
import { Logo } from './Logo';

export const Sidebar: React.FC = () => {
    const { t } = useLanguage();

    const navItems = [
        { icon: <LayoutDashboard size={20} />, label: t('dashboard'), path: '/' },
        { icon: <FileText size={20} />, label: t('entry'), path: '/entry' },
        { icon: <Settings size={20} />, label: t('settings'), path: '/settings' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-inner glass">
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
