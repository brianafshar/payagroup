import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { buildCss } from '@baseline/tokens';
import { App } from './app/App';
import { initTheme } from './lib/theme';
import { watchStaleBuild } from './lib/staleBuild';
// Vazirmatn (all UI text) and IBM Plex Mono (codes, links, IDs), self-hosted — same files as Google Fonts.
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './ds/styles/components.css';
import './ds/styles/dark.css';
import './screens/interactions.css';
import './app/app.css';
import './app/responsive.css';

// Design tokens (all white-label themes × light/dark) come from the shared tokens package.
const tokens = document.createElement('style');
tokens.id = 'bl-tokens';
tokens.textContent = buildCss();
document.head.prepend(tokens);
initTheme();
watchStaleBuild();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
