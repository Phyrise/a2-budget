/**
 * V5.6 — compagnon choisi par chaque personne (Réglages).
 *
 * - V5.7 : connecté, le choix est lié au COMPTE : fiche
 *   `memberState/{rôle}.companion`, écrite par son seul propriétaire
 *   (docs/SYNC_DESIGN.md §24). Elle passe avant les réglages.
 * - Aussi dans les réglages GLOBAUX (`settings.personA.companion`,
 *   `settings.personB.companion`) : seule source en invité, repli connecté
 *   (fiche pas encore reprise, ancienne version de l'app) ; les copies par
 *   mois ne le portent pas.
 * - Lecture tolérante : absent ou inconnu → compagnon par défaut du rôle
 *   (A → Jiji, B → Calcifer). Les anciens états restent valides tels quels.
 * - Jamais le même compagnon pour les deux : si les données arrivent avec le
 *   même (deux choix simultanés sur deux téléphones), le choix de A est
 *   gardé et B reprend son défaut s'il est libre, sinon le premier libre.
 *   Résolu à la lecture (`companionsOf`) : rien n'est réécrit.
 */
import type { Settings } from './types.js';

/** Compagnons disponibles, dans l'ordre du sélecteur. */
export const COMPANION_IDS = ['jiji', 'calcifer', 'teto', 'hin'] as const;

export type CompanionId = (typeof COMPANION_IDS)[number];

/** Rôle d'une personne : a = personne A, b = personne B. */
export type CompanionRole = 'a' | 'b';

export function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === 'string' && (COMPANION_IDS as readonly string[]).includes(value);
}

/** Compagnon par défaut d'un rôle (celui d'avant le choix). */
export function defaultCompanion(role: CompanionRole): CompanionId {
  return role === 'a' ? 'jiji' : 'calcifer';
}

type CompanionSettings = {
  personA: Pick<Settings['personA'], 'companion'>;
  personB: Pick<Settings['personB'], 'companion'>;
};

/** V5.7 — choix lus des fiches des comptes (`memberState/{rôle}.companion`), bruts. */
export type AccountCompanions = Partial<Record<CompanionRole, unknown>>;

/** Choix d'un rôle : fiche du compte, sinon réglages, sinon rien (défaut). Pur. */
export function chosenCompanion(account: unknown, fromSettings: unknown): CompanionId | undefined {
  if (isCompanionId(account)) return account;
  return isCompanionId(fromSettings) ? fromSettings : undefined;
}

/**
 * Compagnons des deux personnes, doublon résolu (A garde le sien). La fiche
 * du compte (`accounts`, V5.7) passe avant les réglages. Pur.
 */
export function companionsOf(
  settings: CompanionSettings | null | undefined,
  accounts: AccountCompanions = {},
): Record<CompanionRole, CompanionId> {
  const rawA = chosenCompanion(accounts.a, settings?.personA?.companion);
  const rawB = chosenCompanion(accounts.b, settings?.personB?.companion);
  const a = rawA ?? defaultCompanion('a');
  let b = rawB ?? defaultCompanion('b');
  if (b === a) {
    const fallback = defaultCompanion('b');
    b = fallback !== a ? fallback : COMPANION_IDS.find((id) => id !== a)!;
  }
  return { a, b };
}

/** Compagnon d'une personne (doublon résolu). Pur. */
export function companionOf(
  settings: CompanionSettings | null | undefined,
  role: CompanionRole,
  accounts: AccountCompanions = {},
): CompanionId {
  return companionsOf(settings, accounts)[role];
}

/**
 * V5.7 — reprise douce : fiche du compte sans choix (lue du serveur) mais un
 * choix dans les réglages → à écrire une fois dans la fiche. Sinon null. Pur.
 */
export function companionToMigrate(account: unknown, fromSettings: unknown): CompanionId | null {
  if (isCompanionId(account)) return null;
  return isCompanionId(fromSettings) ? fromSettings : null;
}
