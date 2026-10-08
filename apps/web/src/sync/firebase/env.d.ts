/** Variables de build Firebase (V5), toutes facultatives : voir config.ts. */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_EMULATORS?: string;
  readonly VITE_FIREBASE_EMULATOR_HOST?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
}
