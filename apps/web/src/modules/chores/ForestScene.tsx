/**
 * Scène de forêt — la fenêtre sur le monde d'A² Home.
 *
 * Direction artistique : un petit sanctuaire forestier, ancien, mystérieux,
 * vivant. Une scène illustrée en couches (brume, lumière, profondeur,
 * feuillage au premier plan) qui donne l'impression de regarder à travers une
 * ouverture dans la forêt. Edge-to-edge : pas une carte.
 *
 * - Arbre central : ancien, asymétrique, enraciné. Vrai système de branches,
 *   racines qui s'écartent, canopée dense en masses de feuillage.
 * - 4 ambiances de vitalité distinctes (lumière, brume, densité) — jamais de
 *   nombre affiché.
 * - Créatures discrètes : un petit esprit à peine visible.
 * - L'événement rare du **gardien** : le monde change, une silhouette ancienne
 *   apparaît entre les troncs.
 *
 * Composant autonome : reçoit l'état de la forêt en props. Respecte
 * `prefers-reduced-motion`.
 */

import type { ForestState } from '@a2/core';
import { vitalityState } from '@a2/core';
import './chores.css';

export type Vitality = 'quiet' | 'peaceful' | 'lively' | 'flourishing';

/** Palette d'ambiance par état de vitalité. */
export const PALETTES: Record<
  Vitality,
  {
    skyTop: string;
    skyMid: string;
    skyLow: string;
    light: string;
    lightOpacity: number;
    distant: string;
    mist: string;
    midTrunk: string;
    canopyLit: string;
    canopyMid: string;
    canopyShadow: string;
    ground: string;
    groundDeep: string;
    particle: string;
    particleOpacity: number;
    mistAmount: number;
    saturation: number;
  }
> = {
  quiet: {
    skyTop: '#22332a',
    skyMid: '#42544a',
    skyLow: '#586a56',
    light: '#d6c78c',
    lightOpacity: 0.14,
    distant: '#39493f',
    mist: '#6a7c68',
    midTrunk: '#2e3f37',
    canopyLit: '#4a684e',
    canopyMid: '#385440',
    canopyShadow: '#263c2c',
    ground: '#243628',
    groundDeep: '#1a2a1e',
    particle: '#c6b676',
    particleOpacity: 0.4,
    mistAmount: 0.55,
    saturation: 0.8,
  },
  peaceful: {
    skyTop: '#283c30',
    skyMid: '#4c6050',
    skyLow: '#667a5e',
    light: '#e0cf98',
    lightOpacity: 0.22,
    distant: '#3e4f45',
    mist: '#74886c',
    midTrunk: '#33453c',
    canopyLit: '#567854',
    canopyMid: '#405c48',
    canopyShadow: '#2a4232',
    ground: '#2a3e2e',
    groundDeep: '#1e3022',
    particle: '#d2c282',
    particleOpacity: 0.55,
    mistAmount: 0.42,
    saturation: 0.9,
  },
  lively: {
    skyTop: '#2f4636',
    skyMid: '#587056',
    skyLow: '#748a64',
    light: '#ead79e',
    lightOpacity: 0.3,
    distant: '#445648',
    mist: '#7e9270',
    midTrunk: '#394c40',
    canopyLit: '#64885c',
    canopyMid: '#4a6a4e',
    canopyShadow: '#2e4836',
    ground: '#304632',
    groundDeep: '#223626',
    particle: '#decd8a',
    particleOpacity: 0.7,
    mistAmount: 0.3,
    saturation: 1.0,
  },
  flourishing: {
    skyTop: '#36503c',
    skyMid: '#627c58',
    skyLow: '#829868',
    light: '#f2e0a6',
    lightOpacity: 0.38,
    distant: '#4a5e50',
    mist: '#889c74',
    midTrunk: '#3f5346',
    canopyLit: '#729464',
    canopyMid: '#547652',
    canopyShadow: '#324c3a',
    ground: '#364e36',
    groundDeep: '#263c2a',
    particle: '#eacd90',
    particleOpacity: 0.85,
    mistAmount: 0.22,
    saturation: 1.06,
  },
};

/** Nombre de particules (lucioles) par état. */
export function particleCount(state: Vitality): number {
  switch (state) {
    case 'quiet':
      return 3;
    case 'peaceful':
      return 6;
    case 'lively':
      return 10;
    case 'flourishing':
      return 15;
    default:
      return 4;
  }
}

