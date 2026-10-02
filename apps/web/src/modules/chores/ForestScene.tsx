/**
 * Scène de forêt — l'ancrage visuel d'A² Home.
 *
 * Une illustration soignée et vivante (pas un sprite plat) :
 * - Ciel en dégradé avec un halo de soleil doux.
 * - Arbre de la maison : tronc avec branches, canopée en **couches** (profondeur,
 *   hautes lumières), qui s'anime doucement (balancement) et s'étoffe avec la
 *   croissance + la vitalité.
 * - Sol avec herbe, particules (feuilles / lucioles), petites créatures.
 * - 4 états de vitalité distincts (couleurs, densité, luminosité) — jamais de
 *   nombre affiché. Même l'état « quiet » reste beau et apaisé.
 * - L'événement rare du **gardien** (esprit forestier original, pas Ghibli).
 *
 * Composant autonome : reçoit l'état de la forêt en props. Respecte
 * `prefers-reduced-motion`.
 */

import type { ForestState } from '@a2/core';
import { vitalityState } from '@a2/core';
import './chores.css';

type Vitality = 'quiet' | 'peaceful' | 'lively' | 'flourishing';

/** Nombre de particules ambiantes par état (densité, pas de score). */
function particleCount(state: Vitality): number {
  switch (state) {
    case 'quiet':
      return 2;
    case 'peaceful':
      return 7;
    case 'lively':
      return 13;
    case 'flourishing':
      return 19;
    default:
      return 4;
  }
}

/** Position pseudo-aléatoire stable (déterministe, pas de Math.random). */
function particleStyle(index: number, total: number): React.CSSProperties {
  const seed = (index * 37 + 11) % 100;
  const left = 5 + ((seed * 7) % 90);
  const top = 12 + ((seed * 13) % 66);
  const size = 3 + ((seed % 4) * 1.6);
  const delay = (index % total) * 0.4;
  const duration = 5 + (seed % 6);
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
  };
}

/**
 * Arbre de la maison — illustration soignée.
 * Canopée en couches (arrière sombre → avant lumineux) pour la profondeur,
 * tronc avec branches, hautes lumières. La taille et la luminosité suivent la
 * croissance (stade) et la vitalité (état).
 */
