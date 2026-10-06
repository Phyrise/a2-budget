/**
 * Une lanterne de pierre (tōrō) : la peinture si elle existe
 * (themes/lanterns.ts), sinon le dessin au trait de toroShapes.ts.
 * - `unlit` : pierre au repos ;
 * - `lit` : fenêtres allumées, halo qui respire, lumière au sol ;
 * - `silhouette` : forme seule, ton de brume, sans aucun détail (lanterne
 *   pas encore débloquée).
 */
import { useId, type MouseEvent } from 'react';
import { lanternArt } from '../../../themes/lanterns';
import { cx } from '../../../ui';
import { TORO, ellipse } from './toroShapes';

export type ToroMode = 'unlit' | 'lit' | 'silhouette';

const block = (e: MouseEvent) => e.preventDefault();

export function ToroArt({ id, mode = 'unlit', size = 96, className }: { id: string; mode?: ToroMode; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const painted = lanternArt[id];
  const width = Math.round((size * 120) / 160);
  const cls = cx('toro', `toro--${mode}`, className);

  if (painted && (mode !== 'silhouette' || painted.silhouette)) {
    const src = mode === 'lit' ? painted.lit : mode === 'silhouette' ? painted.silhouette! : painted.unlit;
    return (
      <span className={cls} style={{ width, height: size }} aria-hidden="true">
        <img src={src} alt="" draggable={false} onContextMenu={block} onDragStart={block} className="toro__img" />
      </span>
    );
  }

  const shape = TORO[id] ?? TORO['kasuga-moss']!;
  const [gx, gy, gr] = shape.glow;
  const warm = shape.spirit ? ['#f2fff8', '#9fe3c8', '#4fb79a'] : ['#fff1cf', '#ffc874', '#e0892f'];
  const silhouette = mode === 'silhouette';
  const lit = mode === 'lit';

  return (
    <svg
      className={cls}
      width={width}
      height={size}
      viewBox="0 0 120 160"
      aria-hidden="true"
      focusable="false"
      onContextMenu={block}
    >
      <defs>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0" stopColor={warm[1]} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={warm[2]} stopOpacity="0.18" />
          <stop offset="1" stopColor={warm[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-win`} cx="0.5" cy="0.6" r="0.75">
          <stop offset="0" stopColor={warm[0]} />
          <stop offset="0.55" stopColor={warm[1]} />
          <stop offset="1" stopColor={warm[2]} />
        </radialGradient>
        {silhouette && (
          <filter id={`${uid}-mist`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        )}
      </defs>

      {!silhouette && <path className="toro__shadow" d={ellipse(60, 150, 42, 3.6)} />}
      {lit && (
        <>
          <circle className="toro__halo" cx={gx} cy={gy} r={gr * 1.6} fill={`url(#${uid}-halo)`} />
          <path className="toro__ground" d={ellipse(60, 150, 34, 4)} fill={warm[1]} />
        </>
      )}

      <g className="toro__body" filter={silhouette ? `url(#${uid}-mist)` : undefined}>
        {shape.body.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {silhouette && shape.windows.map((d, i) => <path key={`w${i}`} d={d} />)}
      </g>

      {!silhouette && (
        <>
          <g className="toro__windows" fill={lit ? `url(#${uid}-win)` : undefined}>
            {shape.windows.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="toro__moss">
            {shape.moss.map(([x, y, rx, ry], i) => (
              <path key={i} d={ellipse(x, y, rx, ry)} />
            ))}
          </g>
          <g className="toro__carve">
            {shape.carve.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {shape.accents.map((a, i) => (
            <path key={i} d={a.d} className={`toro__accent toro__accent--${a.tone}`} />
          ))}
          {shape.orbs?.map(([x, y, r], i) => (
            <circle key={i} className="toro__orb" cx={x} cy={y} r={r} fill={warm[1]} style={{ animationDelay: `${i * -1.3}s` }} />
          ))}
        </>
      )}
    </svg>
  );
}
