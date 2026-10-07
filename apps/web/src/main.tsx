import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountProvider } from './account/AccountContext';
import { AccountGate } from './account/AccountGate';
import { App } from './app/App';
import { AppProvider } from './state/store';
import './styles/tokens.css';

/** Labo Noiraudes (mode développeur) : `?lab=noiraudes`, chargé à part. */
const NoiraudesLab = lazy(() => import('./features/dev/noiraudes/NoiraudesLab'));

function requestedLab(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('lab');
  } catch {
    return null;
  }
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Racine #root introuvable');
}

createRoot(rootElement).render(
  <StrictMode>
    {requestedLab() === 'noiraudes' ? (
      <Suspense fallback={null}>
        <NoiraudesLab />
      </Suspense>
    ) : (
      <AccountProvider>
        <AccountGate>
          <AppProvider>
            <App />
          </AppProvider>
        </AccountGate>
      </AccountProvider>
    )}
  </StrictMode>,
);
