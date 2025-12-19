import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'overlayscrollbars/overlayscrollbars.css'
import App from './App'
import { LanguageProvider } from './contexts/LanguageContext';
import { OverlayScrollbars, ClickScrollPlugin } from 'overlayscrollbars';

// Register the ClickScrollPlugin for click-on-track functionality
OverlayScrollbars.plugin(ClickScrollPlugin);

console.log('Mounting React Application...');

// Initialize OverlayScrollbars on body for smooth scrollbar
const isMobile = window.innerWidth <= 768;
OverlayScrollbars(document.body, {
  scrollbars: {
    theme: 'os-theme-custom',
    visibility: 'auto',
    autoHide: isMobile ? 'scroll' : 'never',
    autoHideDelay: 1000,
    dragScroll: true,
    clickScroll: true,
  },
  overflow: {
    x: 'hidden',
    y: 'scroll',
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)


