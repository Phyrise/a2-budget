/**
 * Scène de forêt — l'ancrage visuel d'A² Home.
 *
 * La forêt est une **représentation vivante** du soin apporté au foyer :
 * - 4 états de vitalité visuellement distincts (quiet / peaceful / lively /
 *   flourishing) — jamais de nombre affiché.
 * - La croissance (stade) fait apparaître des créatures et de l'environnement.
 * - L'événement rare du **gardien** (esprit forestier original) apparaît en
 *   fond, brièvement, sans copier aucun personnage Ghibli.
 *
 * Composant autonome : reçoit l'état de la forêt en props, ne dépend ni du
 * store ni de la coquille. Respecte `prefers-reduced-motion`.
 */

import type { ForestState } from '@a2/core';
import { vitalityState } from '@a2/core';
import './chores.css';

/** Nombre de particules ambiantes par état (densité, pas de score). */
function particleCount(state: string): number {
  switch (state) {
    case 'quiet':
      return 4;
    case 'peaceful':
      return 8;
    case 'lively':
      return 13;
    case 'flourishing':
      return 18;
    default:
      return 4;
  }
}

/** Position pseudo-aléatoire stable (déterministe, pas de Math.random). */
function particleStyle(index: number, total: number): React.CSSProperties {
  const seed = (index * 37 + 11) % 100;
  const left = 6 + ((seed * 7) % 88);
  const top = 18 + ((seed * 13) % 60);
  const size = 3 + ((seed % 4) * 1.5);
  const delay = (index % total) * 0.35;
  const duration = 5 + (seed % 5);
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
 * Arbre de la maison : sa canopée reflète la croissance permanente (stade)
 * ET la vitalité court terme (état) — plus la forêt vit, plus la canopée est
 * pleine et lumineuse. C'est ce qui rend les 4 états distincts même si le
 * fond est squinté.
 */
function HomeTree({ stage, vitality }: { stage: number; vitality: string }) {
  const boost =
    vitality === 'flourishing' ? 1.2 : vitality === 'lively' ? 1.1 : vitality === 'peaceful' ? 1.03 : 0.94;
  const canopy = Math.min(120, (44 + stage * 9) * boost);
  const leaf =
    vitality === 'flourishing' ? '#5f9a52' : vitality === 'lively' ? '#578a4c' : vitality === 'peaceful' ? '#4f7a4a' : '#476b44';
  const leafLight =
    vitality === 'flourishing' ? '#74ab63' : vitality === 'lively' ? '#6a9a57' : vitality === 'peaceful' ? '#5c8a54' : '#527a4c';
  return (
    <svg
      className="forest-scene__tree"
      viewBox="0 0 200 220"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Tronc */}
      <path
        d="M96 210c2-40-4-70-6-96 14 10 22 10 36 0-2 26-8 56-6 96Z"
        fill="#6b4a34"
      />
      {/* Racines */}
      <path d="M70 210c10-8 22-8 30 0M100 210c8-8 20-8 30 0" stroke="#6b4a34" strokeWidth="5" strokeLinecap="round" />
      {/* Canopée (taille liée au stade + vitalité) */}
      <g className="forest-scene__canopy">
        <ellipse cx="100" cy="92" rx={canopy * 0.62} ry={canopy * 0.5} fill={leaf} />
        <ellipse cx="72" cy="104" rx={canopy * 0.4} ry={canopy * 0.34} fill={leafLight} />
        <ellipse cx="128" cy="104" rx={canopy * 0.4} ry={canopy * 0.34} fill={leafLight} />
        <ellipse cx="100" cy="70" rx={canopy * 0.42} ry={canopy * 0.36} fill={leafLight} />
      </g>
      {/* Fleurs (stade ≥ 4) */}
      {stage >= 4 && (
        <g className="forest-scene__flowers">
          <circle cx="78" cy="86" r="3.4" fill="#e7b8c8" />
          <circle cx="120" cy="98" r="3.4" fill="#e7b8c8" />
          <circle cx="100" cy="64" r="3.4" fill="#f0cdd8" />
        </g>
      )}
    </svg>
  );
}

/** Créature originale (petit esprit de mousse / graine / feuille). */
function Creature({ id, index }: { id: string; index: number }) {
  const left = 14 + ((index * 23) % 70);
  const bottom = 10 + ((index * 17) % 22);
  const hue = id === 'ember-wisp' ? '#e0a458' : id === 'water-drip' ? '#6fa8c9' : '#8fb573';
  return (
    <span
      className="forest-scene__creature"
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <ellipse cx="12" cy="14" rx="7" ry="6" fill={hue} opacity="0.9" />
        <circle cx="9.5" cy="13" r="1.4" fill="#263e30" />
        <circle cx="14.5" cy="13" r="1.4" fill="#263e30" />
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
      <circle cx="110" cy="96" r="70" fill="#f4ecd4" opacity="0.28" />
      {/* Corps */}
      <path
        d="M78 150c-6-30 4-58 20-70 6 10 14 12 24 8 16 12 26 40 20 70-14 8-30 8-44 0Z"
        fill="#e9e2c8"
        opacity="0.92"
      />
      {/* Tête + bois de cerf */}
      <path d="M96 78c-4-12 2-22 12-24 10 2 16 12 12 24-6 6-18 6-24 0Z" fill="#efe8d2" />
      <path
        d="M104 52c-2-10 2-18 8-22M116 52c2-10-2-18-8-22M100 44c-6-4-8-12-6-18M120 44c6-4 8-12 6-18"
        stroke="#a89a6a"
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
}: {
  forest: ForestState;
  className?: string;
}) {
  const state = vitalityState(forest.vitality);
  const guardianActive = forest.lastRareEvent === 'guardian';
  const particles = particleCount(state);
  const creatures = forest.unlockedCreatureIds.slice(0, 4);

  return (
    <div
      className={`forest-scene forest-scene--${state} ${guardianActive ? 'is-guardian' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Forêt ${state === 'quiet' ? 'apaisée' : state === 'peaceful' ? 'paisible' : state === 'lively' ? 'vivante' : 'en pleine floraison'}`}
    >
      <div className="forest-scene__sky" aria-hidden="true" />
      <div className="forest-scene__ground" aria-hidden="true" />
      <div className="forest-scene__particles" aria-hidden="true">
        {Array.from({ length: particles }).map((_, i) => (
          <span key={i} className="forest-scene__particle" style={particleStyle(i, particles)} />
        ))}
      </div>
      {guardianActive && <Guardian />}
      <HomeTree stage={forest.growthStage} vitality={state} />
      {creatures.map((id, i) => (
        <Creature key={id} id={id} index={i} />
      ))}
      {forest.paused && <div className="forest-scene__pause" aria-hidden="true" />}
    </div>
  );
}
