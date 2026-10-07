/**
 * Le Sans-Visage, doux gardien du compte commun, sous une lanterne.
 * - pose d'humeur (offering / calm / content / shy) choisie par `noFaceMood` ;
 * - V4.2 : il EST le compte (voir reaction.ts). Le compte monte : il reçoit
 *   l'argent, mâche, content ('content', `is-eating`) ; il descend : il
 *   laisse partir les pièces, se tasse, triste ('shy', `is-sighing`). Sa
 *   taille suit ce qui est déjà passé sur le compte ce mois-ci (accountSwell) ;
 * - salut ('bow') bref après une modification sans effet sur le compte ;
 * - un toucher : il penche la tête, « ah… », et offre un kompeitō (anti-rafale,
 *   aucune donnée touchée) ;
 * - entre deux humeurs, il s'efface un instant ('fading', silhouette
 *   translucide) puis réapparaît dans sa nouvelle pose : fondu croisé.
 * Toutes les poses sont empilées (préchargées, pas de clignotement).
 * Images décoratives (alt vide) : l'information est dans les chiffres.
 */
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { playCue } from '../../../app/sound';
import { useApp } from '../../../state/store';
import { budgetTheme } from '../../../themes/manifest';
import type { NoFacePose } from '../../../themes/types';
import { cx } from '../../../ui';
import { KONPEITO_HUES, accountSwell, type NoFaceMood } from './mood';
import { useReaction } from './reaction';
import './touch.css';

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
/** Le toucher : durée de la tête penchée, et délai minimal entre deux. */
export const TAP_MS = 1100;
const TAP_COOLDOWN_MS = 1400;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function NoFace({
  mood,
  bowing,
  eating = false,
  scale = 0.3,
  touchable = true,
  ref,
}: {
  mood: NoFaceMood;
  bowing: boolean;
  /** Ce Sans-Visage montre la réaction en cours (gain ou perte). */
  eating?: boolean;
  /** Ignoré depuis V4.2 : la taille suit le compte (accountSwell). Gardé pour les appelants. */
  fullness?: number;
  scale?: number;
  /** Faux : pur décor (le visiteur), pas de toucher. */
  touchable?: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  const { currentMonth } = useApp();
  const swell = useMemo(() => (currentMonth ? accountSwell(currentMonth) : 0), [currentMonth]);
  const reaction = useReaction();
  const active = eating ? (reaction ?? 'gain') : null;
  const [settled, setSettled] = useState<NoFaceMood>(mood);
  const [fading, setFading] = useState(false);
  const [tap, setTap] = useState(0);
  const lastTap = useRef(-Infinity);
  const tapTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (bowing || eating || mood === settled) return;
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
  }, [mood, bowing, eating, settled]);

  useEffect(() => () => window.clearTimeout(tapTimer.current), []);

  const onTap = () => {
    const now = performance.now();
    if (active !== null || now - lastTap.current < TAP_COOLDOWN_MS) return;
    lastTap.current = now;
    setTap((n) => n + 1);
    playCue('ah');
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => setTap(0), TAP_MS);
  };

  const shown: NoFacePose =
    active === 'gain' ? 'content' : active === 'loss' ? 'shy' : bowing ? 'bow' : fading ? 'fading' : settled;
  const hue = KONPEITO_HUES[tap % KONPEITO_HUES.length] ?? 'pink';

  return (
    <div
      ref={ref}
      className={cx('noface', active === 'gain' && 'is-eating', active === 'loss' && 'is-sighing', tap > 0 && 'is-tapped')}
      data-pose={shown}
      data-mood={mood}
      data-reaction={active ?? undefined}
      aria-hidden={touchable ? undefined : 'true'}
      style={{ ['--full' as string]: swell.toFixed(3) }}
    >
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
      {tap > 0 && (
        <img key={tap} className="noface__gift" src={budgetTheme.gold.konpeito[hue]} alt="" draggable={false} />
      )}
      {touchable && <button type="button" className="noface__touch" aria-label="Saluer le Sans-Visage" onClick={onTap} />}
    </div>
  );
}
