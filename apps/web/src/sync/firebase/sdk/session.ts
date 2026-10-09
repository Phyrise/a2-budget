/**
 * Session Firebase de l'app (chunk à part, chargé par `../loader.ts`) :
 * connexion Google, liste blanche, déconnexion, foyer, première connexion
 * (setup.ts) et synchronisation (runtime.ts).
 *
 * - Fenêtre Google (`signInWithPopup`) ; redirection sur l'app installée
 *   d'un iPhone, seulement si la page de connexion est servie par le site
 *   lui-même (`redirectReady`), sinon le message « bientôt » de l'accueil.
 * - Tout compte connecté passe par la liste blanche : un autre compte est
 *   annoncé (`refused`) puis déconnecté aussitôt. Les règles Firestore
 *   refusent de toute façon tout ce qu'il demanderait.
 * - Build émulateurs seulement : connexion par faux jeton Google (QA).
 */
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { accountVerdict, normalizeEmail } from '../../allowlist';
import { FIREBASE_EMULATORS, buildFirebaseSetup } from '../config';
import { redirectWorks } from '../platform';
import {
  errorCode,
  outcomeForAuthError,
  type FirebaseSession,
  type SessionEvent,
  type SignInOutcome,
  type SyncRuntime,
} from '../types';
import { firebaseClient } from './client';
import { ensureHousehold } from './household';
import { openLive } from './live';
import { openLetters } from './letters';
import { bumpLetters, resetHousehold } from './reset';
import { openRuntime } from './runtime';
import { syncSetup } from './setup';

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Plusieurs comptes Google sur le téléphone : toujours laisser choisir.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function eventFor(user: User | null): SessionEvent {
  if (user === null) return { kind: 'signed-out' };
  const verdict = accountVerdict({ email: user.email, emailVerified: user.emailVerified });
  if ('refused' in verdict) return { kind: 'refused', reason: verdict.refused };
  return { kind: 'member', member: { uid: user.uid, email: normalizeEmail(user.email ?? ''), role: verdict.role } };
}

export function openSession(): FirebaseSession {
  const setup = buildFirebaseSetup();
  if (setup === null) throw new Error('Firebase non configuré');
  const { auth, db } = firebaseClient(setup);

  // Retour d'une redirection (iPhone) : une erreur se dit à l'accueil.
  const redirectError = getRedirectResult(auth).then(
    () => null,
    (error: unknown) => outcomeForAuthError(errorCode(error)),
  );

  // Une seule synchronisation à la fois (changement de compte, remontage).
  let runtime: SyncRuntime | null = null;

  const attempt = async (run: () => Promise<unknown>): Promise<SignInOutcome> => {
    try {
      await run();
      return { kind: 'done' };
    } catch (error) {
      return outcomeForAuthError(errorCode(error));
    }
  };

  const session: FirebaseSession = {
    preferRedirect: setup.emulators === null && redirectWorks(setup.options.authDomain, window.location.hostname),
    redirectReady:
      setup.emulators !== null || redirectWorks(setup.options.authDomain, window.location.hostname),

    watch(listener) {
      let active = true;
      void redirectError.then((outcome) => {
        if (active && outcome !== null && outcome.kind === 'failed') listener({ kind: 'failed', notice: outcome.notice });
      });
      const stop = onAuthStateChanged(auth, (user) => {
        const event = eventFor(user);
        listener(event);
        // Compte refusé : déconnecté tout de suite (rien n'est gardé).
        if (event.kind === 'refused') void signOut(auth).catch(() => undefined);
      });
      return () => {
        active = false;
        stop();
      };
    },

    signIn(method) {
      if (method === 'redirect') {
        if (!session.redirectReady) return Promise.resolve({ kind: 'failed', notice: 'ios-later' });
        return attempt(() => signInWithRedirect(auth, googleProvider())).then((outcome) =>
          outcome.kind === 'done' ? { kind: 'redirecting' } : outcome,
        );
      }
      return attempt(() => signInWithPopup(auth, googleProvider()));
    },

    signOut: () => {
      runtime?.dispose();
      runtime = null;
      return signOut(auth);
    },

    ensureHousehold: (member) => ensureHousehold(db, member),

    setup: (member) => syncSetup(db, member),

    openSync(member, cache, selectedMonth) {
      runtime?.dispose();
      runtime = openRuntime(db, member, cache, selectedMonth);
      return runtime;
    },

    openLive: (member) => openLive(db, member),
    openLetters: (member) => openLetters(db, member),
    resetHousehold: (member) => resetHousehold(db, member),
    bumpLetters: (member) => bumpLetters(db, member),
  };

  if (FIREBASE_EMULATORS && setup.emulators !== null) {
    // Faux jeton Google accepté par l'émulateur Auth seulement (jamais en production).
    session.signInWithFakeGoogle = (email, emailVerified = true) =>
      attempt(() =>
        signInWithCredential(
          auth,
          GoogleAuthProvider.credential(JSON.stringify({ sub: `qa-${normalizeEmail(email)}`, email, email_verified: emailVerified })),
        ),
      );
  }
  return session;
}
