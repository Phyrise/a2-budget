/**
 * Le Sans-Visage et l'argent du compte commun (V4.2) : il EST le compte.
 * - Le compte monte (virement coché, dépense décochée) : quelques pépites
 *   s'envolent de la case jusqu'à sa bouche ; il mâche, content, et
 *   s'arrondit (réaction 'gain').
 * - Le compte descend (dépense cochée, virement décoché) : les pièces le
 *   quittent et volent jusqu'à la case ; il se tasse un peu, triste
 *   (réaction 'loss').
 * Vol : couche `position: fixed` posée dans <body>, Web Animations API
 * (transform / opacity seulement), retirée à la fin ; jamais rendu si
 * prefers-reduced-motion (il réagit quand même, sans vol). Si le
 * Sans-Visage du solde est hors de l'écran, il vient au bord de l'écran,
 * réagit, puis repart (NoFaceVisitor).
 * Décoratif uniquement : les chiffres restent la seule information.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { playGive } from '../../../creatures/play';
import { soot, type PortTarget } from '../../../creatures/soot';
import { budgetTheme } from '../../../themes/manifest';
import { paymentReaction } from './mood';
import { REACT_MS, react, useReaction } from './reaction';

const FLIGHT_MS = 760;
const STAGGER_MS = 80;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type Point = { x: number; y: number };

/** La bouche du Sans-Visage (haut de la silhouette), bornée à l'écran. */
function mouthOf(target: HTMLElement | null): Point {
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
 * Fait voler `count` pépites de `from` à `to` (vers le Sans-Visage ou depuis
 * lui). La promesse est résolue à l'arrivée de la première pépite.
 */
export function flyNuggets(from: Point, to: Point, count: number): Promise<void> {
  if (prefersReducedMotion() || typeof document === 'undefined' || typeof Element.prototype.animate !== 'function') {
    return Promise.resolve();
  }
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
    const midY = Math.max(28, Math.min(from.y, to.y) - lift);
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

/** Le Sans-Visage du solde à l'écran pour les porteuses : ses pieds et sa bouche. */
function portTarget(target: HTMLElement | null): PortTarget | null {
  const img = target?.querySelector<HTMLElement>('.noface__img.is-shown') ?? target;
  const rect = img?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return { ground: { x: rect.left + rect.width / 2, y: rect.bottom - 4 }, mouth: mouthOf(target) };
}

/** Le Sans-Visage du solde est-il visible (hors bandeau du haut et de la navigation) ? */
function inView(el: HTMLElement | null): boolean {
  const rect = el?.getBoundingClientRect();
  if (!rect || rect.width === 0) return false;
  return rect.bottom > 56 && rect.top < window.innerHeight - 110;
}

/** Visite : il arrive au bord de l'écran, réagit, puis repart. */
export type Visit = 'in' | 'out' | null;
const LEAVE_MS = 420;
/** Le visiteur glisse depuis le bord avant que les pièces le quittent. */
const VISIT_SETTLE_MS = 280;

export interface Feeding {
  /** Racine du Sans-Visage du solde (cible ou départ des pépites). */
  noFaceRef: RefObject<HTMLDivElement | null>;
  /** Bouche du Sans-Visage visiteur (s'il faut venir hors de l'écran). */
  visitorRef: RefObject<HTMLSpanElement | null>;
  /** Une réaction est en cours (gain ou perte, voir `useReaction`). */
  eating: boolean;
  /** Plus de salut final depuis V4.2 (il ne finit plus tête basse) : toujours faux. */
  bowing: boolean;
  visit: Visit;
  /** Une case vient d'être cochée (`paid`) ou décochée en `origin`. */
  feed: (origin: Point, opts: { kind: 'transfer' | 'expense'; paid: boolean }) => void;
}

export function useFeeding(): Feeding {
  const noFaceRef = useRef<HTMLDivElement>(null);
  const visitorRef = useRef<HTMLSpanElement>(null);
  const reacting = useReaction() !== null;
  const [visit, setVisit] = useState<Visit>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  const feed = useCallback((origin: Point, opts: { kind: 'transfer' | 'expense'; paid: boolean }) => {
    window.clearTimeout(leaveTimer.current);
    // Hors de l'écran, il vient au bord, près de la liste.
    const visiting = !inView(noFaceRef.current);
    if (visiting) setVisit('in');
    const target = visiting ? visitorRef.current : noFaceRef.current;
    const kind = paymentReaction(opts.kind, opts.paid);
    const count = opts.kind === 'transfer' ? 5 : 3;
    if (opts.kind === 'transfer') {
      // Portage : des Noiraudes apportent (ou rapportent) la pièce ; un kompeitō
      // au bocal pour un virement coché (jamais retiré quand on décoche).
      soot.porters(origin, opts.paid, visiting ? null : portTarget(noFaceRef.current));
      if (opts.paid) playGive(1, 'virement');
    }
    const leaveAfter = (ms: number) => {
      if (!visiting) return;
      leaveTimer.current = window.setTimeout(() => {
        setVisit('out');
        leaveTimer.current = window.setTimeout(() => setVisit(null), LEAVE_MS);
      }, ms);
    };
    if (kind === 'gain') {
      void flyNuggets(origin, mouthOf(target), count).then(() => {
        if (!alive.current) return;
        react('gain');
        leaveAfter(REACT_MS + 260);
      });
      return;
    }
    // Perte : il s'attriste tout de suite, et les pièces le quittent.
    react('loss');
    window.setTimeout(() => void flyNuggets(mouthOf(target), origin, count), visiting ? VISIT_SETTLE_MS : 0);
    leaveAfter(REACT_MS + 260);
  }, []);

  return { noFaceRef, visitorRef, eating: reacting, bowing: false, visit, feed };
}
