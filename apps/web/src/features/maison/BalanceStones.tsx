/**
 * Visuel qualitatif de l'équilibre : deux pierres moussues posées sur une
 * branche de cèdre, en appui sur un rocher. La branche penche doucement du
 * côté de qui a porté davantage — jamais de chiffre, jamais de couleur
 * d'alerte. Gauche = AL (clair de lune), droite = AC (braise).
 * Le basculement s'anime une fois (désactivé si prefers-reduced-motion).
 */
import { useEffect, useState } from 'react';
import type { BalanceVerdict } from '@a2/core';
import { cx } from '../../ui';

/** Angle (degrés, positif = la droite descend) d'après les intermédiaires. */
export function tiltFor(a: number, b: number, verdict: BalanceVerdict): number {
  const total = a + b;
  if (verdict === 'quiet' || total <= 0) return 0;
  const ratio = (b - a) / total; // -1..1
  if (verdict === 'balanced') return Math.max(-2.5, Math.min(2.5, ratio * 8));
  const sign = Math.sign(ratio) || 1;
  return sign * Math.min(9, 5 + Math.abs(ratio) * 6);
}

function Stone({ x, w, h, who }: { x: number; w: number; h: number; who: 'a' | 'b' }) {
  // Pierre posée sur la branche (y = 0 au contact), dessinée vers le haut.
  const r = w / 2;
  const body = `M${x - r} -1.5 C${x - r} ${-h * 0.62} ${x - r * 0.5} ${-h} ${x + r * 0.08} ${-h} C${x + r * 0.7} ${-h} ${x + r} ${-h * 0.55} ${x + r} -1.5 Z`;
  const moss = `M${x - r * 0.78} ${-h * 0.6} C${x - r * 0.5} ${-h * 0.98} ${x + r * 0.5} ${-h * 1.02} ${x + r * 0.82} ${-h * 0.56} C${x + r * 0.4} ${-h * 0.74} ${x - r * 0.3} ${-h * 0.76} ${x - r * 0.78} ${-h * 0.6} Z`;
  return (
    <g className={cx('bstone', `bstone--${who}`)}>
      <ellipse cx={x} cy={1} rx={r * 0.9} ry={2.2} className="bstone__shadow" />
      <path d={body} className="bstone__body" />
      <path d={moss} className="bstone__moss" />
      <path d={`M${x - r * 0.35} ${-h * 0.32} q${r * 0.25} ${-h * 0.08} ${r * 0.5} 0`} className="bstone__line" />
      <circle cx={x + r * 0.42} cy={-h * 0.36} r={1.6} className="bstone__glint" />
    </g>
  );
}

export function BalanceStones({ a, b, verdict }: { a: number; b: number; verdict: BalanceVerdict }) {
  const target = tiltFor(a, b, verdict);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setAngle(target));
    return () => window.cancelAnimationFrame(id);
  }, [target]);

  const total = a + b;
  const share = (v: number) => (total > 0 ? v / total : 0.5);
  const quiet = verdict === 'quiet';
  const size = (v: number) => (quiet ? 0.9 : 0.86 + share(v) * 0.32);

  return (
    <svg className={cx('balance-art', quiet && 'is-quiet')} viewBox="0 0 320 124" role="presentation" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bstone-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4757" />
          <stop offset="1" stopColor="#1d2630" />
        </linearGradient>
        <linearGradient id="bstone-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d3a2b" />
          <stop offset="1" stopColor="#2a1f18" />
        </linearGradient>
        <radialGradient id="bmist" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#b9c6bd" stopOpacity="0.13" />
          <stop offset="1" stopColor="#b9c6bd" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="104" rx="150" ry="16" fill="url(#bmist)" />
      {/* Rocher d'appui, mousse et fougère. */}
      <path className="brock" d="M134 112 C136 98 146 89 160 89 C175 89 185 98 187 112 Z" />
      <path className="brock__moss" d="M140 100 C147 92 172 91 181 100 C172 96 150 96 140 100 Z" />
      <path className="bfern" d="M190 112 C192 104 197 99 204 97 M195 104 l5 -2 M193 108 l5 -1.5 M186 112 C183 106 179 103 173 102" />
      <path className="bground" d="M18 112.5 H302" />
      <g className="balance-branch" style={{ transform: `rotate(${angle}deg)` }}>
        <path className="bbranch" d="M30 87 C70 84 112 89 160 88 C204 87 246 84 290 88" />
        <path className="bbranch bbranch--thin" d="M60 86 C66 80 72 78 80 77 M232 86 C240 80 248 78 256 79 M118 88 C122 93 126 95 132 96 M196 87 C200 92 206 94 212 94" />
        <path className="bneedles" d="M80 77 l4 -3 M80 77 l5 0 M256 79 l4 -3 M256 79 l5 1 M132 96 l4 2 M212 94 l4 1 M290 88 l5 -2 M290 88 l5 2 M30 87 l-5 -2 M30 87 l-5 2" />
        <g transform="translate(0 85.5)">
          <g style={{ transform: `scale(${size(a)})`, transformOrigin: '84px 0px' }}>
            <Stone x={84} w={50} h={34} who="a" />
          </g>
          <g style={{ transform: `scale(${size(b)})`, transformOrigin: '236px 0px' }}>
            <Stone x={236} w={50} h={34} who="b" />
          </g>
        </g>
      </g>
    </svg>
  );
}
