/**
 * Lanternes de pierre (tōrō) — contrat des peintures (V4).
 *
 * Les sept modèles sont ceux de `LANTERNS` (@a2/core) ; leur identifiant
 * stable est la clé. Tant qu'une peinture manque, l'interface dessine la
 * lanterne au trait (features/rituals/lantern/ToroArt.tsx) : le Carnet, la
 * carte Lanterne et le bandeau marchent sans aucune image.
 *
 * Format attendu de chaque peinture (à déposer dans
 * `themes/assets/lanterns/<id>-unlit.webp` et `<id>-lit.webp`, puis à
 * importer ci-dessous) :
 * - WebP RGBA, fond transparent, portrait 512 × 768 px, ≤ 60 Ko ;
 * - la lanterne entière, de face (¾ léger permis), posée sur le sol :
 *   pied centré à (256, 740), sommet à ~40 px du haut (les sept modèles à
 *   la même échelle : la plus petite, yukimi, plus basse et plus large) ;
 * - `unlit` : pierre au repos, mousse, lumière de sous-bois ;
 * - `lit` : même cadrage, au pixel près, fenêtres de la chambre à feu
 *   allumées (ambre doux ; vert d'eau pour `spirit-light`), léger halo
 *   peint dans l'alpha — le halo vivant reste dessiné par l'interface ;
 * - `silhouette` (facultatif) : forme seule, ton de brume, sans détail —
 *   sinon l'interface en dessine une au trait.
 */

export interface LanternArt {
  unlit: string;
  lit: string;
  silhouette?: string;
}

/** id (LANTERNS) → peintures. Vide tant que les images n'existent pas. */
export const lanternArt: Partial<Record<string, LanternArt>> = {};
