/**
 * Le Sans-Visage mange l'argent (V4) : quand on coche un paiement du mois,
 * quelques pépites d'or s'envolent de la case jusqu'à lui ; à leur arrivée
 * il mâche, la pépite à la bouche, et s'arrondit un peu (pose 'content',
 * voir NoFace) ; quand tout est payé, il salue. Toujours doux.
 *
 * - Vol : couche `position: fixed` posée dans <body>, Web Animations API
 *   (transform / opacity seulement), retirée à la fin ; jamais rendu si
 *   prefers-reduced-motion (il mâche quand même, sans voler).
 * - Si le Sans-Visage du solde est hors de l'écran (on a fait défiler
 *   jusqu'à la liste), il vient au bord de l'écran, mange, puis repart
 *   (NoFaceVisitor).
 * Décoratif uniquement : les chiffres restent la seule information.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { budgetTheme } from '../../../themes/manifest';
import { BOW_MS } from './useMonthEdits';

export const CHEW_MS = 1500;
const FLIGHT_MS = 760;
const STAGGER_MS = 80;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Point visé : la bouche du Sans-Visage (haut de la silhouette), borné à l'écran. */
function mouthOf(target: HTMLElement | null): { x: number; y: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const img = target?.querySelector<HTMLElement>('.noface__img.is-shown') ?? target;
  const rect = img?.getBoundingClientRect();
  if (!rect || rect.width === 0) return { x: w * 0.25, y: 12 };
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height * 0.3;
  return { x: Math.min(w - 12, Math.max(12, x)), y: Math.min(h - 12, Math.max(12, y)) };
}

/**
 * Fait voler `count` pépites de `from` vers le Sans-Visage. La promesse est
 * résolue à l'arrivée de la première pépite (le début du repas).
 */
export function flyNuggets(from: { x: number; y: number }, target: HTMLElement | null, count: number): Promise<void> {
  if (prefersReducedMotion() || typeof document === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return Promise.resolve();
  }
  const to = mouthOf(target);
  const layer = document.createElement('div');
  layer.className = 'nugget-flight';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  const pool = [...budgetTheme.gold.nuggets, ...budgetTheme.gold.coins];
  const flights: Array<Promise<void>> = [];
  for (let i = 0; i < count; i += 1) {
    const img = document.createElement('img');
    img.src = pool[(i * 4 + count) % pool.length] ?? budgetTheme.gold.nuggets[0] ?? '';
    img.alt = '';
    img.className = 'nugget-flight__piece';
    layer.appendChild(img);
    const spread = (i - (count - 1) / 2) * 12;
    const lift = 70 + (i % 3) * 18;
    const midX = (from.x + to.x) / 2 + spread * 1.6;
    const midY = Math.min(from.y, to.y) - lift;
    const turn = (i % 2 === 0 ? 1 : -1) * (120 + i * 35);
    const animation = img.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(0.4)`, opacity: 0 },
        {
          offset: 0.14,
          transform: `translate(${from.x + spread}px, ${from.y - 16}px) translate(-50%, -50%) scale(1)`,
          opacity: 1,
        },
        {
          offset: 0.58,
          transform: `translate(${midX}px, ${midY}px) translate(-50%, -50%) scale(0.95) rotate(${turn / 2}deg)`,
          opacity: 1,
        },
        { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(0.35) rotate(${turn}deg)`, opacity: 0.15 },
      ],
      { duration: FLIGHT_MS + i * 40, delay: i * STAGGER_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' },
    );
    flights.push(
      animation.finished.then(
        () => undefined,
        () => undefined,
      ),
    );
  }
  void Promise.all(flights).then(() => layer.remove());
  // Filet de sécurité (onglet caché : les animations peuvent être suspendues).
  window.setTimeout(() => layer.remove(), FLIGHT_MS + count * (STAGGER_MS + 40) + 1500);
  return flights[0] ?? Promise.resolve();
}

/** Le Sans-Visage du solde est-il visible (hors bandeau du haut et de la navigation) ? */
function inView(el: HTMLElement | null): boolean {
  const rect = el?.getBoundingClientRect();
  if (!rect || rect.width === 0) return false;
  return rect.bottom > 56 && rect.top < window.innerHeight - 110;
}

/** Visite : il arrive au bord de l'écran, mange, puis repart. */
export type Visit = 'in' | 'out' | null;
const LEAVE_MS = 420;

export interface Feeding {
  /** Racine du Sans-Visage du solde (cible des pépites). */
  noFaceRef: RefObject<HTMLDivElement | null>;
  /** Bouche du Sans-Visage visiteur (s'il faut venir manger hors de l'écran). */
  visitorRef: RefObject<HTMLSpanElement | null>;
  eating: boolean;
  /** Salut après le dernier paiement du mois. */
  bowing: boolean;
  visit: Visit;
  /** Une case vient d'être cochée en `origin` ; `allPaid` : c'était la dernière. */
  feed: (origin: { x: number; y: number }, opts: { count: number; allPaid: boolean }) => void;
}

export function useFeeding(): Feeding {
  const noFaceRef = useRef<HTMLDivElement>(null);
  const visitorRef = useRef<HTMLSpanElement>(null);
  const [eating, setEating] = useState(false);
  const [bowing, setBowing] = useState(false);
  const [visit, setVisit] = useState<Visit>(null);
  const chewTimer = useRef<number | undefined>(undefined);
  const bowTimer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(chewTimer.current);
      window.clearTimeout(bowTimer.current);
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  const feed = useCallback((origin: { x: number; y: number }, opts: { count: number; allPaid: boolean }) => {
    window.clearTimeout(leaveTimer.current);
    // Hors de l'écran, il vient manger au bord, près de la liste.
    const visiting = !inView(noFaceRef.current);
    if (visiting) setVisit('in');
    const target = visiting ? visitorRef.current : noFaceRef.current;
    const leave = () => {
      if (!visiting) return;
      leaveTimer.current = window.setTimeout(() => {
        setVisit('out');
        leaveTimer.current = window.setTimeout(() => setVisit(null), LEAVE_MS);
      }, 260);
    };
    void flyNuggets(origin, target, opts.count).then(() => {
      if (!alive.current) return;
      window.clearTimeout(bowTimer.current);
      setBowing(false);
      setEating(true);
      window.clearTimeout(chewTimer.current);
      chewTimer.current = window.setTimeout(() => {
        setEating(false);
        if (!opts.allPaid) {
          leave();
          return;
        }
        setBowing(true);
        bowTimer.current = window.setTimeout(() => {
          setBowing(false);
          leave();
        }, BOW_MS);
      }, CHEW_MS);
    });
  }, []);

  return { noFaceRef, visitorRef, eating, bowing, visit, feed };
}