/** Position pseudo-aléatoire stable (déterministe). */
export function particleStyle(index: number, total: number): React.CSSProperties {
  const seed = (index * 53 + 17) % 100;
  const left = 8 + ((seed * 7) % 84);
  const top = 16 + ((seed * 13) % 56);
  const size = 2.5 + ((seed % 4) * 1.1);
  const delay = (index % total) * 0.5;
  const duration = 6 + (seed % 7);
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
 * Génère une masse de feuillage irrégulière (bords boursouflés, pas de blob
 * lisse). Déterministe (seed), pas de Math.random.
 */
function foliageMass(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const points = 9;
  const parts: string[] = [];
  for (let i = 0; i <= points; i++) {
    const idx = i % points;
    const angle = (idx / points) * Math.PI * 2;
    const wobble = 0.78 + (((seed * 7 + idx * 13) % 47) / 47) * 0.42;
    const x = cx + Math.cos(angle) * rx * wobble;
    const y = cy + Math.sin(angle) * ry * wobble;
    if (i === 0) {
      parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}`);
    } else {
      const midAngle = angle - Math.PI / points;
      const midWobble = 0.86 + (((seed * 11 + idx * 17) % 37) / 37) * 0.4;
      const midX = cx + Math.cos(midAngle) * rx * midWobble * 1.14;
      const midY = cy + Math.sin(midAngle) * ry * midWobble * 1.14;
      parts.push(`Q${midX.toFixed(1)} ${midY.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Arbre de la maison — ancien, asymétrique, lourd, enraciné.
 * Tronc noueux, branches lues dans la masse, canopée irrégulière en couches,
 * racines intégrées au sol, creux, mousse, texture d'écorce.
 */
function AncientTree({
  stage,
  vitality,
  p,
}: {
  stage: number;
  vitality: Vitality;
  p: (typeof PALETTES)[Vitality];
}) {
  const canopyScale =
    (0.88 + Math.min(stage, 6) * 0.04) *
    (vitality === 'flourishing' ? 1.08 : vitality === 'lively' ? 1.03 : vitality === 'peaceful' ? 1.0 : 0.96);
  const trunk = '#54402f';
  const trunkShadow = '#382a20';
  const trunkLit = '#75593f';
  const branch = '#463527';
  const moss = '#5f7a4a';

  return (
    <g className="forest-scene__tree-sway" style={{ filter: `saturate(${p.saturation})` }}>
      {/* Ombre de contact */}
      <ellipse cx="182" cy="288" rx="80" ry="10" fill={p.groundDeep} opacity="0.55" />

      {/* Racines intégrées au sol : système de racines qui émerge de la terre,
          avec doigts de racines et mousse. */}
      <path
        d="M176 266 C 160 268, 146 274, 136 288 C 146 282, 158 280, 168 280 C 174 280, 180 282, 186 284 C 192 282, 198 280, 208 280 C 218 280, 230 282, 240 288 C 230 274, 216 268, 202 266 C 194 264, 184 264, 176 266 Z"
        fill={trunk}
      />
      {/* Doigts de racines (plus fins, s'écartent) */}
      <g stroke={trunk} strokeLinecap="round" fill="none">
        <path d="M168 278 C 158 280, 150 284, 144 290" strokeWidth="6" />
        <path d="M208 278 C 218 280, 226 284, 232 290" strokeWidth="6" />
        <path d="M182 282 C 178 288, 176 294, 174 300" strokeWidth="5" />
      </g>
      {/* Ombre sous les racines (ancrage au sol) */}
      <path d="M140 288 C 160 282, 216 282, 236 288 C 216 292, 160 292, 140 288 Z" fill={p.groundDeep} opacity="0.5" />
      {/* Mousse sur les racines */}
      <path d="M150 284 C 162 280, 174 280, 182 282 C 172 284, 160 286, 150 284 Z" fill={moss} opacity="0.5" />
      <path d="M196 284 C 208 280, 220 280, 228 284 C 218 286, 206 286, 196 284 Z" fill={moss} opacity="0.45" />

      {/* Tronc noueux (penché, torsadé) */}
      <path
        d="M174 286 C 170 254, 178 224, 186 200 C 190 188, 192 180, 194 172 C 198 180, 200 190, 202 202 C 208 228, 208 258, 202 286 C 194 280, 184 280, 174 286 Z"
        fill={trunk}
      />
      {/* Côté ombré (gauche) */}
      <path
        d="M174 286 C 170 254, 178 224, 186 200 C 188 192, 190 184, 192 176 C 190 188, 188 200, 188 214 C 186 244, 186 266, 188 286 C 184 282, 179 284, 174 286 Z"
        fill={trunkShadow}
        opacity="0.7"
      />
      {/* Côté éclairé (droite) */}
      <path
        d="M202 202 C 208 228, 208 258, 202 286 C 200 264, 199 242, 197 220 C 196 210, 198 206, 202 202 Z"
        fill={trunkLit}
        opacity="0.5"
      />
      {/* Texture d'écorce (lignes verticales discrètes) */}
      <g stroke={trunkShadow} strokeWidth="1.2" opacity="0.35" fill="none">
        <path d="M180 270 C 179 250, 180 230, 183 210" />
        <path d="M192 272 C 193 252, 193 232, 191 212" />
      </g>
      {/* Creux (ouverture sombre) */}
      <path d="M184 252 C 182 242, 186 234, 192 236 C 196 242, 194 254, 190 260 C 186 258, 184 254, 184 252 Z" fill="#221a14" opacity="0.85" />
      {/* Mousse sur le tronc */}
      <path d="M176 238 C 180 232, 186 232, 188 238 C 184 240, 180 240, 176 238 Z" fill={moss} opacity="0.45" />
      <path d="M190 214 C 194 210, 198 212, 198 218 C 194 220, 190 218, 190 214 Z" fill={moss} opacity="0.4" />

      {/* Branches (strokes arrondis, asymétriques, bien visibles) */}
      <g stroke={branch} strokeLinecap="round" fill="none">
        <path d="M188 184 C 208 172, 234 162, 262 154" strokeWidth="12" />
        <path d="M186 200 C 168 194, 146 192, 122 194" strokeWidth="11" />
        <path d="M188 178 C 198 162, 210 148, 224 136" strokeWidth="10" />
        {/* Sous-branches */}
        <path d="M240 160 C 254 154, 268 150, 282 148" strokeWidth="6" />
        <path d="M150 194 C 138 190, 126 190, 114 192" strokeWidth="5" />
        <path d="M212 150 C 222 142, 232 136, 244 132" strokeWidth="5" />
        <path d="M256 156 C 266 160, 276 164, 286 170" strokeWidth="5" />
      </g>

      {/* Canopée : masses irrégulières (pas de blob), asymétriques, en couches
          ombre → milieu → lumière. Les branches restent lues dans la masse. */}
      <g className="forest-scene__canopy" style={{ transform: `scale(${canopyScale})`, transformOrigin: '188px 158px' }}>
        {/* Couche d'ombre (profondeur, plus large) */}
        <g fill={p.canopyShadow}>
          <path d={foliageMass(258, 152, 40, 30, 3)} />
          <path d={foliageMass(216, 130, 36, 28, 7)} />
          <path d={foliageMass(128, 186, 34, 26, 11)} />
          <path d={foliageMass(188, 152, 44, 32, 5)} />
          <path d={foliageMass(286, 168, 26, 20, 13)} />
        </g>
        {/* Couche intermédiaire */}
        <g fill={p.canopyMid}>
          <path d={foliageMass(254, 146, 36, 27, 17)} />
          <path d={foliageMass(214, 124, 32, 25, 19)} />
          <path d={foliageMass(126, 180, 30, 23, 23)} />
          <path d={foliageMass(190, 146, 40, 29, 29)} />
          <path d={foliageMass(282, 162, 22, 17, 31)} />
          <path d={foliageMass(236, 152, 26, 20, 37)} />
        </g>
        {/* Couche éclairée (haut, vers la lumière) */}
        <g fill={p.canopyLit}>
          <path d={foliageMass(250, 138, 30, 22, 41)} />
          <path d={foliageMass(212, 118, 28, 20, 43)} />
          <path d={foliageMass(124, 174, 26, 19, 47)} />
          <path d={foliageMass(192, 138, 34, 24, 53)} />
          <path d={foliageMass(278, 156, 18, 14, 59)} />
        </g>
        {/* Hautes lumières (taches de lumière, irrégulières, discrètes) */}
        <g fill={p.light}>
          <path d={foliageMass(228, 116, 6, 4, 61)} opacity="0.32" />
          <path d={foliageMass(252, 132, 5, 4, 67)} opacity="0.28" />
          <path d={foliageMass(196, 128, 5, 4, 71)} opacity="0.3" />
        </g>
      </g>

      {/* Branches par-dessus la canopée (lisibles dans la masse du feuillage) */}
      <g stroke={branch} strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M188 184 C 208 172, 234 162, 262 154" strokeWidth="9" />
        <path d="M186 200 C 168 194, 146 192, 122 194" strokeWidth="8" />
        <path d="M188 178 C 198 162, 210 148, 224 136" strokeWidth="7" />
        <path d="M240 160 C 254 154, 268 150, 282 148" strokeWidth="4.5" />
        <path d="M212 150 C 222 142, 232 136, 244 132" strokeWidth="4" />
      </g>

      {/* Fleurs (stade ≥ 4) — discrètes */}
      {stage >= 4 && (
        <g className="forest-scene__flowers">
          <Blossom x={176} y={132} />
          <Blossom x={214} y={124} />
          <Blossom x={240} y={144} />
          <Blossom x={196} y={140} />
        </g>
      )}
    </g>
  );
}

/** Petite fleur à 5 pétales (discrète). */
function Blossom({ x, y }: { x: number; y: number }) {
  const petal = '#e8c8d4';
  const center = '#f4e8d0';
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.8">
      <circle cx="0" cy="-3" r="2.4" fill={petal} />
      <circle cx="2.8" cy="-0.8" r="2.4" fill={petal} />
      <circle cx="1.7" cy="2.4" r="2.4" fill={petal} />
      <circle cx="-1.7" cy="2.4" r="2.4" fill={petal} />
      <circle cx="-2.8" cy="-0.8" r="2.4" fill={petal} />
      <circle cx="0" cy="0" r="1.8" fill={center} />
    </g>
  );
}

/** Petit esprit — à peine visible, adouci (flou, ombre, brume), pas un sticker. */
function HiddenSpirit({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <g className="forest-scene__spirit" transform="translate(256 250)" opacity="0.5">
      {/* Ombre au sol (ancrage) */}
      <ellipse cx="0" cy="9" rx="6" ry="2" fill="#1a2a1e" opacity="0.4" />
      {/* Corps adouci (flou) */}
      <g filter="url(#fs-soft)">
        <ellipse cx="0" cy="0" rx="6" ry="7" fill="#e8ead8" opacity="0.7" />
      </g>
      {/* Yeux discrets */}
      <circle cx="-2" cy="-2" r="1" fill="#3a4a3a" opacity="0.7" />
      <circle cx="2" cy="-2" r="1" fill="#3a4a3a" opacity="0.7" />
      {/* Filet de brume autour */}
      <ellipse cx="0" cy="2" rx="10" ry="6" fill="#c8d4bc" opacity="0.18" />
    </g>
  );
}

/** Gardien — silhouette ancienne entre les troncs. */
function Guardian() {
  return (
    <g className="forest-scene__guardian">
      <ellipse cx="188" cy="150" rx="92" ry="112" fill="#f0e6c0" opacity="0.26" />
      <ellipse cx="188" cy="150" rx="60" ry="80" fill="#f6efd6" opacity="0.22" />
      <path
        d="M176 212 C 172 180, 178 156, 188 148 C 198 156, 204 180, 200 212 C 192 216, 184 216, 176 212 Z"
        fill="#e8e0c8"
        opacity="0.9"
      />
      <path d="M182 148 C 180 138, 184 130, 188 128 C 192 130, 196 138, 194 148 C 190 152, 186 152, 182 148 Z" fill="#efe8d2" opacity="0.92" />
      <path
        d="M184 128 C 182 118, 186 110, 190 106 M192 128 C 194 118, 190 110, 186 106 M186 122 C 180 118, 178 110, 180 104 M190 122 C 196 118, 198 110, 196 104"
        stroke="#c8b878"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </g>
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
  const p = PALETTES[state];
  const particles = particleCount(state);
  const showSpirit = forest.unlockedCreatureIds.length > 0 && state !== 'quiet';

  return (
    <div
      className={`forest-scene forest-scene--${state} ${showGuardian ? 'is-guardian' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Forêt ${forest.paused ? 'endormie' : state === 'quiet' ? 'apaisée' : state === 'peaceful' ? 'paisible' : state === 'lively' ? 'vivante' : 'en pleine floraison'}`}
    >
      <svg className="forest-scene__svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.skyTop} />
            <stop offset="44%" stopColor={p.skyMid} />
            <stop offset="100%" stopColor={p.skyLow} />
          </linearGradient>
          <radialGradient id="fs-light" cx="52%" cy="16%" r="62%">
            <stop offset="0%" stopColor={p.light} stopOpacity={p.lightOpacity} />
            <stop offset="55%" stopColor={p.light} stopOpacity={p.lightOpacity * 0.4} />
            <stop offset="100%" stopColor={p.light} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fs-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.ground} />
            <stop offset="100%" stopColor={p.groundDeep} />
          </linearGradient>
          <linearGradient id="fs-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.mist} stopOpacity="0" />
            <stop offset="50%" stopColor={p.mist} stopOpacity={p.mistAmount * 0.5} />
            <stop offset="100%" stopColor={p.mist} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="fs-vignette" cx="50%" cy="44%" r="74%">
            <stop offset="56%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#0a1410" stopOpacity="0.46" />
          </radialGradient>
          <filter id="fs-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>

        {/* Ciel / atmosphère */}
        <rect x="0" y="0" width="400" height="300" fill="url(#fs-sky)" />
        <rect x="0" y="0" width="400" height="300" fill="url(#fs-light)" />

        {/* Forêt lointaine (brume, profondeur) — douce, floue */}
        <g opacity={0.55}>
          <rect x="0" y="118" width="400" height="92" fill={p.distant} opacity="0.45" />
          {[24, 58, 92, 128, 268, 306, 344, 378].map((x, i) => (
            <path
              key={i}
              d={`M${x} ${108 + (i % 3) * 6} C ${x + 2} ${150}, ${x - 1} ${200}, ${x + 1} ${210} L ${x + 6} ${210} C ${x + 5} ${200}, ${x + 7} ${150}, ${x + 5} ${108 + (i % 3) * 6} Z`}
              fill={p.distant}
              opacity="0.5"
            />
          ))}
          <ellipse cx="50" cy="128" rx="52" ry="34" fill={p.distant} opacity="0.45" />
          <ellipse cx="350" cy="124" rx="56" ry="36" fill={p.distant} opacity="0.45" />
          <ellipse cx="200" cy="120" rx="70" ry="30" fill={p.distant} opacity="0.35" />
        </g>

        {/* Brume (bande horizontale douce) */}
        <rect x="0" y="150" width="400" height="70" fill="url(#fs-mist)" />

        {/* Rayons de lumière (doux, étroits, en dégradé) */}
        <g opacity={p.lightOpacity * 0.42}>
          <path d="M158 0 L176 0 L120 200 L104 200 Z" fill={p.light} />
          <path d="M236 0 L250 0 L214 190 L202 190 Z" fill={p.light} opacity="0.6" />
        </g>

        {/* Sol mousseux */}
        <path d="M0 250 C 80 240, 160 246, 240 244 C 320 242, 380 248, 400 252 L 400 300 L 0 300 Z" fill="url(#fs-ground)" />
        <path d="M0 262 C 90 254, 180 258, 270 256 C 340 254, 380 258, 400 262 L 400 300 L 0 300 Z" fill={p.groundDeep} opacity="0.5" />

        {/* Arbre central */}
        <AncientTree stage={forest.growthStage} vitality={state} p={p} />

        {/* Brume devant l'arbre (profondeur : la brume traverse la scène) */}
        <rect x="0" y="176" width="400" height="64" fill="url(#fs-mist)" opacity="0.75" />

        {/* Esprit caché */}
        <HiddenSpirit visible={showSpirit} />

        {/* Feuillage au premier plan (casse le cadre) */}
        <g opacity="0.92">
          <path d="M0 300 C 10 268, 26 256, 44 250 C 32 268, 28 284, 30 300 Z" fill={p.groundDeep} />
          <path d="M400 300 C 390 266, 374 254, 356 248 C 368 266, 372 284, 370 300 Z" fill={p.groundDeep} />
          <path d="M0 300 C 18 280, 38 274, 58 272 C 42 286, 32 294, 32 300 Z" fill={p.canopyShadow} opacity="0.7" />
          <path d="M400 300 C 382 278, 362 272, 342 270 C 358 284, 368 294, 368 300 Z" fill={p.canopyShadow} opacity="0.7" />
        </g>

        {/* Vignette (cadre doux) */}
        <rect x="0" y="0" width="400" height="300" fill="url(#fs-vignette)" />

        {/* Gardien (événement rare) */}
        {showGuardian && <Guardian />}
      </svg>

      {/* Particules (lucioles) */}
      <div className="forest-scene__particles" aria-hidden="true">
        {Array.from({ length: particles }).map((_, i) => (
          <span key={i} className="forest-scene__particle" style={particleStyle(i, particles)} />
        ))}
      </div>

      {forest.paused && <div className="forest-scene__pause" aria-hidden="true" />}
    </div>
  );
}
