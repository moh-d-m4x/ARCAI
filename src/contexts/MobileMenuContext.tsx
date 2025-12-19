import { createContext, useContext } from 'react';

interface MobileMenuContextType {
    toggleMenu: () => void;
    isOpen: boolean;
}

const MobileMenuContext = createContext<MobileMenuContextType | undefined>(undefined);

export const MobileMenuProvider = MobileMenuContext.Provider;

export const useMobileMenu = () => {
    const context = useContext(MobileMenuContext);
    if (!context) {
        throw new Error('useMobileMenu must be used within a MobileMenuProvider');
    }
    return context;
};
