import React, { useEffect, useState, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { MobileMenuProvider } from '../contexts/MobileMenuContext';

export const Layout: React.FC = () => {
    console.log('Layout rendering...');
    const settings = useLiveQuery(() => db.settings.limit(1).toArray());
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        if (settings && settings[0]) {
            document.body.setAttribute('data-theme', settings[0].theme);
        }
    }, [settings]);

    // Close mobile menu when route changes
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const toggleMobileMenu = () => {
        setMobileMenuOpen(prev => !prev);
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    const mobileMenuContextValue = useMemo(() => ({
        toggleMenu: toggleMobileMenu,
        isOpen: mobileMenuOpen
    }), [mobileMenuOpen]);

    return (
        <MobileMenuProvider value={mobileMenuContextValue}>
            <div className="app-container">
                {/* Overlay for closing menu when clicking outside */}
                {mobileMenuOpen && (
                    <div
                        className="mobile-menu-overlay"
                        onClick={closeMobileMenu}
                    />
                )}

                <Sidebar isOpen={mobileMenuOpen} onClose={closeMobileMenu} />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </MobileMenuProvider>
    );
};

