/**
 * Dessins des quêtes communes (SVG 80 × 64, par le code) : le rocher qui
 * bloque une Noiraude (Chihiro), le petit colis à moitié enterré (Kiki), la
 * pousse à arroser (Totoro). Les trois états (attente, à moitié, réglée) ne
 * changent que des classes : le CSS (quests.css) fait bouger les pièces.
 */
import type { QuestKind, QuestStatus } from '@a2/core';

function Soot() {
  return (
    <g className="quest-art__soot">
      <circle cx="58" cy="44" r="8.5" fill="#141215" />
      <circle cx="58" cy="44" r="10" fill="none" stroke="#141215" strokeWidth="2.4" strokeDasharray="1.2 1.6" />
      <circle cx="55.3" cy="42.6" r="2.4" fill="#f4f1e8" />
      <circle cx="60.9" cy="42.6" r="2.4" fill="#f4f1e8" />
      <circle cx="55.7" cy="42.9" r="1" fill="#141215" />
      <circle cx="61.3" cy="42.9" r="1" fill="#141215" />
    </g>
  );
}

function Rocher() {
  return (
    <>
      <ellipse cx="42" cy="56" rx="30" ry="4.5" fill="rgba(0,0,0,0.28)" />
      <Soot />
      <g className="quest-art__rock">
        <path d="M18 54c-4-9 0-21 10-25 8-4 19-3 24 4 6 7 6 16 2 21Z" fill="#8a8579" />
        <path d="M24 33c5-4 14-5 19-1" fill="none" stroke="#b9b3a3" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M30 46c3 2 8 2 11 0" fill="none" stroke="#6c685e" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="47" cy="40" r="1.6" fill="#a7a091" />
      </g>
    </>
  );
}

function Tresor() {
  return (
    <>
      <ellipse cx="40" cy="57" rx="28" ry="4" fill="rgba(0,0,0,0.25)" />
      <g className="quest-art__parcel">
        <rect x="27" y="30" width="26" height="20" rx="2.5" fill="#d9b98a" />
        <rect x="38" y="30" width="4" height="20" fill="#c2413b" />
        <rect x="27" y="38" width="26" height="4" fill="#c2413b" />
        <path d="M40 30c-6-6-11-2-7 1Zm0 0c6-6 11-2 7 1Z" fill="#d6534b" />
      </g>
      <path className="quest-art__mound" d="M10 57c4-12 18-15 30-15s26 3 30 15Z" fill="#6b4a32" />
      <path d="M18 50c5-3 10-4 14-3M48 47c4 0 8 1 11 3" fill="none" stroke="#8a6446" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

function Pousse() {
  return (
    <>
      <ellipse cx="40" cy="57" rx="22" ry="3.6" fill="rgba(0,0,0,0.25)" />
      <g className="quest-art__drops" fill="#9fd3f0">
        <path d="M22 26c-2 3-2 5 0 5s2-2 0-5Z" />
        <path d="M58 22c-2 3-2 5 0 5s2-2 0-5Z" />
        <path d="M30 16c-2 3-2 5 0 5s2-2 0-5Z" />
      </g>
      <g className="quest-art__sprout">
        <path d="M40 55V34" stroke="#5e8f3e" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M40 40c-8-1-12-6-12-10 6 0 11 3 12 10Z" fill="#7fbf4f" />
        <path d="M40 36c7-1 11-6 11-10-6 0-10 3-11 10Z" fill="#8fcc5a" />
        <circle className="quest-art__crown" cx="40" cy="26" r="11" fill="#5f9d3d" />
      </g>
      <path d="M26 57c2-5 8-7 14-7s12 2 14 7Z" fill="#5b4330" />
    </>
  );
}

export function QuestArt({ kind, status }: { kind: QuestKind; status: QuestStatus }) {
  return (
    <svg viewBox="0 0 80 64" className={`quest-art quest-art--${kind} is-${status}`} aria-hidden="true" focusable="false">
      {kind === 'rocher' ? <Rocher /> : kind === 'tresor' ? <Tresor /> : <Pousse />}
    </svg>
  );
}
