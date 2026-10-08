/**
 * Compte du téléphone (V5) : machine d'état pure, testée dans
 * accountModel.test.ts. Le fournisseur React (AccountContext.tsx) ne fait
 * que brancher Firebase dessus.
 *
 * - `entry` : le choix mémorisé (null = montrer l'accueil).
 * - `phase` : idle, restoring (session Google relue au démarrage, l'app est
 *   déjà affichée), connecting (fenêtre Google ouverte), member.
 * - L'invité ne charge jamais Firebase (`needsFirebase`).
 */
import type { RefusalReason } from '../sync/allowlist';
import type { Member, SessionEvent, SignInNotice, SignInOutcome } from '../sync/firebase/types';
import type { AccountEntry } from './accountChoice';

export type AccountNotice = RefusalReason | SignInNotice;
export type AccountPhase = 'idle' | 'restoring' | 'connecting' | 'member';
/** Foyer `a2home` : vérifié / créé (ready), à faire, ou en attente du réseau. */
export type HouseholdStatus = 'pending' | 'ready' | 'offline' | 'failed';

export interface AccountState {
  entry: AccountEntry | null;
  phase: AccountPhase;
  member: Member | null;
  household: HouseholdStatus;
  notice: AccountNotice | null;
}

export type AccountEvent =
  | { type: 'connect' }
  | { type: 'guest' }
  | { type: 'session'; event: SessionEvent }
  | { type: 'outcome'; outcome: SignInOutcome }
  /** Le SDK n'a pas pu être chargé (hors ligne, jamais mis en cache). */
  | { type: 'load-failed' }
  | { type: 'household'; status: HouseholdStatus };

export function initialAccount(entry: AccountEntry | null): AccountState {
  return {
    entry,
    phase: entry === 'google' ? 'restoring' : 'idle',
    member: null,
    household: 'pending',
    notice: null,
  };
}

/** L'accueil s'affiche tant qu'aucun choix n'est fait (ou après un refus). */
export function showsWelcome(state: AccountState): boolean {
  return state.entry === null;
}

/** Firebase n'est chargé que pour un compte Google (jamais en invité). */
export function needsFirebase(state: AccountState): boolean {
  return state.entry === 'google' || state.phase === 'connecting';
}

/** Une session Google compte-t-elle ? (pas en invité, sauf connexion demandée) */
function expectsSession(state: AccountState): boolean {
  return state.entry === 'google' || state.phase === 'connecting' || state.phase === 'restoring';
}

/** Retour au calme après une tentative (le membre reste membre). */
function settle(state: AccountState): AccountPhase {
  return state.member !== null ? 'member' : state.entry === 'google' ? 'restoring' : 'idle';
}

function onSession(state: AccountState, event: SessionEvent): AccountState {
  switch (event.kind) {
    case 'member': {
      if (!expectsSession(state)) return state;
      const same = state.member?.uid === event.member.uid;
      return {
        entry: 'google',
        phase: 'member',
        member: event.member,
        household: same ? state.household : 'pending',
        notice: null,
      };
    }
    case 'refused':
      if (!expectsSession(state)) return state;
      return { entry: null, phase: 'idle', member: null, household: 'pending', notice: event.reason };
    case 'signed-out':
      // Pendant la connexion, l'état initial « personne » précède la fenêtre Google.
      if (state.phase === 'connecting') return state;
      if (state.entry === 'google') return { ...state, entry: null, phase: 'idle', member: null, household: 'pending' };
      return state.member === null && state.phase === 'idle' ? state : { ...state, phase: 'idle', member: null };
    case 'failed':
      if (state.member !== null || !expectsSession(state)) return state;
      return { ...state, entry: null, phase: 'idle', notice: event.notice };
  }
}

export function accountReducer(state: AccountState, event: AccountEvent): AccountState {
  switch (event.type) {
    case 'connect':
      return { ...state, phase: 'connecting', notice: null };
    case 'guest':
      return { entry: 'guest', phase: 'idle', member: null, household: 'pending', notice: null };
    case 'session':
      return onSession(state, event.event);
    case 'outcome': {
      const { outcome } = event;
      if (state.phase !== 'connecting') return state;
      if (outcome.kind === 'done' || outcome.kind === 'redirecting') return state;
      return { ...state, phase: settle(state), notice: outcome.kind === 'failed' ? outcome.notice : null };
    }
    case 'load-failed':
      return state.phase === 'connecting' ? { ...state, phase: settle(state), notice: 'offline' } : state;
    case 'household':
      return state.member === null ? state : { ...state, household: event.status };
  }
}
