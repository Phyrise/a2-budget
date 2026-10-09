/** Les mots du compte (V5) : peu, doux, en français. */
import type { MemberRole } from '../sync/allowlist';
import type { SyncStatus } from '../sync/firebase/types';
import type { AccountNotice, HouseholdStatus } from './accountModel';

export const NOTICE_TEXT: Record<AccountNotice, string> = {
  'not-invited': 'Ce compte n’est pas invité.',
  unverified: 'Adresse pas encore vérifiée par Google.',
  'popup-blocked': 'La fenêtre Google a été bloquée : touchez encore une fois.',
  offline: 'Pas de réseau pour l’instant.',
  failed: 'La connexion n’a pas abouti.',
  'ios-later': 'Depuis l’app installée sur iPhone, la connexion arrive bientôt.',
};

/** Prénoms du foyer (comptes Google) : AL, AC. */
const ROLE_NAME: Record<MemberRole, string> = { a: 'AL', b: 'AC' };

/** Qui l'on est dans l'app : « AL · Jiji » (V5.6 : avec le compagnon choisi). */
export function roleText(role: MemberRole, companionName: string): string {
  return `${ROLE_NAME[role]} · ${companionName}`;
}

export const HOUSEHOLD_TEXT: Record<HouseholdStatus, string> = {
  pending: 'Foyer : un instant…',
  ready: 'Foyer prêt',
  offline: 'Foyer : en attente du réseau',
  failed: 'Foyer : accès refusé',
};

/** Écran de la première connexion : un mot par étape. */
export type SetupPhase = 'waiting' | 'empty' | 'resume' | 'shared' | 'sending' | 'joining' | 'offline' | 'failed';

export const SETUP_TEXT: Record<SetupPhase | 'note', string> = {
  waiting: 'Un instant…',
  empty: 'Elle est encore vide.',
  resume: 'L’envoi s’est arrêté en route.',
  shared: 'Elle vous attend déjà.',
  sending: 'On y range vos affaires…',
  joining: 'On ouvre la porte…',
  offline: 'Pas de réseau pour l’instant.',
  failed: 'Ça n’a pas abouti.',
  note: 'Les données de ce téléphone restent gardées à part.',
};

/** Synchronisation : l'indicateur discret et les Réglages. */
export const SYNC_STATUS_TEXT: Record<SyncStatus, string> = {
  synced: 'À jour',
  syncing: 'Synchronisation…',
  offline: 'Hors ligne — tout est gardé',
  error: 'Synchronisation en pause',
};
