import type { ForestState } from '@a2/core';
import { vitalityState } from '@a2/core';
import { FOREST_LAYERS, hasRasterLayers } from './forest-layers';
import { PALETTES, particleCount, particleStyle, type Vitality } from './ForestScene';

/**
 * Scène forêt en couches raster (assets peints).
 *
 * Composée en couches positionnées (CSS). Color-grading par vitalité (filter).
 * Animation : balancement de l'arbre, dérive de la brume, lucioles, gardien.
 * Fallback : si aucune couche raster n'est disponible, renvoie null (le
 * composant parent utilise la version SVG).
 */
export function ForestSceneRaster({
  forest,
  className = '',
  showGuardian = false,
}: {
  forest: ForestState;
  className?: string;
  showGuardian?: boolean;
}) {
  if (!hasRasterLayers()) return null;

  const state = vitalityState(forest.vitality) as Vitality;
  const p = PALETTES[state];
  const particles = particleCount(state);
  const showSpirit = forest.unlockedCreatureIds.length > 0 && state !== 'quiet';

  return (
    <div
      className={`forest-scene forest-scene--raster forest-scene--${state} ${showGuardian ? 'is-guardian' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Forêt ${forest.paused ? 'endormie' : state === 'quiet' ? 'apaisée' : state === 'peaceful' ? 'paisible' : state === 'lively' ? 'vivante' : 'en pleine floraison'}`}
    >
      {/* Fond (sous-bois brumeux peint) */}
      {FOREST_LAYERS.bg.src && (
        <img src={FOREST_LAYERS.bg.src} className={`forest-scene__layer ${FOREST_LAYERS.bg.className}`} alt="" aria-hidden="true" />
      )}

      {/* Arbre ancien (ancre) */}
      {FOREST_LAYERS.tree.src && (
        <img src={FOREST_LAYERS.tree.src} className={`forest-scene__layer forest-scene__layer--sway ${FOREST_LAYERS.tree.className}`} alt="" aria-hidden="true" />
      )}

      {/* Brume qui traverse (profondeur) */}
      <div className="forest-scene__mist" aria-hidden="true" />

      {/* Créatures discrètes */}
      {showSpirit && FOREST_LAYERS.spirit.src && (
        <img src={FOREST_LAYERS.spirit.src} className={`forest-scene__layer ${FOREST_LAYERS.spirit.className}`} alt="" aria-hidden="true" />
      )}

      {/* Premier plan (fougères) */}
      {FOREST_LAYERS.fg.src && (
        <img src={FOREST_LAYERS.fg.src} className={`forest-scene__layer ${FOREST_LAYERS.fg.className}`} alt="" aria-hidden="true" />
      )}

      {/* Gardien (événement rare) */}
      {showGuardian && FOREST_LAYERS.guardian.src && (
        <img src={FOREST_LAYERS.guardian.src} className={`forest-scene__layer ${FOREST_LAYERS.guardian.className}`} alt="" aria-hidden="true" />
      )}

      {/* Color-grading par vitalité */}
      <div className="forest-scene__grade" style={{ filter: `saturate(${p.saturation}) brightness(${state === 'quiet' ? 0.92 : 1})` }} aria-hidden="true" />

      {/* Lucioles */}
      <div className="forest-scene__particles" aria-hidden="true">
        {Array.from({ length: particles }).map((_, i) => (
          <span key={i} className="forest-scene__particle" style={particleStyle(i, particles)} />
        ))}
      </div>

      {forest.paused && <div className="forest-scene__pause" aria-hidden="true" />}
    </div>
  );
}
