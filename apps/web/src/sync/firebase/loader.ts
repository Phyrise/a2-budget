/**
 * Seule porte vers le SDK Firebase : import dynamique (chunk à part).
 *
 * - Sans configuration, `FIREBASE_ENABLED` est la constante `false` au build :
 *   l'import disparaît et aucun chunk Firebase n'est produit.
 * - En invité, personne n'appelle `loadFirebaseSession` : le SDK n'est jamais
 *   chargé, aucune requête ne part vers Google ou Firebase.
 */
import { FIREBASE_ENABLED } from './config';
import type { FirebaseSession } from './types';

let pending: Promise<FirebaseSession> | null = null;

export function loadFirebaseSession(): Promise<FirebaseSession> {
  // Bloc `if` (et non un retour anticipé) : sans config, Rollup le retire en entier.
  if (FIREBASE_ENABLED) {
    pending ??= import('./sdk/session')
      .then((sdk) => sdk.openSession())
      .catch((error: unknown) => {
        // Hors ligne au premier chargement : on réessaiera plus tard.
        pending = null;
        throw error;
      });
    return pending;
  }
  return Promise.reject(new Error('Firebase non configuré'));
}
