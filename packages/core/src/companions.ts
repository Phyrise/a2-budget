/**
 * V5.6 — compagnon choisi par chaque personne (Réglages).
 *
 * - Stocké dans les réglages GLOBAUX (`settings.personA.companion`,
 *   `settings.personB.companion`), synchronisé avec eux ; les copies par
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

/** Compagnons des deux personnes, doublon résolu (A garde le sien). Pur. */
export function companionsOf(settings: CompanionSettings | null | undefined): Record<CompanionRole, CompanionId> {
  const rawA = settings?.personA?.companion;
  const rawB = settings?.personB?.companion;
  const a = isCompanionId(rawA) ? rawA : defaultCompanion('a');
  let b = isCompanionId(rawB) ? rawB : defaultCompanion('b');
  if (b === a) {
    const fallback = defaultCompanion('b');
    b = fallback !== a ? fallback : COMPANION_IDS.find((id) => id !== a)!;
  }
  return { a, b };
}

/** Compagnon d'une personne (doublon résolu). Pur. */
export function companionOf(settings: CompanionSettings | null | undefined, role: CompanionRole): CompanionId {
  return companionsOf(settings)[role];
}
