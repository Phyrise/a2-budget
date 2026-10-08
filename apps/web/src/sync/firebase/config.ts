/**
 * Configuration Firebase (V5), lue au build dans les variables `VITE_FIREBASE_*`
 * (`apps/web/.env.production`, versionné : ce ne sont pas des secrets).
 *
 * Module pur, dans le bundle principal : n'importe JAMAIS Firebase. Sans
 * configuration, `FIREBASE_ENABLED` vaut la constante `false` au build, le
 * chargement du SDK (loader.ts) disparaît du code et l'app reste celle
 * d'aujourd'hui : ni écran d'accueil, ni chunk Firebase.
 *
 * Mode émulateurs (`VITE_FIREBASE_EMULATORS=1`, fichier `.env.emulators`) :
 * projet de démonstration `demo-a2home`, Auth et Firestore locaux (ports de
 * firebase.json), connexion par faux jeton Google possible (QA seulement).
 */

export interface FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface EmulatorHosts {
  host: string;
  authPort: number;
  firestorePort: number;
}

export interface FirebaseSetup {
  options: FirebaseOptions;
  /** Émulateurs locaux (développement et QA), sinon null. */
  emulators: EmulatorHosts | null;
}

/** Projet de démonstration des émulateurs (préfixe `demo-` : rien de réel). */
export const EMULATOR_PROJECT_ID = 'demo-a2home';
/** Ports des émulateurs, les mêmes que firebase.json (config.test.ts le vérifie). */
export const EMULATOR_PORTS = { auth: 9180, firestore: 8180 } as const;

type Env = Readonly<Record<string, unknown>>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Lit la configuration ; null = pas de Firebase (l'app reste 100 % locale). */
export function readFirebaseSetup(env: Env): FirebaseSetup | null {
  if (text(env.VITE_FIREBASE_EMULATORS) === '1') {
    return {
      options: {
        apiKey: 'demo-api-key',
        authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
        projectId: EMULATOR_PROJECT_ID,
        appId: 'demo-a2home-web',
      },
      emulators: {
        host: text(env.VITE_FIREBASE_EMULATOR_HOST) ?? '127.0.0.1',
        authPort: EMULATOR_PORTS.auth,
        firestorePort: EMULATOR_PORTS.firestore,
      },
    };
  }
  const apiKey = text(env.VITE_FIREBASE_API_KEY);
  const authDomain = text(env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = text(env.VITE_FIREBASE_PROJECT_ID);
  const appId = text(env.VITE_FIREBASE_APP_ID);
  if (apiKey === null || authDomain === null || projectId === null || appId === null) return null;
  const storageBucket = text(env.VITE_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = text(env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  return {
    options: {
      apiKey,
      authDomain,
      projectId,
      appId,
      ...(storageBucket !== null && { storageBucket }),
      ...(messagingSenderId !== null && { messagingSenderId }),
    },
    emulators: null,
  };
}

/**
 * Vrai si Firebase est configuré (les mêmes quatre variables que
 * `readFirebaseSetup`). Expression sur les variables elles-mêmes (remplacées
 * au build), sans appel de fonction : sans elles, Rollup la réduit à `false`
 * et élimine le chargement du SDK (aucun chunk produit).
 */
export const FIREBASE_ENABLED: boolean =
  import.meta.env.VITE_FIREBASE_EMULATORS === '1' ||
  (!!import.meta.env.VITE_FIREBASE_API_KEY &&
    !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    !!import.meta.env.VITE_FIREBASE_APP_ID);

/** Build de QA sur émulateurs : seul cas où le faux jeton Google existe. */
export const FIREBASE_EMULATORS: boolean = import.meta.env.VITE_FIREBASE_EMULATORS === '1';

/** La configuration de ce build (variables lues une à une, remplacées au build). */
export function buildFirebaseSetup(): FirebaseSetup | null {
  return readFirebaseSetup({
    VITE_FIREBASE_EMULATORS: import.meta.env.VITE_FIREBASE_EMULATORS,
    VITE_FIREBASE_EMULATOR_HOST: import.meta.env.VITE_FIREBASE_EMULATOR_HOST,
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  });
}
