/**
 * Le train des eaux, dessiné en SVG (ChihiroTrain.tsx) : trois voitures bleu
 * nuit roulant sur des rails noyés, fenêtres éclairées (quelques ombres de
 * voyageurs), pantographe et phare sur la voiture de tête (à droite : il va
 * vers la droite), sillage, reflet tremblé et estompé sous la ligne d'eau.
 */
import { useId } from 'react';

/** Toile du dessin et ligne d'eau (fraction de la hauteur). */
export const TRAIN_ART = { w: 480, h: 80, waterline: 44 / 80 } as const;

const CARS = [44, 184, 324];
const CAR_W = 134;
/** Fenêtres où passe l'ombre d'un voyageur (voiture, fenêtre). */
const GHOSTS = new Set(['0-2', '0-5', '1-1', '1-3', '1-6', '2-0', '2-4']);

interface Fills {
  body: string;
  window: string;
}

function Car({ x, index, lead, fills }: { x: number; index: number; lead: boolean; fills: Fills }) {
  return (
    <g>
      <rect x={x + 5} y="9" width={CAR_W - 10} height="6" rx="3" fill="#121a26" />
      <path
        d={`M${x + 4} 14h${CAR_W - (lead ? 14 : 8)}q${lead ? 10 : 4} 0 ${lead ? 10 : 4} ${lead ? 9 : 4}v${lead ? 21 : 26}h-${CAR_W}v-26q0 -4 4 -4Z`}
        fill={fills.body}
      />
      <path d={`M${x + 2} 36.5h${CAR_W - 4}`} stroke="#c9b48a" strokeOpacity="0.45" strokeWidth="1.2" />
      {Array.from({ length: 7 }, (_, j) => {
        const wx = x + 9 + j * 17.4;
        return (
          <g key={j}>
            <rect x={wx} y="18" width="11.5" height="11" rx="1.6" fill={fills.window} />
            {GHOSTS.has(`${index}-${j}`) && (
              <g fill="#1a2232" fillOpacity="0.62">
                <circle cx={wx + 5.75} cy="22.6" r="2.2" />
                <path d={`M${wx + 1.8} 29c0.6 -3.4 2 -4.6 3.95 -4.6s3.35 1.2 3.95 4.6Z`} />
              </g>
            )}
          </g>
        );
      })}
      {lead && (
        <g stroke="#0e141d" strokeWidth="1.3" fill="none" strokeLinejoin="round">
          <path d={`M${x + 86} 9l8 -6l8 6M${x + 86} 9l8 -3M${x + 102} 9l-8 -3`} />
          <path d={`M${x + 88} 2.6h12`} strokeWidth="1.6" />
        </g>
      )}
    </g>
  );
}

function Cars({ fills }: { fills: Fills }) {
  return (
    <g>
      {CARS.slice(0, -1).map((x) => (
        <rect key={x} x={x + CAR_W - 1} y="30" width="8" height="3" fill="#0e141d" />
      ))}
      {CARS.map((x, i) => (
        <Car key={x} x={x} index={i} lead={i === CARS.length - 1} fills={fills} />
      ))}
    </g>
  );
}

export function TrainArt() {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `${name}-${raw}`;
  const cars = id('cars');
  return (
    <svg className="train-art" viewBox={`0 0 ${TRAIN_ART.w} ${TRAIN_ART.h}`} preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={id('body')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24344c" />
          <stop offset="0.5" stopColor="#162132" />
          <stop offset="1" stopColor="#0c121b" />
        </linearGradient>
        <linearGradient id={id('window')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0c2" />
          <stop offset="1" stopColor="#ffb85a" />
        </linearGradient>
        <linearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={id('below')} maskUnits="userSpaceOnUse" x="0" y="44" width={TRAIN_ART.w} height="36">
          <rect x="0" y="44" width={TRAIN_ART.w} height="36" fill={`url(#${id('fade')})`} />
        </mask>
        <filter id={id('ripple')} x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.32" numOctaves="1" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id('glow')} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <g id={cars}>
          <Cars fills={{ body: `url(#${id('body')})`, window: `url(#${id('window')})` }} />
        </g>
      </defs>

      {/* Reflet : tremblé, estompé sous la ligne d'eau. */}
      <g mask={`url(#${id('below')})`} opacity="0.42">
        <g filter={`url(#${id('ripple')})`}>
          <use href={`#${cars}`} transform="translate(0 88) scale(1 -1)" />
        </g>
      </g>

      {/* Sillage et clapotis le long de la ligne d'eau. */}
      <g stroke="#f4e3c0" strokeLinecap="round" fill="none">
        <path d="M2 45.5h46M10 48h30M22 50.5h14" strokeOpacity="0.32" strokeWidth="1" />
        <path d="M46 44.6h150M206 44.6h120M336 44.6h126" strokeOpacity="0.45" strokeWidth="0.9" strokeDasharray="7 5" />
      </g>

      <use href={`#${cars}`} />

      {/* Lueur des fenêtres et du phare. */}
      <g filter={`url(#${id('glow')})`} opacity="0.95">
        {CARS.map((x) => (
          <rect key={x} x={x + 8} y="16" width={CAR_W - 16} height="15" rx="3" fill="#ffbe62" opacity="0.7" />
        ))}
        <ellipse cx="470" cy="34" rx="7" ry="4" fill="#fff1c4" />
      </g>
      <circle cx="466.5" cy="34" r="2.2" fill="#fff6d8" />
      <ellipse cx="472" cy="45" rx="8" ry="1.4" fill="#fff1c4" opacity="0.5" />
    </svg>
  );
}
