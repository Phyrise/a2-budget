/**
 * Lanternes de pierre (V4) : la lanterne (tōrō) posée dans la forêt de
 * Maison. Chaque session de lanterne terminée (minuteur doux) rapproche d'un
 * nouveau modèle ; les modèles débloqués se collectionnent dans le Carnet et
 * l'on choisit celui qui est posé dans la forêt.
 *
 * Seuils (nombre de sessions terminées, `focus.sessions.length`) — réglables
 * ici sans migration : rien n'est stocké hormis le choix (`selectedLantern`),
 * et un choix devenu verrouillé est simplement ignoré (lanterne de base).
 * Un déblocage ne se perd jamais : les sessions ne sont jamais retirées
 * (au-delà de FOCUS_SESSIONS_MAX, le compte reste au maximum).
 *
 * Fonctions pures. Jamais de score affiché : la progression se montre par
 * les lanternes elles-mêmes.
 */

import type { FocusSession, FocusState } from './types.js';

/** Un modèle de lanterne de pierre et son seuil de déblocage. */
export interface LanternDef {
  /** Identifiant stable (clé d'asset côté interface). */
  id: string;
  /** Nombre de sessions de lanterne terminées pour le débloquer. */
  unlockAt: number;
}

/** Catalogue, du plus simple au plus impressionnant (seuils croissants). */
export const LANTERNS: readonly LanternDef[] = [
  { id: 'kasuga-moss', unlockAt: 0 },
  { id: 'yukimi', unlockAt: 3 },
  { id: 'oribe', unlockAt: 8 },
  { id: 'kotoji', unlockAt: 15 },
  { id: 'tachi-carved', unlockAt: 25 },
  { id: 'ancient-shrine', unlockAt: 40 },
  { id: 'spirit-light', unlockAt: 60 },
];

/** Lanterne de base, toujours débloquée. */
export const DEFAULT_LANTERN_ID = 'kasuga-moss';

/** Vrai si `id` est un modèle du catalogue. */
export function isLanternId(value: unknown): value is string {
  return typeof value === 'string' && LANTERNS.some((l) => l.id === value);
}

function countOf(sessions: readonly FocusSession[] | FocusState | undefined): number {
  if (sessions === undefined) return 0;
  return Array.isArray(sessions) ? sessions.length : (sessions as FocusState).sessions.length;
}

/** Modèles débloqués (ordre du catalogue ; la lanterne de base toujours incluse). */
export function unlockedLanterns(sessions: readonly FocusSession[] | FocusState | undefined): LanternDef[] {
  const n = countOf(sessions);
  return LANTERNS.filter((l) => l.unlockAt <= n);
}

/** Vrai si le modèle est débloqué. */
export function isLanternUnlocked(
  sessions: readonly FocusSession[] | FocusState | undefined,
  id: string,
): boolean {
  const def = LANTERNS.find((l) => l.id === id);
  return def !== undefined && def.unlockAt <= countOf(sessions);
}

/** Prochain modèle à débloquer, ou null si toute la collection est là. */
export function nextLantern(sessions: readonly FocusSession[] | FocusState | undefined): LanternDef | null {
  const n = countOf(sessions);
  return LANTERNS.find((l) => l.unlockAt > n) ?? null;
}

/**
 * Lanterne posée dans la forêt : le choix s'il est débloqué, sinon la
 * lanterne de base.
 */
export function activeLantern(focus: FocusState | undefined): string {
  const chosen = focus?.selectedLantern;
  return chosen !== undefined && isLanternUnlocked(focus, chosen) ? chosen : DEFAULT_LANTERN_ID;
}

/**
 * Choisit la lanterne posée dans la forêt. Modèle inconnu ou verrouillé →
 * `changed: false`, même référence. Déjà choisie → même référence.
 */
export function selectLantern(
  focus: FocusState | undefined,
  id: string,
): { focus: FocusState | undefined; changed: boolean } {
  if (!isLanternUnlocked(focus, id)) return { focus, changed: false };
  if (focus?.selectedLantern === id) return { focus, changed: false };
  return { focus: { ...(focus ?? { sessions: [] }), selectedLantern: id }, changed: true };
}