function HomeTree({ stage, vitality }: { stage: number; vitality: Vitality }) {
  // La canopée s'étoffe avec le stade (permanent) et la vitalité (court terme).
  const scale =
    (0.8 + Math.min(stage, 6) * 0.05) *
    (vitality === 'flourishing' ? 1.12 : vitality === 'lively' ? 1.05 : vitality === 'peaceful' ? 1.0 : 0.95);
  const glow =
    vitality === 'flourishing' ? 1.22 : vitality === 'lively' ? 1.08 : vitality === 'peaceful' ? 1.0 : 0.94;

  // Palette : un vrai éclairage (source en haut à droite, côté du soleil).
  const lit = vitality === 'quiet' ? '#93c46e' : '#98c972';
  const mid = vitality === 'quiet' ? '#63a051' : '#66a253';
  const shade = vitality === 'quiet' ? '#447a46' : '#467c48';
  const deep = vitality === 'quiet' ? '#3a6a3e' : '#3c6c40';
  const trunk = '#8a6a4e';
  const trunkDark = '#6d5240';

  return (
    <svg
      className="forest-scene__tree"
      viewBox="0 0 220 250"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Éclairage de la canopée : lumineux en haut à droite, ombragé en bas à gauche */}
        <radialGradient id="canopyGrad" cx="78%" cy="20%" r="92%">
          <stop offset="0%" stopColor={lit} />
          <stop offset="40%" stopColor={mid} />
          <stop offset="100%" stopColor={shade} />
        </radialGradient>
      </defs>

      {/* Ombre de contact projetée vers la gauche (source soleil à droite) */}
      <ellipse cx="86" cy="245" rx="60" ry="7" fill={deep} opacity="0.3" />

      <g className="forest-scene__tree-sway" style={{ filter: `saturate(${glow})` }}>
        {/* Tronc (cylindre : gauche sombre / droite claire, évasement à la base) */}
        <path d="M94 246 C 90 216, 92 192, 99 168 C 101 158, 119 158, 121 168 C 128 192, 130 216, 126 246 Z" fill={trunk} />
        <path d="M94 246 C 90 216, 92 192, 99 168 C 100 162, 104 159, 110 159 C 106 192, 106 216, 108 246 Z" fill={trunkDark} opacity="0.5" />
        {/* Évasement des racines (doux) */}
        <path d="M92 246 C 100 240, 120 240, 128 246" stroke={trunk} strokeWidth="6" strokeLinecap="round" fill="none" />

        {/* Canopée lobée (nuage) + dégradé d'éclairage (échelle stade + vitalité) */}
        <g className="forest-scene__canopy" style={{ transform: `scale(${scale})`, transformOrigin: '110px 150px' }}>
          <path
            d="M110 28 C 134 26, 152 38, 154 56 C 172 54, 186 72, 178 90 C 190 102, 184 124, 166 128 C 168 146, 148 156, 132 148 C 124 160, 100 160, 92 148 C 76 156, 56 146, 58 128 C 40 124, 34 102, 46 90 C 38 72, 52 54, 70 56 C 72 38, 90 26, 110 28 Z"
            fill="url(#canopyGrad)"
          />
          {/* Rim light chaud, large (côté soleil, droite) */}
          <path d="M146 44 C 170 56, 180 88, 172 116 C 184 92, 180 58, 156 42 Z" fill="#f4e8ac" opacity="0.6" />
          {/* Ombre froide désaturée (tiers gauche de la canopée) */}
          <path d="M64 52 C 46 70, 44 104, 60 128 C 40 104, 42 68, 64 52 Z" fill="#4a6b52" opacity="0.45" />
          {/* Masses d'ombre douces (bas-gauche, profondeur) */}
          <ellipse cx="86" cy="118" rx="26" ry="16" fill={deep} opacity="0.3" />
          <ellipse cx="108" cy="132" rx="22" ry="13" fill={deep} opacity="0.25" />
          {/* Groupes de feuilles lumineux (haut-droite) */}
          <circle cx="130" cy="56" r="5" fill={lit} opacity="0.7" />
          <circle cx="148" cy="80" r="4.4" fill={lit} opacity="0.55" />
          <circle cx="118" cy="42" r="4" fill={lit} opacity="0.65" />
        </g>

        {/* Fleurs (stade ≥ 4) — vraies fleurs à 5 pétales, saturées */}
        {stage >= 4 && (
          <g className="forest-scene__flowers">
            <Blossom x={90} y={68} />
            <Blossom x={140} y={86} />
            <Blossom x={112} y={46} />
            <Blossom x={104} y={102} />
            <Blossom x={126} y={112} />
          </g>
        )}
      </g>
    </svg>
  );
}

/** Petite fleur à 5 pétales (saturée, lisible). */
function Blossom({ x, y }: { x: number; y: number }) {
  const petal = '#f2b8cc';
  const center = '#fff2f7';
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="-3.4" r="2.8" fill={petal} />
      <circle cx="3.2" cy="-1" r="2.8" fill={petal} />
      <circle cx="2" cy="2.8" r="2.8" fill={petal} />
      <circle cx="-2" cy="2.8" r="2.8" fill={petal} />
      <circle cx="-3.2" cy="-1" r="2.8" fill={petal} />
      <circle cx="0" cy="0" r="2.2" fill={center} />
    </g>
  );
}

