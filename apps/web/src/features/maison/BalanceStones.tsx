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
  if (verdict === 'balanced') return Math.max(-3, Math.min(3, ratio * 10));
  const sign = Math.sign(ratio) || 1;
  return sign * Math.min(11, 6.5 + Math.abs(ratio) * 7);
}

function Stone({ x, w, h, who }: { x: number; w: number; h: number; who: 'a' | 'b' }) {
  // Galet de rivière posé sur la branche (y = 0 au contact), dessiné vers le haut.
  const r = w / 2;
  const P = (dx: number, dy: number) => `${(x + r * dx).toFixed(1)} ${(-h * dy).toFixed(1)}`;
  const body = `M${P(-1, 0.42)} C${P(-1, 0.86)} ${P(-0.45, 1)} ${P(0.1, 1)} C${P(0.74, 1)} ${P(1, 0.72)} ${P(1, 0.4)} C${P(1, 0.08)} ${P(0.6, 0)} ${P(0.05, 0)} C${P(-0.56, 0)} ${P(-1, 0.1)} ${P(-1, 0.42)} Z`;
  const moss = `M${P(-0.86, 0.6)} C${P(-0.62, 1.02)} ${P(0.56, 1.06)} ${P(0.88, 0.62)} C${P(0.6, 0.7)} ${P(0.38, 0.6)} ${P(0.12, 0.68)} C${P(-0.16, 0.76)} ${P(-0.46, 0.56)} ${P(-0.86, 0.6)} Z`;
  const tufts = `M${P(-0.34, 0.97)} l-1.4 -3.2 M${P(0.04, 1.01)} l0 -3.6 M${P(0.42, 0.95)} l1.6 -3.1`;
  const crack = `M${P(0.58, 0.46)} q${(-r * 0.1).toFixed(1)} ${(h * 0.14).toFixed(1)} ${(-r * 0.02).toFixed(1)} ${(h * 0.3).toFixed(1)}`;
  return (
    <g className={cx('bstone', `bstone--${who}`)}>
      <ellipse cx={x} cy={0.6} rx={r * 0.78} ry={2} className="bstone__shadow" />
      <path d={body} className="bstone__body" />
      <path d={moss} className="bstone__moss" />
      <path d={tufts} className="bstone__tufts" />
      <path d={crack} className="bstone__line" />
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
  const size = (v: number) => (quiet ? 0.84 : 0.88 + share(v) * 0.28);

  return (
    <svg className={cx('balance-art', quiet && 'is-quiet')} viewBox="0 6 320 120" role="presentation" aria-hidden="true" focusable="false">
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
      <path className="brock" d="M130 113 C132 97 144 88.5 160 88.5 C177 88.5 188 97 190 113 Z" />
      <path className="brock__moss" d="M137 99 C146 90 174 89 184 99 C173 94 149 94 137 99 Z" />
      <path className="bfern" d="M190 112 C192 104 197 99 204 97 M195 104 l5 -2 M193 108 l5 -1.5 M186 112 C183 106 179 103 173 102" />
      <path className="bground" d="M18 112.5 H302" />
      <g className="balance-branch" style={{ transform: `rotate(${angle}deg)` }}>
        <path className="bbranch" d="M30 87 C70 84 112 89 160 88 C204 87 246 84 290 88" />
        <path className="bbranch bbranch--thin" d="M150 88 C153 82 158 78 166 76 M158 81 C162 79 166 79 170 80" />
        <path
          className="bneedles"
          d="M166 76 l4 -3 M166 76 l5 0 M166 76 l3 3 M170 80 l4 -1.5 M170 80 l3 2.5 M290 88 l5 -2.5 M290 88 l5.5 0.5 M290 88 l4 3 M30 87 l-5 -2.5 M30 87 l-5.5 0.5 M30 87 l-4 3"
        />
        <g transform="translate(0 85.5)">
          <g style={{ transform: `scale(${size(a)})`, transformOrigin: '84px 0px' }}>
            <Stone x={84} w={70} h={40} who="a" />
          </g>
          <g style={{ transform: `scale(${size(b)})`, transformOrigin: '236px 0px' }}>
            <Stone x={236} w={70} h={40} who="b" />
          </g>
        </g>
      </g>
    </svg>
  );
}
