/**
 * Repos de la forêt cachée (fonction pure, testée ; docs/PERF.md piste 6).
 *
 * Sur téléphone et tablette, hors Maison, le bandeau peint (24svh + 72 px,
 * opaque) et la feuille recouvrent entièrement la toile WebGL : plus aucune
 * image n'est dessinée (`draw: false`). Après un délai sur un autre onglet
 * (≈ 60 s) ou app en arrière-plan (≈ 30 s), la mémoire graphique est rendue
 * (moteur détruit, recréé au retour sous le fondu peinture → toile). Les
 * allers-retours rapides ne rechargent rien. Ordinateur : rien ne change
 * (la forêt garde sa propre politique, Engine).
 */

export interface RestDelays {
  /** Autre onglet (toile sous le bandeau peint), en ms. */
  covered: number;
  /** App en arrière-plan (document caché), en ms. */
  background: number;
}

export const REST_DELAYS: RestDelays = { covered: 60_000, background: 30_000 };

export interface RestInput {
  desktop: boolean;
  /** Le module montre la forêt vivante (Maison sur téléphone). */
  forestShown: boolean;
  /** Document visible (app au premier plan). */
  pageVisible: boolean;
}

export interface Rest {
  /** Le moteur peut dessiner (sinon : plus aucune image, même aux redimensionnements). */
  draw: boolean;
  /** Délai avant de libérer la mémoire graphique ; null = la garder. */
  releaseMs: number | null;
}

export function forestRest({ desktop, forestShown, pageVisible }: RestInput, delays: RestDelays = REST_DELAYS): Rest {
  if (desktop) return { draw: true, releaseMs: null };
  if (!pageVisible) return { draw: false, releaseMs: delays.background };
  if (!forestShown) return { draw: false, releaseMs: delays.covered };
  return { draw: true, releaseMs: null };
}
