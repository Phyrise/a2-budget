/**
 * Toucher un kodama (karakara.ts) : un vrai toucher bref posé SUR la forêt
 * (cible dans la scène elle-même, jamais un bouton par-dessus), sans
 * glissement — un défilement, une parallaxe au doigt ou un appui long ne
 * comptent pas. Écoute passive : aucun geste de la forêt n'est intercepté
 * (gardien passé au toucher, lanterne, défilement de la feuille).
 *
 * Mouvement « immobile » ou bandeau : rien ne bouge, seul le petit son
 * répond (s'il est permis).
 */
import type { WorldEngine } from './Engine';
import { now } from './Engine';
import { DEFAULT_RIG, kodamaAt, RATTLE_AMP, type TouchTarget } from './karakara';

/** Glissement maximal (px) et durée maximale (ms) d'un toucher. */
const TAP_SLOP = 10;
const TAP_MS = 600;

function targets(e: WorldEngine, n: number): (TouchTarget | null)[] {
  const sp = e.spirits;
  const list: (TouchTarget | null)[] = e.kodamaSpots.map((s, i) => {
    const a = sp.kodama[i % Math.max(1, sp.kodama.length)];
    if (!a) return null;
    return { x: s.x, y: s.y, depth: s.depth, h: s.scale ?? 0.05, aspect: a.aspect, pivot: (a.head ?? DEFAULT_RIG).pivot, vis: sp.visibility(i) };
  });
  list.push(e.stone.roofTarget(n));
  return list;
}

/** Amplitude selon la préférence « Forêt » (douce : moitié moins), 0 = immobile. */
function amplitude(e: WorldEngine): number {
  if (!e.canFly || !e.animated) return 0;
  return e.cfg.motion === 'gentle' ? RATTLE_AMP * 0.6 : RATTLE_AMP;
}

/**
 * Fait secouer le kodama `i` (ou celui du toit, i = nombre d'emplacements) et
 * ses voisins. Vrai si un kodama a réagi (le son peut suivre).
 */
export function rattleKodama(e: WorldEngine, i: number): boolean {
  const n = now();
  const amp = amplitude(e);
  const roof = i >= e.kodamaSpots.length;
  if (amp === 0) return true;
  let ok: boolean;
  if (roof) {
    ok = e.stone.rattle(n, amp);
    // Le plus proche des kodama de la forêt lui répond.
    const near = nearestTo(e, e.stone.geometry().roof.x);
    if (ok && near >= 0) e.spirits.rattle(near, n + 0.32, amp * 0.8);
  } else {
    ok = e.spirits.rattle(i, n, amp);
    if (ok) e.stone.rattle(n + 0.45, amp * 0.7);
  }
  if (ok) e.requestFrame(true);
  return ok;
}

function nearestTo(e: WorldEngine, x: number): number {
  let best = -1;
  let bd = Infinity;
  e.kodamaSpots.forEach((s, i) => {
    const d = Math.abs(s.x - x);
    if (e.spirits.visibility(i) > 0.3 && d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** Point client → kodama touché (indice, toit = nombre d'emplacements) ou -1. */
export function kodamaAtClient(e: WorldEngine, clientX: number, clientY: number): number {
  if (e.spirits.guardianActive(now()) || e.cfg.variant === 'banner') return -1;
  const r = e.canvas.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return -1;
  const par = e.pipe.frame.uPar.value as [number, number];
  const m = e.cfg.manifest;
  return kodamaAt(e.framing, par, m.size.w / m.size.h, targets(e, now()), clientX - r.left, clientY - r.top);
}

/**
 * Aperçu (mode développeur) : le premier kodama visible secoue la tête ; s'il
 * n'y en a aucun, l'un d'eux et ses voisins sortent un instant, puis secouent.
 */
export function previewKodama(e: WorldEngine, onRattle: () => void) {
  let i = e.spirits.firstVisible();
  if (i < 0 && e.spirits.kodama.length > 0) {
    i = Math.min(1, e.kodamaSpots.length - 1);
    e.spirits.peekAround(i, now(), 4.5);
    e.requestFrame(true);
    window.setTimeout(() => {
      if (!e.isDestroyed && rattleKodama(e, i)) onRattle();
    }, 1100);
    return;
  }
  if (i >= 0 && rattleKodama(e, i)) onRattle();
}

/** Écoute les touchers brefs sur la forêt ; retourne la désinstallation. */
export function bindKodamaTouch(e: WorldEngine, onTouch: () => void): () => void {
  let down: { id: number; x: number; y: number; t: number } | null = null;
  const onForest = (target: EventTarget | null) => {
    const root = e.canvas.closest('.living-forest');
    return !!root && target instanceof Node && (root.contains(target) || target.contains(root));
  };
  const onDown = (ev: PointerEvent) => {
    const primary = ev.isPrimary && (ev.pointerType !== 'mouse' || ev.button === 0);
    down = primary && onForest(ev.target) ? { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now() } : null;
  };
  const onUp = (ev: PointerEvent) => {
    const d = down;
    down = null;
    if (!d || ev.pointerId !== d.id || e.isDestroyed) return;
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > TAP_SLOP || performance.now() - d.t > TAP_MS) return;
    const i = kodamaAtClient(e, ev.clientX, ev.clientY);
    if (i >= 0 && rattleKodama(e, i)) onTouch();
  };
  const onCancel = () => {
    down = null;
  };
  const opts = { passive: true } as const;
  window.addEventListener('pointerdown', onDown, opts);
  window.addEventListener('pointerup', onUp, opts);
  window.addEventListener('pointercancel', onCancel, opts);
  window.addEventListener('scroll', onCancel, opts);
  return () => {
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('scroll', onCancel);
  };
}
