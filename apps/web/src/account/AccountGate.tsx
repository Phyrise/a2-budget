/**
 * Porte de l'app (V5) : l'accueil tant qu'aucun choix n'est mémorisé, sinon
 * l'app. Sans configuration Firebase, l'app directement (comme avant).
 *
 * L'app n'est pas montée derrière l'accueil : la forêt WebGL et le store ne
 * démarrent qu'une fois le choix fait.
 */
import type { ReactNode } from 'react';
import { FIREBASE_ENABLED } from '../sync/firebase/config';
import { useAccount } from './AccountContext';
import { showsWelcome } from './accountModel';
import { Welcome } from './Welcome';

export function AccountGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  if (FIREBASE_ENABLED && account.enabled && showsWelcome(account)) return <Welcome />;
  return <>{children}</>;
}
