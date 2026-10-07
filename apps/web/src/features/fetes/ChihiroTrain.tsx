/**
 * Le train des eaux (V4.3) : à la première ouverture du mois, il traverse
 * la peinture du Budget en silhouette dessinée par le code — trois voitures
 * bleu nuit, fenêtres éclairées où passent des ombres de voyageurs,
 * pantographe, phare, sillage et reflet tremblé sur l'eau — en ≈ 6 s.
 *
 * Seulement sur la peinture PORTRAIT de la colonne du monde (ordinateur) :
 * c'est la seule où l'eau s'étend, dégagée, entre la falaise et la rambarde.
 * Sur le bandeau du téléphone (paysage), la bande d'eau est cachée derrière
 * le titre du mois et la rambarde : pas de train crédible, il ne passe pas.
 *
 * Une fois par mois (préférence locale `a2-budget:fetes:v1`), au premier
 * affichage du Budget sur ordinateur ; à la demande du panneau DEV. Sans
 * mouvement (prefers-reduced-motion, Forêt « Immobile ») : le train apparaît
 * arrêté sur l'eau, en fondu, puis s'efface. Décoratif (aria-hidden).
 */
import { currentMonthKey } from '@a2/core';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useMediaQuery, useShell } from '../../app/ShellContext';
import { cx } from '../../ui';
import { claimTrainMonth, useTrainRequest } from './feteEvents';
import { TrainArt, TRAIN_ART } from './TrainArt';
import './train.css';

/** Peinture portrait du Budget : 1024 × 1536, cadrage object-position 60 % 50 % (app/modules.ts). */
const PAINTING = { w: 1024, h: 1536, posX: 0.6, posY: 0.5 } as const;
/** Ligne d'eau du train, au pied des falaises (fraction de la hauteur de la peinture). */
const WATER_Y = 0.548;
/** Largeur du train (fraction de la largeur de la peinture). */
const TRAIN_W = 0.46;
const RUN_MS = 6200;
const STILL_MS = 3400;
const OPEN_DELAY_MS = 1200;

interface Box {
  w: number;
  h: number;
}

/** Placement du train dans la colonne (px) d'après le cadrage « cover » de la peinture. */
function placement(box: Box): CSSProperties {
  const scale = Math.max(box.w / PAINTING.w, box.h / PAINTING.h);
  const top = (box.h - PAINTING.h * scale) * PAINTING.posY;
  const width = TRAIN_W * PAINTING.w * scale;
  const height = (width * TRAIN_ART.h) / TRAIN_ART.w;
  const water = top + WATER_Y * PAINTING.h * scale;
  return {
    width: `${width}px`,
    height: `${height}px`,
    top: `${water - height * TRAIN_ART.waterline}px`,
    '--from': `${-width - 8}px`,
    '--to': `${box.w + 8}px`,
    '--mid': `${(box.w - width) / 2}px`,
  } as CSSProperties;
}

export function ChihiroTrain({ shown }: { shown: boolean }) {
  const { prefs } = useShell();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const still = reduced || prefs.forestMotion === 'still';
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [run, setRun] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Premier affichage du Budget dans le mois : le train passe, une fois.
  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => {
      if (claimTrainMonth(currentMonthKey(new Date()))) setRun((n) => (n === 0 ? Date.now() : n));
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  // Panneau DEV : un passage (jamais deux trains à la fois).
  useTrainRequest(() => setRun((n) => (n === 0 ? Date.now() : n)));

  useEffect(() => {
    if (run === 0) return;
    const done = window.setTimeout(() => setRun(0), still ? STILL_MS : RUN_MS);
    return () => window.clearTimeout(done);
  }, [run, still]);

  return (
    <div ref={ref} className={cx('chihiro-train', shown && 'is-shown')} aria-hidden="true">
      {run !== 0 && box && (
        <div key={run} className={cx('chihiro-train__run', still && 'is-still')} style={placement(box)}>
          <TrainArt />
        </div>
      )}
    </div>
  );
}
