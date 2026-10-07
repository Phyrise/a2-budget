/** Les mots du compte (V5) : peu, doux, en français. */
import type { MemberRole } from '../sync/allowlist';
import type { AccountNotice, HouseholdStatus } from './accountModel';

export const NOTICE_TEXT: Record<AccountNotice, string> = {
  'not-invited': 'Ce compte n’est pas invité.',
  unverified: 'Adresse pas encore vérifiée par Google.',
  'popup-blocked': 'La fenêtre Google a été bloquée : touchez encore une fois.',
  offline: 'Pas de réseau pour l’instant.',
  failed: 'La connexion n’a pas abouti.',
  'ios-later': 'Depuis l’app installée sur iPhone, la connexion arrive bientôt.',
};

/** Qui l'on est dans l'app : AL avec Jiji, AC avec Calcifer. */
export const ROLE_TEXT: Record<MemberRole, string> = {
  a: 'AL · Jiji',
  b: 'AC · Calcifer',
};

export const HOUSEHOLD_TEXT: Record<HouseholdStatus, string> = {
  pending: 'Foyer : un instant…',
  ready: 'Foyer prêt',
  offline: 'Foyer : en attente du réseau',
  failed: 'Foyer : accès refusé',
};
