/**
 * Compte du téléphone (V5) : invité ou membre connecté avec Google.
 *
 * - Sans configuration Firebase : `enabled` = false, rien d'autre ne se passe
 *   (ni accueil, ni Firebase) — l'app d'aujourd'hui.
 * - Invité : Firebase n'est jamais chargé (needsFirebase), aucune requête ne
 *   part vers Google ou Firebase, tout reste sur le téléphone.
 * - Google : SDK chargé à la demande (sync/firebase/loader.ts) ; la session
 *   est relue au démarrage pendant que l'app s'affiche déjà ; un compte hors
 *   liste blanche est déconnecté et ramené à l'accueil avec un mot doux ; le
 *   foyer `a2home` est créé au premier passage d'un membre.
 * - Les données locales (`a2-budget:state:v1`) ne sont jamais touchées ici.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { FIREBASE_EMULATORS, FIREBASE_ENABLED } from '../sync/firebase/config';
import { loadFirebaseSession } from '../sync/firebase/loader';
import { currentPlatform, signInMethod } from '../sync/firebase/platform';
import type { FirebaseSession, SignInOutcome } from '../sync/firebase/types';
import { readEntry, writeEntry } from './accountChoice';
import { accountReducer, initialAccount, needsFirebase, type AccountState } from './accountModel';

export interface Account extends AccountState {
  /** Firebase configuré dans ce build (sinon : app 100 % locale, rien à montrer). */
  enabled: boolean;
  /** Ouvre la connexion Google (fenêtre, ou redirection sur iPhone installé). */
  signIn: () => void;
  /** Charge le SDK dès le toucher du bouton : la fenêtre s'ouvre sans attendre. */
  prepareSignIn: () => void;
  /** Invité : se déconnecte s'il le faut, l'app reste sur ce téléphone. */
  continueAsGuest: () => void;
}

const LOCAL_ACCOUNT: Account = {
  ...initialAccount(null),
  entry: 'guest',
  enabled: false,
  signIn: () => undefined,
  prepareSignIn: () => undefined,
  continueAsGuest: () => undefined,
};

const AccountContext = createContext<Account>(LOCAL_ACCOUNT);

export function useAccount(): Account {
  return useContext(AccountContext);
}

function isLocalHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
}

function FirebaseAccountProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(accountReducer, null, () => initialAccount(readEntry()));
  const session = useRef<FirebaseSession | null>(null);
  const watching = useRef<(() => void) | null>(null);
  const wantsFirebase = needsFirebase(state);

  // Le choix est mémorisé sur le téléphone.
  useEffect(() => {
    writeEntry(state.entry);
  }, [state.entry]);

  /** Charge la session et l'écoute (une seule fois). */
  const ready = useCallback(async (): Promise<FirebaseSession> => {
    const loaded = await loadFirebaseSession();
    session.current = loaded;
    watching.current ??= loaded.watch((event) => dispatch({ type: 'session', event }));
    return loaded;
  }, []);

  useEffect(
    () => () => {
      watching.current?.();
      watching.current = null;
    },
    [],
  );

  // Compte Google : relire la session (au démarrage, ou au retour du réseau).
  useEffect(() => {
    if (!wantsFirebase || watching.current !== null) return;
    let cancelled = false;
    const retry = () => {
      if (!cancelled) void ready().catch(() => undefined);
    };
    retry();
    window.addEventListener('online', retry);
    return () => {
      cancelled = true;
      window.removeEventListener('online', retry);
    };
  }, [wantsFirebase, ready]);

  // Premier passage d'un membre : le foyer et sa fiche (réessayé au retour du réseau).
  const { member, household } = state;
  useEffect(() => {
    if (member === null || household === 'ready' || session.current === null) return;
    const current = session.current;
    if (household === 'offline' || household === 'failed') {
      const again = () => dispatch({ type: 'household', status: 'pending' });
      window.addEventListener('online', again);
      return () => window.removeEventListener('online', again);
    }
    let cancelled = false;
    void current.ensureHousehold(member).then((status) => {
      if (!cancelled) dispatch({ type: 'household', status });
    });
    return () => {
      cancelled = true;
    };
  }, [member, household]);

  const run = useCallback(
    (attempt: (loaded: FirebaseSession) => Promise<SignInOutcome>) => {
      dispatch({ type: 'connect' });
      // SDK déjà là (préchargé au toucher) : la fenêtre s'ouvre dans le geste
      // même, sans attente qui la ferait bloquer (Safari).
      const loaded = session.current;
      (loaded !== null ? attempt(loaded) : ready().then(attempt)).then(
        (outcome) => dispatch({ type: 'outcome', outcome }),
        () => dispatch({ type: 'load-failed' }),
      );
    },
    [ready],
  );

  const signIn = useCallback(() => {
    const preferred = signInMethod(currentPlatform());
    run((loaded) => {
      // Helper de connexion sur le même site : pas de fenêtre en plus, la
      // connexion se fait dans la fenêtre en cours (navigateur comme app installée).
      const method = loaded.preferRedirect ? 'redirect' : preferred;
      if (method === 'redirect' && loaded.redirectReady) {
        // La page va quitter l'app : au retour, la session sera relue.
        writeEntry('google');
      }
      return loaded.signIn(method);
    });
  }, [run]);

  const prepareSignIn = useCallback(() => {
    void ready().catch(() => undefined);
  }, [ready]);

  const continueAsGuest = useCallback(() => {
    dispatch({ type: 'guest' });
    void session.current?.signOut().catch(() => undefined);
  }, []);

  // QA (build émulateurs, page locale) : connexion par faux jeton Google.
  useEffect(() => {
    if (FIREBASE_EMULATORS && isLocalHost(window.location.hostname)) {
      const qa = {
        signInAs: (email: string, emailVerified = true) =>
          run(
            (loaded) =>
              loaded.signInWithFakeGoogle?.(email, emailVerified) ?? Promise.resolve<SignInOutcome>({ kind: 'cancelled' }),
          ),
      };
      (window as unknown as { __a2qa?: typeof qa }).__a2qa = qa;
    }
  }, [run]);

  const value = useMemo<Account>(
    () => ({ ...state, enabled: true, signIn, prepareSignIn, continueAsGuest }),
    [state, signIn, prepareSignIn, continueAsGuest],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Sans configuration Firebase : la valeur locale, rien d'autre (l'app d'aujourd'hui). */
function LocalAccountProvider({ children }: { children: ReactNode }) {
  return <AccountContext.Provider value={LOCAL_ACCOUNT}>{children}</AccountContext.Provider>;
}

/** Choisi au build : sans configuration, le code Firebase du compte n'est pas inclus. */
export const AccountProvider = FIREBASE_ENABLED ? FirebaseAccountProvider : LocalAccountProvider;
