/**
 * Contrat entre l'app et la session Firebase chargée à la demande
 * (`sdk/session.ts`). Module pur : types et traduction des erreurs, sans
 * jamais importer Firebase.
 */
import type { AppState } from '@a2/core';
import type { LiveChannel } from '../../presence/liveTypes';
import type { MemberRole, RefusalReason } from '../allowlist';
import type { SyncCache } from '../syncCache';
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

/** Synchronisation, pour l'indicateur discret : à jour, en cours, hors ligne (tout est gardé), refusée. */
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

/**
 * La synchronisation en marche (chunk Firebase) : moteur (SyncEngine) +
 * transport Firestore. Ce que le store, l'indicateur et les Réglages en
 * voient.
 */
export interface SyncRuntime {
  readonly role: MemberRole;
  /** Vue initiale chargée (cache du SDK, ou tout relu du serveur) : les gestes peuvent partir. */
  readonly ready: Promise<void>;
  /** Dernier état projeté (null tant que rien n'est connu). */
  readonly state: AppState | null;
  /** États projetés ; appelé tout de suite si un état est connu. */
  subscribe(listener: (state: AppState) => void): () => void;
  /** Transition locale `prev → next` (diffToOps → lots Firestore). */
  commit(prev: AppState, next: AppState): void;
  /** Changement de jour : la forêt avance. */
  refresh(): void;
  /** Décocher / annuler « pas aujourd'hui » : faux si l'occurrence n'a que des gestes de l'autre. */
  canUndo(collection: 'completions' | 'skips', taskId: string, dueDate: string): boolean;
  /** Statut de la synchronisation ; appelé tout de suite. */
  watchStatus(listener: (status: SyncStatus) => void): () => void;
  dispose(): void;
}

/** Contenu du foyer à la première connexion de ce téléphone. */
export type HouseholdContent =
  /** Vide : ce téléphone peut l'initialiser avec ses données. */
  | 'empty'
  /** Un envoi de ce rôle s'est arrêté en route : on le reprend. */
  | 'resume'
  /** Il a déjà des données (ou l'autre l'initialise) : on les adopte. */
  | 'shared';

/** Issue de l'envoi initial. */
export type InitializeOutcome = 'done' | 'taken' | 'offline' | 'failed';

/** Première connexion d'un téléphone (docs/SYNC_DESIGN.md §6). Exige le réseau. */
export interface SyncSetup {
  inspect(): Promise<HouseholdContent | 'offline' | 'failed'>;
  /** Envoie l'état local par lots (reprise idempotente) ; `onProgress(envoyés, total)`. */
  initialize(state: AppState, onProgress: (sent: number, total: number) => void): Promise<InitializeOutcome>;
}

export interface FirebaseSession {
  /** La redirection peut aboutir (helper auto-hébergé, ou émulateur). */
  readonly redirectReady: boolean;
  /** Page de connexion sur le même site (hors émulateurs) : redirection dans la fenêtre en cours, partout. */
  readonly preferRedirect: boolean;
  /** Appelé tout de suite avec l'état restauré, puis à chaque changement. */
  watch(listener: (event: SessionEvent) => void): () => void;
  signIn(method: SignInMethod): Promise<SignInOutcome>;
  signOut(): Promise<void>;
  /** Crée le foyer `a2home` (premier membre) et la fiche du membre, si absents. */
  ensureHousehold(member: Member): Promise<HouseholdOutcome>;
  /** Première connexion de ce téléphone : contenu du foyer, envoi initial. */
  setup(member: Member): SyncSetup;
  /**
   * Démarre la synchronisation (une seule à la fois) depuis la copie locale
   * (null : tout relire du serveur). La copie est tenue à jour par le runtime.
   */
  openSync(member: Member, cache: SyncCache | null, selectedMonth: string): SyncRuntime;
  /** V5.1 : présence, coucous, bocal partagé (presence/LiveContext.tsx). */
  openLive(member: Member): LiveChannel;
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
