/**
 * Les compagnons en fête (V4.3), dessinés en SVG autour de leur sprite :
 * - Jiji coiffé d'un petit chapeau pointu à rayures lilas et or, pompon
 *   crème, posé de travers entre ses oreilles ;
 * - Calcifer assis sur un gâteau à la crème, deux bougies qui vacillent de
 *   chaque côté : c'est lui, la grande flamme ;
 * - V5.6 : Teto (entre ses grandes oreilles) et Hin (sur sa tête basse, à
 *   droite) reçoivent le même chapeau, posé à leur place (party.css).
 * La fête d'une personne montre SON compagnon (choisi dans les Réglages).
 * Sprites détourés du manifest (mêmes images que <Companion>), repli dessiné
 * sinon. Toujours décoratif : le texte est porté par le parent.
 */
import { useId } from 'react';
import type { CompanionId } from '@a2/core';
import { CompanionFigure, companionSprite } from '../../ui/Companion';
import { useCompanionId } from '../../ui/companions';

function useSvgId(): (name: string) => string {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (name) => `${name}-${base}`;
}

function PartyHat() {
  const id = useSvgId();
  return (
    <svg className="party-hat" viewBox="0 0 40 54" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={id('cone')}>
          <path d="M20 4 35.5 47 4.5 47Z" />
        </clipPath>
        <linearGradient id={id('shade')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#120c22" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id('cone')})`}>
        <rect x="0" y="0" width="40" height="54" fill="#8d7bd8" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M-10 ${14 + i * 10}l60 -16v6l-60 16Z`} fill="#f2c45e" />
        ))}
        <circle cx="15" cy="34" r="1.6" fill="#fff6dc" />
        <circle cx="25" cy="25" r="1.3" fill="#fff6dc" />
        <circle cx="23" cy="41" r="1.5" fill="#fff6dc" />
        <rect x="0" y="0" width="40" height="54" fill={`url(#${id('shade')})`} />
      </g>
      <path d="M3 47.5q17 5 34 0" stroke="#f6e4b4" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="4.6" r="4.6" fill="#fff1cf" />
      <circle cx="18.6" cy="3.4" r="1.6" fill="#fff" opacity="0.8" />
    </svg>
  );
}

function Candle({ x, tall, color }: { x: number; tall: number; color: string }) {
  return (
    <g className="party-candle" transform={`translate(${x} 0)`}>
      <rect x="-2.3" y={30 - tall} width="4.6" height={tall} rx="1.4" fill={color} />
      <path d={`M-2.3 ${33 - tall}l4.6 -2.4M-2.3 ${38 - tall}l4.6 -2.4M-2.3 ${43 - tall}l4.6 -2.4`} stroke="#fff" strokeOpacity="0.7" strokeWidth="1.1" />
      <path d={`M0 ${30 - tall}v-2.4`} stroke="#3a2a20" strokeWidth="0.9" strokeLinecap="round" />
      <g className="party-candle__flame" style={{ transformOrigin: `0px ${27 - tall}px` }}>
        <ellipse cx="0" cy={23 - tall} rx="4.6" ry="6" fill="#ffb347" opacity="0.35" />
        <path d={`M0 ${16.5 - tall}c2.6 3.4 3.4 5.6 3.4 7.3a3.4 3.4 0 0 1 -6.8 0c0 -1.7 0.8 -3.9 3.4 -7.3Z`} fill="#ffcf5a" />
        <path d={`M0 ${21 - tall}c1.2 1.6 1.6 2.6 1.6 3.4a1.6 1.6 0 0 1 -3.2 0c0 -0.8 0.4 -1.8 1.6 -3.4Z`} fill="#fff6d8" />
      </g>
    </g>
  );
}

function Cake() {
  const id = useSvgId();
  return (
    <svg className="party-cake" viewBox="0 0 100 62" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id('sponge')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d9a6" />
          <stop offset="1" stopColor="#d9a76a" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="57" rx="46" ry="4.6" fill="#0b0805" opacity="0.35" />
      <path d="M8 34h84v18q-42 9 -84 0Z" fill={`url(#${id('sponge')})`} />
      <path d="M8 44q42 8 84 0v3q-42 8 -84 0Z" fill="#e8607a" opacity="0.85" />
      <ellipse cx="50" cy="34" rx="42" ry="7" fill="#fff4e2" />
      <path
        d="M8 34q0 6 4 6t4 -4q2 7 6 7t5 -6q3 6 7 6t5 -5q3 7 7 7t6 -6q3 6 7 6t5 -6q3 7 7 7t5 -6q2 5 6 5t3 -5Z"
        fill="#fff4e2"
      />
      <circle cx="30" cy="31.5" r="2.6" fill="#e2354d" />
      <circle cx="70" cy="31.5" r="2.6" fill="#e2354d" />
      <circle cx="29.2" cy="30.7" r="0.8" fill="#fff" opacity="0.7" />
      <circle cx="69.2" cy="30.7" r="0.8" fill="#fff" opacity="0.7" />
      <Candle x={18} tall={14} color="#9ec6e8" />
      <Candle x={82} tall={16} color="#f3a8bf" />
    </svg>
  );
}

function Figure({ id, who }: { id: CompanionId; who: 'a' | 'b' }) {
  const src = companionSprite(id, 'happy');
  if (src) return <img className="party__sprite" src={src} alt="" draggable={false} decoding="async" data-companion={id} />;
  return (
    <span className="party__drawn">
      <CompanionFigure id={id} role={who} mood="happy" />
    </span>
  );
}

/** Un compagnon au chapeau pointu (Jiji, Teto, Hin : place du chapeau dans party.css). */
function HatParty({ id, who }: { id: CompanionId; who: 'a' | 'b' }) {
  return (
    <span className={`party-figure party-figure--hat party-figure--${id}`} data-companion={id}>
      <Figure id={id} who={who} />
      <PartyHat />
    </span>
  );
}

/** Jiji au chapeau pointu. */
export function JijiParty({ who = 'a' }: { who?: 'a' | 'b' }) {
  return <HatParty id="jiji" who={who} />;
}

/** Calcifer sur son gâteau, entre deux bougies. */
export function CalciferParty({ who = 'b' }: { who?: 'a' | 'b' }) {
  return (
    <span className="party-figure party-figure--calcifer" data-companion="calcifer">
      <span className="party-figure__glow" />
      <span className="party-figure__flame">
        <Figure id="calcifer" who={who} />
      </span>
      <Cake />
    </span>
  );
}

/** La personne fêtée, avec SON compagnon : Calcifer a son gâteau, les autres un chapeau. */
export function CompanionParty({ who }: { who: 'a' | 'b' }) {
  const id = useCompanionId(who);
  if (id === 'calcifer') return <CalciferParty who={who} />;
  return <HatParty id={id} who={who} />;
}
