import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export const Layout: React.FC = () => {
    console.log('Layout rendering...');
    const settings = useLiveQuery(() => db.settings.limit(1).toArray());

    useEffect(() => {
        if (settings && settings[0]) {
            document.body.setAttribute('data-theme', settings[0].theme);
        }
    }, [settings]);

    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};
