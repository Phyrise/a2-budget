/**
 * Repli dessiné des compagnons tant que les sprites détourés (manifest
 * `companions`) sont absents : Jiji (AL), chat noir élancé aux yeux pâles,
 * et Calcifer (AC), flamme orange au large sourire rouge. SVG 64 × 64,
 * une expression par humeur.
 */
import { useId } from 'react';
import type { CompanionMood } from '../world/types';

/** Identifiant unique de dégradé par instance (évite les collisions d'id SVG). */
function useSvgId(): (name: string) => string {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (name) => `${name}-${base}`;
}

function JijiEyes({ mood }: { mood: CompanionMood }) {
  if (mood === 'sleepy') {
    return (
      <g className="cmp-eyes" stroke="#cfd8e6" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M20.5 35.5c2 1.6 4.6 1.6 6.6 0" />
        <path d="M36.9 35.5c2 1.6 4.6 1.6 6.6 0" />
      </g>
    );
  }
  if (mood === 'proud') {
    return (
      <g className="cmp-eyes" stroke="#eef4f2" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M20.4 34.6c1.9-2.6 5-2.6 6.9 0" />
        <path d="M36.7 34.6c1.9-2.6 5-2.6 6.9 0" />
      </g>
    );
  }
  const pupil = mood === 'curious' ? { dx: 0.4, dy: -2.2 } : mood === 'happy' ? { dx: 0, dy: 0 } : { dx: 1.3, dy: 0.3 };
  return (
    <g className="cmp-eyes">
      {mood === 'happy' ? (
        <path d="M20.2 34.2c2-2.4 5-2.4 7 0" stroke="#eef4f2" strokeWidth="2" strokeLinecap="round" fill="none" />
      ) : (
        <>
          <ellipse cx="23.8" cy="33.4" rx="5" ry={mood === 'curious' ? 6.4 : 5.8} fill="#e9f2ef" />
          <ellipse cx={23.8 + pupil.dx} cy={33.6 + pupil.dy} rx="1.9" ry="3" fill="#0b0a10" />
          <circle cx={22.6 + pupil.dx} cy={31.6 + pupil.dy} r="0.9" fill="#fff" />
        </>
      )}
      <ellipse cx="40.2" cy="33.4" rx="5" ry={mood === 'curious' ? 6.4 : 5.8} fill="#e9f2ef" />
      <ellipse cx={40.2 + pupil.dx} cy={33.6 + pupil.dy} rx="1.9" ry="3" fill="#0b0a10" />
      <circle cx={39 + pupil.dx} cy={31.6 + pupil.dy} r="0.9" fill="#fff" />
    </g>
  );
}

