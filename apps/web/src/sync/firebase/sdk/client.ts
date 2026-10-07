/**
 * Initialisation du SDK Firebase (modulaire v12). Seul dossier de l'app qui
 * importe `firebase/*` : il n'est atteint que par l'import dynamique de
 * `../loader.ts` (chunk à part, jamais chargé en invité ni sans config).
 * firebaseImports.test.ts le garantit.
 *
 * - Auth : session gardée sur le téléphone (`browserLocalPersistence`), on
 *   se connecte une fois ; résolveur fenêtre / redirection fourni d'emblée.
 * - Firestore : cache persistant IndexedDB (lectures hors ligne, écritures
 *   en file gardées au rechargement), plusieurs onglets cohérents.
 * - Émulateurs : Auth et Firestore locaux (projet demo-a2home).
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseSetup } from '../config';

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  setup: FirebaseSetup;
}

const APP_NAME = 'a2home';

let client: FirebaseClient | null = null;

/** Une seule initialisation par page (StrictMode, onglets : idempotent). */
export function firebaseClient(setup: FirebaseSetup): FirebaseClient {
  if (client !== null) return client;
  const existing = getApps().find((app) => app.name === APP_NAME);
  const app = existing ?? initializeApp(setup.options, APP_NAME);
  const auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (setup.emulators !== null) {
    const { host, authPort, firestorePort } = setup.emulators;
    connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, firestorePort);
  }
  client = { app, auth, db, setup };
  return client;
}
