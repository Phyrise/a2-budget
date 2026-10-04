/**
 * Le Sans-Visage, doux gardien du reste du mois, sous une lanterne.
 * - pose d'humeur (offering / calm / content / shy) choisie par `noFaceMood` ;
 * - salut ('bow') bref après une modification enregistrée ;
 * - entre deux humeurs, il s'efface un instant ('fading', silhouette
 *   translucide) puis réapparaît dans sa nouvelle pose : fondu croisé.
 * Toutes les poses sont empilées (préchargées, pas de clignotement).
 * Décoratif : alt vide, l'information est dans les chiffres.
 */
import { useEffect, useState } from 'react';
import { budgetTheme } from '../../../themes/manifest';
import type { NoFacePose } from '../../../themes/types';
import { cx } from '../../../ui';
import type { NoFaceMood } from './mood';

/** Hauteur de toile (px) de chaque pose : même échelle pour toutes (hauteur utile 360). */
const CANVAS_HEIGHT: Record<NoFacePose, number> = {
  bow: 356,
  calm: 382,
  content: 362,
  fading: 362,
  offering: 377,
  shy: 366,
};
const POSES = Object.keys(CANVAS_HEIGHT) as NoFacePose[];
export const FADE_MS = 520;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function NoFace({ mood, bowing, scale = 0.3 }: { mood: NoFaceMood; bowing: boolean; scale?: number }) {
  const [settled, setSettled] = useState<NoFaceMood>(mood);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (bowing || mood === settled) return;
    if (reducedMotion()) {
      setSettled(mood);
      return;
    }
    setFading(true);
    const timer = window.setTimeout(() => {
      setSettled(mood);
      setFading(false);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [mood, bowing, settled]);

  const shown: NoFacePose = bowing ? 'bow' : fading ? 'fading' : settled;

  return (
    <div className="noface" data-pose={shown} data-mood={mood} aria-hidden="true">
      <span className="noface__glow" />
      <span className="noface__plank" />
      {POSES.map((pose) => (
        <img
          key={pose}
          className={cx('noface__img', `noface__img--${pose}`, pose === shown && 'is-shown')}
          src={budgetTheme.noFace[pose]}
          alt=""
          draggable={false}
          decoding="async"
          style={{ height: Math.round(CANVAS_HEIGHT[pose] * scale) }}
        />
      ))}
    </div>
  );
}
