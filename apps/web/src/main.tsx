import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProvider } from './state/store';
import './styles/tokens.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Racine #root introuvable');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
