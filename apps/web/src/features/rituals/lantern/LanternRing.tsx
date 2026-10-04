/**
 * Grande lanterne de papier (chōchin) dans un anneau : la lumière monte dans
 * le papier au fil du temps, l'anneau se referme. Purement décoratif : le
 * temps restant est donné en texte à côté (aria-live poli).
 */
import { useId, type CSSProperties } from 'react';
import type { LanternWho } from './lanternStore';

const TINT: Record<LanternWho, string> = {
  a: '#d9e2ef',
  b: '#f0b067',
  both: '#ecd08a',
};

const CX = 120;
const CY = 124;
const RX = 44;
const RY = 50;
const R = 108;
const C = 2 * Math.PI * R;

function ribs(): string[] {
  const out: string[] = [];
  for (let i = -3; i <= 3; i++) {
    const y = CY + i * 13.5;
    const t = (y - CY) / RY;
    const w = RX * Math.sqrt(Math.max(0, 1 - t * t));
    out.push(`M${(CX - w).toFixed(1)} ${y.toFixed(1)} Q${CX} ${(y + 3.2).toFixed(1)} ${(CX + w).toFixed(1)} ${y.toFixed(1)}`);
  }
  return out;
}
const RIBS = ribs();
const BODY = `M${CX} ${CY - RY} C${CX + RX * 0.78} ${CY - RY} ${CX + RX} ${CY - RY * 0.52} ${CX + RX} ${CY} C${CX + RX} ${CY + RY * 0.52} ${CX + RX * 0.78} ${CY + RY} ${CX} ${CY + RY} C${CX - RX * 0.78} ${CY + RY} ${CX - RX} ${CY + RY * 0.52} ${CX - RX} ${CY} C${CX - RX} ${CY - RY * 0.52} ${CX - RX * 0.78} ${CY - RY} ${CX} ${CY - RY} Z`;

export function LanternRing({
  progress,
  who,
  burning,
  bloom = false,
  size = 220,
}: {
  progress: number;
  who: LanternWho;
  /** La flamme vacille (en cours, pas en pause). */
  burning: boolean;
  /** Floraison finale (lanterne pleine, halo élargi). */
  bloom?: boolean;
  size?: number;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `lr-${raw}-${name}`;
  const p = Math.min(1, Math.max(0, progress));
  const fillH = 2 * RY * (0.06 + 0.94 * p);
  const tint = TINT[who];
  const style = { '--lantern-tint': tint, width: size, height: size } as CSSProperties;

  return (
    <svg
      className={`lantern-ring${burning ? ' is-burning' : ''}${bloom ? ' is-bloom' : ''}`}
      viewBox="0 0 240 240"
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id('halo')} cx="50%" cy="52%" r="50%">
          <stop offset="0" stopColor={tint} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={tint} stopOpacity="0.16" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('light')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff4d6" stopOpacity="0.98" />
          <stop offset="0.55" stopColor={tint} stopOpacity="0.92" />
          <stop offset="1" stopColor="#c99a4f" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecd09a" />
          <stop offset="1" stopColor={tint} />
        </linearGradient>
        <clipPath id={id('body')}>
          <path d={BODY} />
        </clipPath>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Halo qui grandit avec la lumière. */}
      <circle
        className="lantern-ring__halo"
        cx={CX}
        cy={CY}
        r={70 + 40 * p + (bloom ? 24 : 0)}
        fill={`url(#${id('halo')})`}
        style={{ opacity: 0.25 + 0.75 * p }}
      />

      {/* Anneau : piste et progression. */}
      <circle cx={CX} cy={120} r={R} fill="none" stroke="rgba(236,230,211,0.10)" strokeWidth="3" />
      <circle
        className="lantern-ring__progress"
        cx={CX}
        cy={120}
        r={R}
        fill="none"
        stroke={`url(#${id('ring')})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - p)}
        transform="rotate(-90 120 120)"
      />

      {/* Fil, chapeau et pompon. */}
      <path d={`M${CX} 30 V${CY - RY - 8}`} stroke="rgba(236,230,211,0.35)" strokeWidth="1.2" />
      <rect x={CX - 15} y={CY - RY - 9} width="30" height="10" rx="3" fill="#2a1d14" stroke="rgba(236,230,211,0.18)" />
      <rect x={CX - 13} y={CY + RY - 1} width="26" height="9" rx="3" fill="#2a1d14" stroke="rgba(236,230,211,0.18)" />
      <path
        d={`M${CX} ${CY + RY + 8} v10 M${CX - 4} ${CY + RY + 9} v14 M${CX + 4} ${CY + RY + 9} v14`}
        stroke="#a06a4a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Papier : sombre, puis la lumière monte depuis le bas. */}
      <path d={BODY} fill="rgba(42, 34, 24, 0.92)" />
      <g clipPath={`url(#${id('body')})`}>
        <rect
          className="lantern-ring__glow"
          x={CX - RX - 4}
          y={CY + RY - fillH}
          width={2 * RX + 8}
          height={fillH + 4}
          fill={`url(#${id('light')})`}
          filter={`url(#${id('soft')})`}
        />
        <ellipse className="lantern-ring__flame" cx={CX} cy={CY + RY * 0.42} rx="9" ry="13" fill="#fff6dc" opacity={0.35 + 0.6 * p} filter={`url(#${id('soft')})`} />
      </g>
      <path d={BODY} fill="none" stroke="rgba(236,230,211,0.28)" strokeWidth="1.2" />
      {RIBS.map((d) => (
        <path key={d} d={d} fill="none" stroke="rgba(30, 22, 14, 0.42)" strokeWidth="1.1" />
      ))}
    </svg>
  );
}
