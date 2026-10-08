/**
 * Porte de l'app (V5) : l'accueil tant qu'aucun choix n'est mémorisé, puis
 * l'écran de première connexion tant que ce téléphone n'a pas rejoint le
 * foyer, sinon l'app. Sans configuration Firebase, l'app directement (comme
 * avant).
 *
 * L'app n'est pas montée derrière ces écrans : la forêt WebGL et le store ne
 * démarrent qu'une fois le choix fait. Le store suit le mode (StoreForMode) :
 * données locales, ou copie commune (remonté quand le lien change).
 */
import type { ReactNode } from 'react';
import { AppProvider } from '../state/store';
import { FIREBASE_ENABLED } from '../sync/firebase/config';
import { useAccount } from './AccountContext';
import { showsWelcome } from './accountModel';
import { useSync } from './SyncContext';
import { SyncSetup } from './SyncSetup';
import { Welcome } from './Welcome';

export function AccountGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const { mode } = useSync();
  if (FIREBASE_ENABLED && account.enabled && showsWelcome(account)) return <Welcome />;
  if (FIREBASE_ENABLED && mode === 'setup') return <SyncSetup />;
  return <>{children}</>;
}

/** Le store de l'app : données de ce téléphone (invité), ou copie commune. */
export function StoreForMode({ children }: { children: ReactNode }) {
  const { link } = useSync();
  return (
    <AppProvider key={link === null ? 'local' : `sync-${link.id}`} {...(link !== null ? { sync: link } : {})}>
      {children}
    </AppProvider>
  );
}
