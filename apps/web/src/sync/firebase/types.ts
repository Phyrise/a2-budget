/**
 * Contrat entre l'app et la session Firebase chargée à la demande
 * (`sdk/session.ts`). Module pur : types et traduction des erreurs, sans
 * jamais importer Firebase.
 */
import type { MemberRole, RefusalReason } from '../allowlist';
import type { SignInMethod } from './platform';

/** Un membre du foyer, connecté avec Google. */
export interface Member {
  uid: string;
  /** E-mail en minuscules (celui de la liste blanche). */
  email: string;
  role: MemberRole;
}

/** Petits messages de l'accueil après une tentative qui n'aboutit pas. */
export type SignInNotice = 'popup-blocked' | 'offline' | 'failed' | 'ios-later';

/** État de connexion vu par la session (après la vérification de la liste blanche). */
export type SessionEvent =
  | { kind: 'member'; member: Member }
  /** Compte refusé : la session le déconnecte aussitôt. */
  | { kind: 'refused'; reason: RefusalReason }
  | { kind: 'signed-out' }
  /** Retour de redirection en échec (iPhone). */
  | { kind: 'failed'; notice: SignInNotice };

/** Issue d'une demande de connexion ; le résultat lui-même arrive par `watch`. */
export type SignInOutcome =
  | { kind: 'done' }
  | { kind: 'redirecting' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; notice: SignInNotice };

export type HouseholdOutcome = 'ready' | 'offline' | 'failed';

export interface FirebaseSession {
  /** La redirection peut aboutir (helper auto-hébergé, ou émulateur). */
  readonly redirectReady: boolean;
  /** Appelé tout de suite avec l'état restauré, puis à chaque changement. */
  watch(listener: (event: SessionEvent) => void): () => void;
  signIn(method: SignInMethod): Promise<SignInOutcome>;
  signOut(): Promise<void>;
  /** Crée le foyer `a2home` (premier membre) et la fiche du membre, si absents. */
  ensureHousehold(member: Member): Promise<HouseholdOutcome>;
  /** QA seulement (build émulateurs) : faux jeton Google de l'émulateur Auth. */
  signInWithFakeGoogle?: (email: string, emailVerified?: boolean) => Promise<SignInOutcome>;
}

/** Codes d'erreur Firebase Auth → issue douce. */
export function outcomeForAuthError(code: unknown): SignInOutcome {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
    case 'auth/redirect-cancelled-by-user':
      return { kind: 'cancelled' };
    case 'auth/popup-blocked':
      return { kind: 'failed', notice: 'popup-blocked' };
    case 'auth/network-request-failed':
    case 'auth/timeout':
      return { kind: 'failed', notice: 'offline' };
    default:
      return { kind: 'failed', notice: 'failed' };
  }
}

/** Code d'une erreur Firebase (ou undefined). */
export function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined;
}