/** Créature originale (petit esprit de mousse / graine / feuille). */
function Creature({ id, index }: { id: string; index: number }) {
  const left = 12 + ((index * 23) % 72);
  const bottom = 8 + ((index * 17) % 20);
  const hue = id === 'ember-wisp' ? '#e0a458' : id === 'water-drip' ? '#6fa8c9' : '#8fb573';
  return (
    <span
      className="forest-scene__creature"
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <ellipse cx="12" cy="14" rx="7.5" ry="6.5" fill={hue} opacity="0.92" />
        <circle cx="9.5" cy="13" r="1.5" fill="#263e30" />
        <circle cx="14.5" cy="13" r="1.5" fill="#263e30" />
        <path d="M8 8c1-2 3-2 4 0M12 8c1-2 3-2 4 0" stroke={hue} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * Gardien de la forêt — esprit mythique original (folklore animiste, énergie
 * de cerf ancien). Apparaît en fond, lentement, lors de l'événement rare.
 */
function Guardian() {
  return (
    <svg
      className="forest-scene__guardian"
      viewBox="0 0 220 200"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Halo de lumière */}
      <circle cx="110" cy="96" r="72" fill="#f6efd6" opacity="0.34" />
      <circle cx="110" cy="96" r="52" fill="#fbf6e4" opacity="0.3" />
      {/* Corps */}
      <path
        d="M78 152c-6-32 4-60 20-72 6 10 14 12 24 8 16 12 26 42 20 72-14 8-30 8-44 0Z"
        fill="#ece5cd"
        opacity="0.94"
      />
      {/* Tête + bois de cerf */}
      <path d="M96 78c-4-12 2-22 12-24 10 2 16 12 12 24-6 6-18 6-24 0Z" fill="#f2ebd6" />
      <path
        d="M104 52c-2-10 2-18 8-22M116 52c2-10-2-18-8-22M100 44c-6-4-8-12-6-18M120 44c6-4 8-12 6-18"
        stroke="#b3a470"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* Yeux sereins */}
      <circle cx="104" cy="70" r="2.4" fill="#3a4a3a" />
      <circle cx="116" cy="70" r="2.4" fill="#3a4a3a" />
    </svg>
  );
}

export function ForestScene({
  forest,
  className = '',
  showGuardian = false,
}: {
  forest: ForestState;
  className?: string;
  showGuardian?: boolean;
}) {
  const state = vitalityState(forest.vitality) as Vitality;
  const particles = particleCount(state);
  const creatures = forest.unlockedCreatureIds.slice(0, 4);

  return (
    <div
      className={`forest-scene forest-scene--${state} ${showGuardian ? 'is-guardian' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Forêt ${forest.paused ? 'endormie' : state === 'quiet' ? 'apaisée' : state === 'peaceful' ? 'paisible' : state === 'lively' ? 'vivante' : 'en pleine floraison'}`}
    >
      <div className="forest-scene__sky" aria-hidden="true">
        <div className="forest-scene__sun" />
      </div>
      <svg className="forest-scene__hills" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 120 L0 70 Q 90 30 180 66 Q 250 92 320 60 Q 360 44 400 64 L400 120 Z" fill="currentColor" opacity="0.5" />
        <path d="M0 120 L0 92 Q 120 60 220 88 Q 300 108 400 84 L400 120 Z" fill="currentColor" opacity="0.7" />
      </svg>
      <div className="forest-scene__ground" aria-hidden="true">
        <svg className="forest-scene__grass" viewBox="0 0 400 44" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 44 L0 26 Q 12 12 24 26 T 48 26 T 72 26 T 96 26 T 120 26 T 144 26 T 168 26 T 192 26 T 216 26 T 240 26 T 264 26 T 288 26 T 312 26 T 336 26 T 360 26 T 384 26 T 400 26 L400 44 Z" fill="currentColor" opacity="0.75" />
        </svg>
      </div>
      <div className="forest-scene__particles" aria-hidden="true">
        {Array.from({ length: particles }).map((_, i) => (
          <span key={i} className="forest-scene__particle" style={particleStyle(i, particles)} />
        ))}
      </div>
      {showGuardian && <div className="forest-scene__aura" aria-hidden="true" />}
      <HomeTree stage={forest.growthStage} vitality={state} />
      {showGuardian && <Guardian />}
      {creatures.map((id, i) => (
        <Creature key={id} id={id} index={i} />
      ))}
      {forest.paused && <div className="forest-scene__pause" aria-hidden="true" />}
    </div>
  );
}
