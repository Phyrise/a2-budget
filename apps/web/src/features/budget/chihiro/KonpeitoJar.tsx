/**
 * Le bocal de kompeitō (Arthur) : petit, discret, dans l'univers Chihiro
 * (verre, tissu vermillon noué), sans texte sauf le nombre. Il se remplit
 * facilement (+1 par soin fait, par virement coché, par Noiraude attrapée,
 * +5 pour la dorée ; 20 au départ ; jamais retiré quand on annule).
 * Glisser un kompeitō depuis le bocal : les Noiraudes le suivent en
 * troupeau ; le lâcher le leur donne (coûte 1). Relâché tout près : il
 * revient, gratuit. État : creatures/play (hors AppState).
 * Au doigt : zone de toucher élargie (jar.css), défilement bloqué sur le
 * bocal, et un geste perdu (capture perdue sans pointerup, nouveau doigt)
 * ne bloque jamais le suivant.
 */
import { useEffect, useRef, type PointerEvent } from 'react';
import { playSpend, usePlay } from '../../../creatures/play';
import { registerJar, soot } from '../../../creatures/soot';
import { cx } from '../../../ui';

const TONES = ['#f4b6c6', '#f6dc86', '#bfe3a6', '#f3ece0', '#b4d2f0', '#d3bcef'];
/** Places des kompeitō dans le bocal, du fond vers le haut (viewBox 28 × 34). */
const SPOTS: ReadonlyArray<readonly [number, number]> = [
  [7.5, 30], [12, 30.6], [16.5, 30.4], [21, 30],
  [9.5, 26.6], [14.2, 27], [18.8, 26.6], [5.8, 26],
  [22.3, 25.8], [11.8, 23.2], [16.6, 23.4], [7.4, 22.4],
  [21, 22.2], [14, 19.8], [9.6, 19], [18.6, 19],
];

function star(cx0: number, cy0: number, r: number): string {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.72;
    d += `${i === 0 ? 'M' : 'L'}${(cx0 + Math.cos(a) * rr).toFixed(2)} ${(cy0 + Math.sin(a) * rr).toFixed(2)}`;
  }
  return `${d}Z`;
}

const STARS = SPOTS.map(([x, y], i) => ({ d: star(x, y, 2.3), fill: TONES[(i * 5) % TONES.length]! }));

export function KonpeitoJar() {
  const { jar } = usePlay();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    registerJar(ref.current);
    return () => registerJar(null);
  }, []);

  const wiggle = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-empty');
    void el.offsetWidth;
    el.classList.add('is-empty');
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button > 0) return;
    // Un geste précédent jamais terminé (doigt perdu) : il rend son bonbon.
    if (drag.current !== null) {
      drag.current = null;
      soot.treatCancel();
    }
    if (jar < 1) {
      wiggle();
      return;
    }
    e.preventDefault();
    if (!soot.treatStart({ x: e.clientX, y: e.clientY }, e.pointerType !== 'mouse')) return;
    drag.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointeur déjà relâché.
    }
    e.currentTarget.classList.add('is-open');
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) soot.treatMove({ x: e.clientX, y: e.clientY });
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    e.currentTarget.classList.remove('is-open');
    if (soot.treatDrop({ x: e.clientX, y: e.clientY })) playSpend(1);
  };
  const onCancel = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    e.currentTarget.classList.remove('is-open');
    soot.treatCancel();
  };

  const shown = Math.min(jar, STARS.length);
  return (
    <div
      ref={ref}
      className={cx('konpeito-jar', jar === 0 && 'is-bare')}
      role="img"
      aria-label={`Bocal de kompeitō : ${jar}`}
      data-testid="konpeito-jar"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onLostPointerCapture={onCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="konpeito-jar__count" data-testid="konpeito-count">
        {jar}
      </span>
      <svg className="konpeito-jar__glass" viewBox="0 0 28 34" width="26" height="32" aria-hidden="true">
        <path className="konpeito-jar__body" d="M8 11h12q5 2 5 8v9q0 5-5 5H8q-5 0-5-5v-9q0-6 5-8z" />
        {STARS.slice(0, shown).map((s, i) => (
          <path key={i} d={s.d} fill={s.fill} className="konpeito-jar__star" />
        ))}
        <path className="konpeito-jar__shine" d="M6 16q-.6 6 .4 11.5" />
        <path className="konpeito-jar__cloth" d="M5 8.6Q14 1.4 23 8.6l-.8 2.2Q14 8.6 5.8 10.8z" />
        <path className="konpeito-jar__string" d="M5.8 10.6Q14 12.6 22.2 10.6" />
      </svg>
    </div>
  );
}
