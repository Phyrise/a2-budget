/**
 * État de jeu des Noiraudes (pur, sans stockage) : le bocal de kompeitō et
 * le compteur « Noiraudes attrapées ».
 *
 * Tout changement est un GESTE (delta) fait sur CE téléphone : donner des
 * kompeitō (soin fait, virement coché, Noiraude attrapée), en dépenser un
 * (lâché aux Noiraudes), attraper une Noiraude. Jamais d'état absolu écrit
 * par-dessus : une fois l'état partagé entre les deux téléphones, chacun
 * n'envoie que ses propres gestes (incréments), sinon un même virement
 * coché, vu par les deux, compterait deux fois. Voir store.ts.
 *
 * Règles (Arthur) : 20 kompeitō au départ ; +1 par soin fait (Maison), +1
 * par virement coché, +1 par Noiraude attrapée (+5 pour la dorée) ; jamais
 * retirés quand on annule ; lâcher un kompeitō aux Noiraudes en coûte 1.
 */

export interface PlayState {
  /** Kompeitō dans le bocal (≥ 0). */
  jar: number;
  /** Noiraudes attrapées (toutes, dorées comprises). */
  caught: number;
  /** Dont dorées. */
  golden: number;
}

/** Pourquoi le bocal reçoit des kompeitō (journal, statistiques futures). */
export type GiveCause = 'soin' | 'virement' | 'attrapee' | 'doree' | 'dev' | 'quete';

export type PlayGesture =
  | { kind: 'give'; n: number; cause: GiveCause }
  | { kind: 'spend'; n: number }
  | { kind: 'catch'; golden: boolean };

export const START_JAR = 20;
/** Kompeitō pour une Noiraude attrapée, et pour la dorée. */
export const CATCH_GIFT = 1;
export const GOLDEN_GIFT = 5;

export const START_STATE: PlayState = { jar: START_JAR, caught: 0, golden: 0 };

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/** Lit un état stocké (n'importe quoi) ; `null` s'il n'est pas reconnu. */
export function parsePlay(value: unknown): PlayState | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const jar = count(v.jar);
  if (jar === null) return null;
  return { jar, caught: count(v.caught) ?? 0, golden: count(v.golden) ?? 0 };
}

/**
 * Applique un geste. Une dépense sans assez de kompeitō ne fait rien (le
 * bocal ne passe jamais sous zéro) : l'appelant vérifie avec `canSpend`.
 */
export function applyGesture(state: PlayState, g: PlayGesture): PlayState {
  switch (g.kind) {
    case 'give':
      return g.n > 0 ? { ...state, jar: state.jar + Math.floor(g.n) } : state;
    case 'spend':
      return g.n > 0 && state.jar >= g.n ? { ...state, jar: state.jar - Math.floor(g.n) } : state;
    case 'catch':
      return {
        jar: state.jar + (g.golden ? GOLDEN_GIFT : CATCH_GIFT),
        caught: state.caught + 1,
        golden: state.golden + (g.golden ? 1 : 0),
      };
  }
}

export function canSpend(state: PlayState, n = 1): boolean {
  return state.jar >= n;
}
