/**
 * Objectif de la semaine — carte compacte et bienveillante (V3.2).
 *
 * Une lanterne dans un anneau qui se remplit de lumière au fil des soins de
 * la semaine (weeklyCareGoal de @a2/core), un niveau en mots, une tendance
 * et une ligne qui dit ce qui compte. Jamais de chiffre, jamais de sanction,
 * jamais de rouge : le niveau le plus bas est « la forêt se repose », la
 * forêt ne meurt jamais et rien ne se reporte d'une semaine à l'autre.
 */
import { DAILY_CREDIT_CAP, weeklyCareGoal, type WeeklyGoalLevel, type WeeklyGoalTrend } from '@a2/core';
import { useMemo } from 'react';
import { useApp } from '../../state/store';
import { cx } from '../../ui';
import './weekly-goal.css';

const LEVEL_TITLES: Record<WeeklyGoalLevel, string> = {
  resting: 'La forêt se repose',
  good: 'La forêt va bien',
  flourishing: 'La forêt s’épanouit',
};

const LEVEL_BODIES: Record<WeeklyGoalLevel, string> = {
  resting: 'Elle n’attend rien de vous. Un geste, quand vous pourrez, suffira à la réveiller doucement.',
  good: 'Elle profite de vos soins de la semaine, tranquillement.',
  flourishing: 'Une semaine bien choyée : la clairière rayonne.',
};

const TRENDS: Record<WeeklyGoalTrend, string> = {
  rising: 'elle reprend des forces',
  steady: 'stable',
  resting: 'elle se repose',
};

const WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept'];
const FEM = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept'];

/** Anneau + lanterne : la lumière monte avec la semaine (décoratif). */
function LanternRing({ progress }: { progress: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const glow = 0.18 + 0.82 * progress;
  return (
    <svg className="weekly-goal__ring" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="weekly-goal-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#93ad7c" />
          <stop offset="1" stopColor="#ecd09a" />
        </linearGradient>
        <radialGradient id="weekly-goal-glow">
          <stop offset="0" stopColor="#ffe3a8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ddb36a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="weekly-goal__track" cx="36" cy="36" r={r} />
      <circle
        className="weekly-goal__arc"
        cx="36"
        cy="36"
        r={r}
        stroke="url(#weekly-goal-arc)"
        strokeDasharray={`${c * progress} ${c}`}
        transform="rotate(-90 36 36)"
      />
      <circle cx="36" cy="38" r="17" fill="url(#weekly-goal-glow)" opacity={glow} className="weekly-goal__glow" />
      {/* Lanterne de papier : anse, chapeau, corps arrondi, pied. */}
      <g className="weekly-goal__lantern">
        <path d="M33 22.5h6M36 20v2.5" />
        <rect x="31" y="24" width="10" height="2.6" rx="1.2" />
        <path d="M30.6 26.6c-2.6 2.2-3.4 5.4-3.4 9.4s.8 7.2 3.4 9.4h10.8c2.6-2.2 3.4-5.4 3.4-9.4s-.8-7.2-3.4-9.4Z" />
        <path d="M36 26.6v18.8M31.8 27.6c-1.2 2.4-1.6 5.2-1.6 8.4s.4 6 1.6 8.4M40.2 27.6c1.2 2.4 1.6 5.2 1.6 8.4s-.4 6-1.6 8.4" className="weekly-goal__ribs" />
        <rect x="31.6" y="45.4" width="8.8" height="2.4" rx="1.1" />
      </g>
    </svg>
  );
}

export function WeeklyGoalCard() {
  const { appState, today } = useApp();
  const forest = appState?.forest;
  const goal = useMemo(() => (forest ? weeklyCareGoal(forest, today) : null), [forest, today]);
  if (!forest || goal === null) return null;

  const paused = forest.paused;
  const fresh = goal.creditsThisWeek === 0 && today.getDay() === 1;
  const title = paused ? 'La forêt dort' : LEVEL_TITLES[goal.level];
  const body = paused
    ? 'La semaine attendra : rien ne se perd pendant la pause.'
    : fresh
      ? 'Une nouvelle semaine commence : chaque geste y posera sa lumière.'
      : LEVEL_BODIES[goal.level];
  // Tendance masquée quand elle redirait le niveau (« se repose · elle se repose »).
  const showTrend = !paused && !fresh && !(goal.level === 'resting' && goal.trend === 'resting');
  const days = Math.max(1, Math.ceil(goal.target / DAILY_CREDIT_CAP));
  const capWord = WORDS[DAILY_CREDIT_CAP] ?? String(DAILY_CREDIT_CAP);
  const daysWord = FEM[days] ?? String(days);
  const rule = `Ce qui compte\u00a0: les gestes faits, jusqu’à ${capWord}\u00a0soins par jour. ${daysWord.charAt(0).toUpperCase()}${daysWord.slice(1)}\u00a0belles journées font une semaine épanouie.`;

  return (
    <section className={cx('weekly-goal card', `weekly-goal--${paused ? 'paused' : goal.level}`)} aria-labelledby="weekly-goal-title">
      <LanternRing progress={goal.progress} />
      <div className="weekly-goal__text">
        <h2 className="weekly-goal__eyebrow">Objectif de la semaine</h2>
        <p id="weekly-goal-title" className="weekly-goal__title">
          {title}
          {showTrend && (
            <span className="weekly-goal__trend" data-trend={goal.trend}>
              <span className="visually-hidden">, </span>
              {TRENDS[goal.trend]}
            </span>
          )}
        </p>
        <p className="weekly-goal__body">{body}</p>
        <p className="weekly-goal__rule">{rule}</p>
      </div>
    </section>
  );
}