export function JijiArt({ mood }: { mood: CompanionMood }) {
  const id = useSvgId();
  const mouthOpen = mood === 'happy' || mood === 'proud';
  return (
    <svg viewBox="0 0 64 64" className="cmp-art cmp-art--jiji" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id('jiji-glow')} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#9a84d6" stopOpacity="0.7" />
          <stop offset="62%" stopColor="#6a58a0" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#5b4a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('jiji-fur')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#27222f" />
          <stop offset="100%" stopColor="#131019" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${id('jiji-glow')})`} />
      <g className="cmp-body">
        {/* Liseré de clair de lune derrière la silhouette (lisible sur fond sombre) */}
        <g fill="none" stroke="#b9a6ec" strokeOpacity="0.42" strokeWidth="2" strokeLinejoin="round">
          <path d="M17 64c0-11 6.6-17.4 15-17.4S47 53 47 64" />
          <path d="M13.6 31.4 16.8 5.8 30 20.2Z" />
          <path d="M50.4 31.4 47.2 5.8 34 20.2Z" />
          <ellipse cx="32" cy="34" rx="19.2" ry="15.6" />
        </g>
        {/* Corps */}
        <path d="M17 64c0-11 6.6-17.4 15-17.4S47 53 47 64Z" fill={`url(#${id('jiji-fur')})`} />
        {/* Oreilles */}
        <path d="M13.6 31.4 16.8 5.8 30 20.2Z" fill={`url(#${id('jiji-fur')})`} />
        <path d="M50.4 31.4 47.2 5.8 34 20.2Z" fill={`url(#${id('jiji-fur')})`} />
        <path d="M17.4 25 19 11.6l6.6 8.2Z" fill="#7e64a8" opacity="0.85" />
        <path d="M46.6 25 45 11.6l-6.6 8.2Z" fill="#7e64a8" opacity="0.85" />
        {/* Tête */}
        <ellipse cx="32" cy="34" rx="19.2" ry="15.6" fill={`url(#${id('jiji-fur')})`} />
        <path d="M14.6 30.8c1.6-7.4 8.6-12.4 17.4-12.4s15.8 5 17.4 12.4" stroke="#9c86cf" strokeOpacity="0.35" strokeWidth="0.9" fill="none" />
        <JijiEyes mood={mood} />
        {/* Nez + bouche */}
        <path d="M30.4 40.4h3.2L32 42.2Z" fill="#e07a8a" />
        {mouthOpen ? (
          <path d="M28.6 43.4c1.2 3.4 5.6 3.4 6.8 0Z" fill="#d9566e" stroke="#0b0a10" strokeWidth="0.6" />
        ) : mood === 'curious' ? (
          <ellipse cx="32" cy="44.8" rx="1.4" ry="1.6" fill="#d9566e" />
        ) : (
          <path d="M29.4 43.6c1 .9 2 .9 2.6 0 .6.9 1.6.9 2.6 0" stroke="#0b0a10" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        )}
        {/* Moustaches */}
        <g stroke="#cfd8e6" strokeOpacity="0.5" strokeWidth="0.6" strokeLinecap="round">
          <path d="M20 41.6 8.4 39.8M20.4 43.4 9 44.6" />
          <path d="M44 41.6 55.6 39.8M43.6 43.4 55 44.6" />
        </g>
      </g>
      {mood === 'sleepy' && (
        <g className="cmp-zz" fill="#cfd8e6" fontFamily="var(--font-display)" fontStyle="italic">
          <text x="50" y="16" fontSize="9">z</text>
          <text x="56" y="9" fontSize="6">z</text>
        </g>
      )}
    </svg>
  );
}

function CalciferEyes({ mood }: { mood: CompanionMood }) {
  if (mood === 'sleepy') {
    return (
      <g className="cmp-eyes" stroke="#2a0d06" strokeWidth="1.4" strokeLinecap="round">
        <path d="M20.6 39.6h7.4" fill="none" />
        <path d="M36 39.6h7.4" fill="none" />
        <path d="M21.4 39.6c1.6 1.4 4.2 1.4 5.8 0Z" fill="#fff6e8" />
        <path d="M36.8 39.6c1.6 1.4 4.2 1.4 5.8 0Z" fill="#fff6e8" />
      </g>
    );
  }
  const p = mood === 'curious' ? { dx: 0.6, dy: -2 } : mood === 'proud' ? { dx: 1.6, dy: -0.6 } : { dx: 0.4, dy: 0.4 };
  return (
    <g className="cmp-eyes" stroke="#2a0d06" strokeWidth="1.1">
      <circle cx="24.2" cy="37.6" r="4.6" fill="#fffaf0" />
      <circle cx="39.8" cy="37.6" r="4.6" fill="#fffaf0" />
      <circle cx={24.2 + p.dx} cy={37.6 + p.dy} r="1.7" fill="#1a0a05" stroke="none" />
      <circle cx={39.8 + p.dx} cy={37.6 + p.dy} r="1.7" fill="#1a0a05" stroke="none" />
      {mood === 'proud' && <path d="M19.2 31.6c2.4-1.6 6.2-1.6 9.6.8" fill="none" strokeWidth="1.5" strokeLinecap="round" />}
    </g>
  );
}

