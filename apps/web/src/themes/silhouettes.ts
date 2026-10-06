/**
 * Silhouettes du Carnet de la forêt (V4) : une vraie image à part pour
 * chaque créature pas encore rencontrée — forme seule, ton de brume, aucun
 * détail du sprite d'origine. Générées par
 * `art/pipeline/silhouettes/make_silhouettes.py` (WebP RGBA, ≈ 5 Ko,
 * 216 px de haut). Le Carnet n'affiche le vrai sprite qu'une fois la
 * créature rencontrée.
 */
import kodama1 from './assets/silhouettes/silhouette-kodama-1.webp';
import kodama2 from './assets/silhouettes/silhouette-kodama-2.webp';
import kodama3 from './assets/silhouettes/silhouette-kodama-3.webp';
import kodama4 from './assets/silhouettes/silhouette-kodama-4.webp';
import kodama5 from './assets/silhouettes/silhouette-kodama-5.webp';
import kodama6 from './assets/silhouettes/silhouette-kodama-6.webp';
import kodama7 from './assets/silhouettes/silhouette-kodama-7.webp';
import kodama8 from './assets/silhouettes/silhouette-kodama-8.webp';
import emberWisp from './assets/silhouettes/silhouette-ember-wisp.webp';
import leafSprite from './assets/silhouettes/silhouette-leaf-sprite.webp';
import mossLing from './assets/silhouettes/silhouette-moss-ling.webp';
import mushroomPip from './assets/silhouettes/silhouette-mushroom-pip.webp';
import seedSpirit from './assets/silhouettes/silhouette-seed-spirit.webp';
import waterDrip from './assets/silhouettes/silhouette-water-drip.webp';

export interface SilhouetteManifest {
  /** Même ordre que les fichiers kodama-1..8 (pas celui de manifest.sprites.kodama). */
  kodama: string[];
  /** Clé = id de créature (CREATURES de @a2/core). */
  creatures: Record<string, string>;
}

export const silhouettes: SilhouetteManifest = {
  kodama: [kodama1, kodama2, kodama3, kodama4, kodama5, kodama6, kodama7, kodama8],
  creatures: {
    'moss-ling': mossLing,
    'seed-spirit': seedSpirit,
    'leaf-sprite': leafSprite,
    'ember-wisp': emberWisp,
    'mushroom-pip': mushroomPip,
    'water-drip': waterDrip,
  },
};
