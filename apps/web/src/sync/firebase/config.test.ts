import { describe, expect, it } from 'vitest';
import firebaseJson from '../../../../../firebase.json';
import { EMULATOR_PORTS, EMULATOR_PROJECT_ID, FIREBASE_ENABLED, buildFirebaseSetup, readFirebaseSetup } from './config';

const PUBLIC_CONFIG = {
  VITE_FIREBASE_API_KEY: 'AIzaExemple',
  VITE_FIREBASE_AUTH_DOMAIN: 'phyrise.github.io',
  VITE_FIREBASE_PROJECT_ID: 'a2-home-7f3c1',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
};

describe('configuration Firebase', () => {
  it('sans variables : pas de Firebase (l’app reste locale)', () => {
    expect(readFirebaseSetup({})).toBeNull();
    expect(readFirebaseSetup({ VITE_FIREBASE_PROJECT_ID: 'x' })).toBeNull();
    expect(readFirebaseSetup({ ...PUBLIC_CONFIG, VITE_FIREBASE_API_KEY: '  ' })).toBeNull();
    expect(readFirebaseSetup({ VITE_FIREBASE_EMULATORS: '0' })).toBeNull();
  });

  it('ce build de test n’a aucune configuration', () => {
    expect(FIREBASE_ENABLED).toBe(false);
    expect(buildFirebaseSetup()).toBeNull();
  });

  it('config publique complète, champs facultatifs gardés s’ils existent', () => {
    expect(readFirebaseSetup(PUBLIC_CONFIG)).toEqual({
      options: { apiKey: 'AIzaExemple', authDomain: 'phyrise.github.io', projectId: 'a2-home-7f3c1', appId: '1:123:web:abc' },
      emulators: null,
    });
    expect(
      readFirebaseSetup({ ...PUBLIC_CONFIG, VITE_FIREBASE_MESSAGING_SENDER_ID: '123', VITE_FIREBASE_STORAGE_BUCKET: 'b' })
        ?.options,
    ).toMatchObject({ messagingSenderId: '123', storageBucket: 'b' });
  });

  it('émulateurs : projet de démonstration et ports de firebase.json', () => {
    const setup = readFirebaseSetup({ VITE_FIREBASE_EMULATORS: '1', ...PUBLIC_CONFIG });
    expect(setup?.options.projectId).toBe(EMULATOR_PROJECT_ID);
    expect(EMULATOR_PROJECT_ID.startsWith('demo-')).toBe(true);
    expect(setup?.emulators).toEqual({ host: '127.0.0.1', authPort: 9180, firestorePort: 8180 });
    expect(EMULATOR_PORTS).toEqual({
      auth: firebaseJson.emulators.auth.port,
      firestore: firebaseJson.emulators.firestore.port,
    });
    expect(readFirebaseSetup({ VITE_FIREBASE_EMULATORS: '1', VITE_FIREBASE_EMULATOR_HOST: '192.168.1.20' })?.emulators?.host).toBe(
      '192.168.1.20',
    );
  });
});
