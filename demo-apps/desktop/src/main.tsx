import React from 'react';
import {createRoot} from 'react-dom/client';
import {DesktopApp} from './app';
import {createTauriWindowPort, detachedDocumentKey} from './platform/tauri-windows';
/* Font files are imported as separate stylesheets so Vite resolves their relative font URLs. */
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/manrope/index.css';
import '@fontsource-variable/source-sans-3/index.css';
import '@fontsource-variable/nunito-sans/index.css';
import '@fontsource-variable/noto-sans-arabic/index.css';
import '@fontsource-variable/noto-sans-devanagari/index.css';
import '@fontsource-variable/noto-sans-malayalam/index.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
import '@pepbits/tokens/reference-fonts.css';
import './globals.css';

/* One port for the process, created outside React so a re-render never builds a second
   map of windows. In a browser it is the unavailable null port and detach is not offered. */
const windows = createTauriWindowPort();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp apiBaseUrl={import.meta.env.VITE_API_URL} windows={windows} detachedDocumentKey={detachedDocumentKey()} aiEnabled={import.meta.env.VITE_AI_ENABLED === 'true'}/>
  </React.StrictMode>,
);
