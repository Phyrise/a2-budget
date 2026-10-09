/**
 * Dessins des quêtes communes (SVG 80 × 64, par le code) : le rocher qu'une
 * Noiraude pousse en vain (Chihiro), le petit colis tombé du balai, à moitié
 * enterré (Kiki), la pousse à arroser (Totoro). Volumes et ombres douces par
 * dégradés. Les trois états (attente, à moitié, réglée) ne changent que des
 * classes : le CSS (quest-art.css) fait bouger les pièces.
 */
import type { QuestKind, QuestStatus } from '@a2/core';
import { useId } from 'react';
import './quest-art.css';

function Soot() {
  return (
    <g className="quest-art__soot">
      <g className="quest-art__push">
        <circle cx="60" cy="45" r="10.6" fill="none" stroke="#141215" strokeWidth="2.6" strokeDasharray="1.1 1.5" />
        <circle cx="60" cy="45" r="9.2" fill="#141215" />
        <ellipse cx="57" cy="41.5" rx="3.2" ry="2" fill="#3a3540" opacity="0.7" />
        <circle cx="56.6" cy="43.6" r="2.5" fill="#f4f1e8" />
        <circle cx="62.6" cy="43.6" r="2.5" fill="#f4f1e8" />
        <circle className="quest-art__eye" cx="56.1" cy="43.9" r="1.05" fill="#141215" />
        <circle className="quest-art__eye" cx="62.1" cy="43.9" r="1.05" fill="#141215" />
        <path d="M50 49l-3 1M50.5 46l-3.4-.4" stroke="#141215" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Rocher({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}r`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#bdb6a6" />
          <stop offset="0.55" stopColor="#8d877a" />
          <stop offset="1" stopColor="#5e5a51" />
        </radialGradient>
      </defs>
      <ellipse className="quest-art__shadow" cx="42" cy="57" rx="30" ry="4.6" fill="rgba(0,0,0,0.3)" />
      <Soot />
      <g className="quest-art__rock">
        <path d="M16 55c-4-10 0-22 11-26 9-4 20-3 25 4 6 7 7 16 2 22Z" fill={`url(#${id}r)`} />
        <path d="M23 33c4-3 9-4.5 13-4" fill="none" stroke="#dcd6c6" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
        <path d="M30 47c3 2 8 2 11 0" fill="none" stroke="#5a564d" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18 52c4-3 9-3 13-1-3 3-9 4-13 1Z" fill="#6f9a52" />
        <circle cx="21" cy="50.6" r="1.4" fill="#8fbf6a" />
        <circle cx="46" cy="40" r="1.5" fill="#a59e8f" />
      </g>
    </>
  );
}

function Tresor({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ecd2a6" />
          <stop offset="1" stopColor="#bf9866" />
        </linearGradient>
        <radialGradient id={`${id}m`} cx="0.5" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#8a6446" />
          <stop offset="1" stopColor="#4f3726" />
        </radialGradient>
      </defs>
      <ellipse className="quest-art__shadow" cx="40" cy="58" rx="30" ry="4.2" fill="rgba(0,0,0,0.28)" />
      <g className="quest-art__parcel">
        <rect x="26" y="29" width="28" height="21" rx="3" fill={`url(#${id}b)`} />
        <rect x="26" y="29" width="28" height="4" rx="2" fill="#f4e2c0" opacity="0.6" />
        <rect x="38.4" y="29" width="3.6" height="21" fill="#c2413b" />
        <rect x="26" y="37.6" width="28" height="3.6" fill="#c2413b" />
        <path d="M40 29c-6-6.5-12-2-7.5 1.2Zm0 0c6-6.5 12-2 7.5 1.2Z" fill="#d6534b" />
        <rect x="45" y="42" width="7" height="5" rx="1" fill="#f6efe0" transform="rotate(-8 48 44)" />
      </g>
      <path className="quest-art__mound" d="M8 58c4-13 19-16 32-16s28 3 32 16Z" fill={`url(#${id}m)`} />
      <path d="M17 51c5-3 10-4 14-3M48 47.5c4 0 8 1 11 3" fill="none" stroke="#a07756" strokeWidth="1.5" strokeLinecap="round" />
      <g className="quest-art__crumbs" fill="#6b4a32">
        <circle cx="22" cy="44" r="1.5" />
        <circle cx="58" cy="42" r="1.2" />
        <circle cx="30" cy="40" r="1" />
      </g>
    </>
  );
}

function Pousse({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}c`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#8fcc5a" />
          <stop offset="1" stopColor="#3f7a2e" />
        </radialGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a6dc6c" />
          <stop offset="1" stopColor="#5f9d3d" />
        </linearGradient>
      </defs>
      <ellipse className="quest-art__shadow" cx="40" cy="58" rx="22" ry="3.8" fill="rgba(0,0,0,0.28)" />
      <g className="quest-art__drops" fill="#9fd3f0">
        <path d="M22 24c-2 3-2 5 0 5s2-2 0-5Z" />
        <path d="M58 20c-2 3-2 5 0 5s2-2 0-5Z" />
        <path d="M31 13c-2 3-2 5 0 5s2-2 0-5Z" />
        <path d="M50 10c-2 3-2 5 0 5s2-2 0-5Z" />
      </g>
      <g className="quest-art__sprout">
        <g className="quest-art__sway">
          <path d="M40 56V33" stroke="#4f8a35" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M40 41c-8-1-13-6-13-11 7 0 12 3.5 13 11Z" fill={`url(#${id}l)`} />
          <path d="M40 36c7.5-1 12-6 12-11-6.5 0-11 3.5-12 11Z" fill={`url(#${id}l)`} />
          <path className="quest-art__leaf2" d="M40 47c-6 0-9-3-10-6 5-.5 8.5 1.5 10 6Z" fill="#7fbf4f" />
          <g className="quest-art__crown">
            <ellipse cx="40" cy="24" rx="13" ry="11" fill={`url(#${id}c)`} />
            <ellipse cx="35" cy="20" rx="5" ry="3.4" fill="#a6dc6c" opacity="0.55" />
            <circle cx="45" cy="27" r="1.6" fill="#f6dc86" />
            <circle cx="34" cy="28" r="1.3" fill="#f4b6c6" />
          </g>
        </g>
      </g>
      <path d="M25 58c2-6 8.5-8 15-8s13 2 15 8Z" fill="#5b4330" />
      <path d="M30 53c3-1.6 6-2 9-2" stroke="#7a5a40" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </>
  );
}

export function QuestArt({ kind, status }: { kind: QuestKind; status: QuestStatus }) {
  const id = `qa${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 80 64" className={`quest-art quest-art--${kind} is-${status}`} aria-hidden="true" focusable="false">
      {kind === 'rocher' ? <Rocher id={id} /> : kind === 'tresor' ? <Tresor id={id} /> : <Pousse id={id} />}
    </svg>
  );
}