export function CalciferArt({ mood }: { mood: CompanionMood }) {
  const id = useSvgId();
  const mouth =
    mood === 'happy'
      ? 'M18.6 45.4c5.4-3.2 21.4-3.2 26.8 0-1.6 6.8-25.2 6.8-26.8 0Z'
      : mood === 'proud'
        ? 'M20.4 47.6c4.6-4.6 19-6.2 24.8-3.4-1.8 5.6-20.6 8.8-24.8 3.4Z'
        : mood === 'curious'
          ? 'M22.4 47.4c4-2.4 15.2-3 19.2-.6-1.2 3.6-17.4 4.4-19.2.6Z'
          : mood === 'sleepy'
            ? 'M20 46.2c5-2 19-2 24 0-1.2 3.4-22.6 3.4-24 0Z'
            : 'M19.6 46c5.2-2.6 19.6-2.6 24.8 0-1.4 4.4-23.4 4.4-24.8 0Z';
  return (
    <svg viewBox="0 0 64 64" className="cmp-art cmp-art--calcifer" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id('calcifer-glow')} cx="50%" cy="58%" r="52%">
          <stop offset="0%" stopColor="#ff8a3a" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#e2462a" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#e2462a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('calcifer-body')} cx="50%" cy="62%" r="62%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="45%" stopColor="#ffb043" />
          <stop offset="78%" stopColor="#f5762a" />
          <stop offset="100%" stopColor="#e2452a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="34" r="31" fill={`url(#${id('calcifer-glow')})`} />
      <g className="cmp-body">
        <path
          className="cmp-flame"
          d="M13 52.6c-5.2-7.4-3.6-15.6.6-20.4-.6 5 1.8 7.6 4.2 8-1.4-8.4 2.8-15.6 8.6-19.6-1 5.4.8 8.4 3.6 9.6-.6-8.4 3.6-15.6 1.6-25.4 7.6 6.6 11.4 15.4 9.6 23.6 2.6-1.4 4.4-4.6 4.4-8.6 5.4 6.4 7.6 14 5.8 20.6 2.4-1.2 3.6-3.8 3.6-7 3.6 7.6 3 15.6-2.6 21.2-6.6 6.6-33.4 6.4-39.4-2Z"
          fill={`url(#${id('calcifer-body')})`}
          stroke="#c2361f"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path d="M14.6 56.4c-2.2 1.4-3.6.8-4.4-.6M49.6 56.4c2.2 1.4 3.6.8 4.4-.6" stroke="#e2562a" strokeWidth="2" strokeLinecap="round" fill="none" />
        <CalciferEyes mood={mood} />
        <path d={mouth} fill="#d23a4a" stroke="#2a0d06" strokeWidth="1" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Kodama : petit esprit blanc de la forêt (personne / non assigné, états vides). */
export function KodamaArt({ glow = true }: { glow?: boolean }) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 64 64" className="cmp-art cmp-art--kodama" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id('kodama-glow')} cx="50%" cy="44%" r="50%">
          <stop offset="0%" stopColor="#e9f0e6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e9f0e6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glow && <circle cx="32" cy="30" r="30" fill={`url(#${id('kodama-glow')})`} />}
      <path d="M24.4 44c-1.6 6.4-1 12.2 2 15.4h11.2c3-3.2 3.6-9 2-15.4Z" fill="#dfe6da" />
      <path d="M26 52.6l-4.8 4.2M38 52.6l4.8 4.2" stroke="#dfe6da" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17.4 27.6c-.4-9.2 6.6-15.4 14.8-15.4 8.6 0 15 6.4 14.4 15.2-.4 8.6-6.6 15.6-14.8 15.6-8 0-14-6.8-14.4-15.4Z" fill="#eef3ea" />
      <ellipse cx="26.6" cy="27.8" rx="2.4" ry="2.8" fill="#1d241e" />
      <ellipse cx="37.6" cy="26.6" rx="2.2" ry="2.6" fill="#1d241e" />
      <ellipse cx="32.8" cy="35.2" rx="2.6" ry="2" fill="#1d241e" />
    </svg>
  );
}
