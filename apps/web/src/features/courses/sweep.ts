/**
 * Coup de balai (Web Animations) : l'article coché file en courbe vers le
 * panier pendant que la ligne se referme (≈ 700 ms) ; décoché depuis le
 * panier, il revient dans son rayon par le chemin inverse. Kiki, le balai et
 * la poussière sont des calques CSS de la ligne (courses-kiki.css) ; ici
 * seulement la trajectoire et la hauteur, qui dépendent de mesures.
 *
 * Mouvement réduit : fondu simple et fermeture courte, sans trajectoire.
 */

/** Durée totale du coup de balai (fermeture de la ligne comprise). */
export const SWEEP_MS = 700;
/** Durée du retour d'un article dans son rayon. */
export const RETURN_MS = 520;

export interface Point {
  x: number;
  y: number;
}

export interface SweepRun {
  finished: Promise<void>;
  cancel: () => void;
}

/** Centre du panier en osier à l'écran, ramené dans la fenêtre visible. */
export function basketTarget(): Point {
  const h = window.innerHeight;
  const w = window.innerWidth;
  const el = document.querySelector('.basket-stage__basket');
  const r = el?.getBoundingClientRect();
  const x = r && r.width > 0 ? r.left + r.width / 2 : w * 0.78;
  const y = r && r.height > 0 ? r.top + r.height * 0.45 : h - 110;
  return { x: Math.min(Math.max(x, 24), w - 24), y: Math.min(Math.max(y, 90), h - 110) };
}

function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(r.width, 220) / 2, y: r.top + r.height / 2 };
}

/** Trajectoire en arc (Bézier quadratique) de (0,0) à `d`, en images clés. */
function arcFrames(d: Point, from: { scale: number; opacity: number }, to: { scale: number; opacity: number }, steps = 9): Keyframe[] {
  const lift = Math.min(110, 40 + Math.abs(d.y) * 0.25);
  const c = { x: d.x * 0.45, y: Math.min(0, d.y) - lift };
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = 2 * u * t * c.x + t * t * d.x;
    const y = 2 * u * t * c.y + t * t * d.y;
    const k = t * t;
    const scale = from.scale + (to.scale - from.scale) * k;
    const opacity = from.opacity + (to.opacity - from.opacity) * Math.max(0, (t - 0.7) / 0.3);
    frames.push({ offset: t, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`, opacity });
  }
  return frames;
}

function run(animations: Animation[]): SweepRun {
  let cancelled = false;
  const finished = Promise.all(animations.map((a) => a.finished)).then(
    () => undefined,
    () => undefined,
  );
  return {
    finished: finished.then(() => (cancelled ? Promise.reject(new Error('cancelled')) : undefined)),
    cancel() {
      cancelled = true;
      animations.forEach((a) => a.cancel());
    },
  };
}

function collapse(row: HTMLElement, delay: number, duration: number): Animation {
  const h = row.getBoundingClientRect().height;
  return row.animate(
    [
      { height: `${h}px`, borderBottomColor: 'var(--line)' },
      { height: '0px', borderBottomColor: 'transparent' },
    ],
    { duration, delay, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  );
}

function expand(row: HTMLElement, duration: number): Animation {
  const h = row.getBoundingClientRect().height;
  return row.animate([{ height: '0px' }, { height: `${h}px` }], { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
}

/** L'article file vers le panier, puis la ligne se referme. */
export function sweepToBasket(row: HTMLElement, content: HTMLElement, reduced: boolean): SweepRun {
  if (typeof content.animate !== 'function') return { finished: Promise.resolve(), cancel: () => undefined };
  if (reduced) {
    return run([
      content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }),
      collapse(row, 160, 200),
    ]);
  }
  const from = centerOf(content);
  const to = basketTarget();
  const d = { x: to.x - from.x, y: to.y - from.y };
  return run([
    content.animate(arcFrames(d, { scale: 1, opacity: 1 }, { scale: 0.4, opacity: 0 }), {
      duration: 470,
      delay: 120,
      easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
      fill: 'forwards',
    }),
    collapse(row, 430, SWEEP_MS - 430),
  ]);
}

/** L'article ressort du panier et retrouve sa place dans son rayon. */
export function returnFromBasket(row: HTMLElement, content: HTMLElement, reduced: boolean): SweepRun {
  if (typeof content.animate !== 'function') return { finished: Promise.resolve(), cancel: () => undefined };
  if (reduced) {
    return run([content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' })]);
  }
  const at = centerOf(content);
  const basket = basketTarget();
  const d = { x: basket.x - at.x, y: basket.y - at.y };
  // Même arc que l'aller, parcouru à l'envers.
  const frames = arcFrames(d, { scale: 1, opacity: 1 }, { scale: 0.32, opacity: 0 })
    .reverse()
    .map((f) => ({ ...f, offset: 1 - (f.offset as number) }));
  return run([
    expand(row, 260),
    content.animate(frames, { duration: RETURN_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }),
  ]);
}
