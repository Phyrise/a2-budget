/**
 * Bandeau de la lanterne (V4) : posé juste au-dessus de la navigation, il
 * remplace l'ancienne grande fenêtre — la forêt reste visible, c'est elle
 * qui montre la lanterne de pierre allumée.
 * - en cours : la lanterne choisie (toucher = remonter vers la forêt), la
 *   tâche, le temps restant, pause / reprendre, arrêter ; toucher le texte
 *   déplie l'ambiance sonore ;
 * - à la fin : la floraison, « Cocher “tâche” ? », et l'annonce d'une
 *   nouvelle lanterne débloquée (LanternBarDone).
 * Rendu dans <body> (portail) : rien dans la feuille ne peut le décaler.
 */
import { activeLantern } from '@a2/core';
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useShell } from '../../../app/ShellContext';
import { useApp } from '../../../state/store';
import { Segmented, cx } from '../../../ui';
import { clock, remainingWords, whoLabel, type Names } from '../ritualText';
import { ambience } from './ambience';
import { LanternBarDone } from './LanternBarDone';
import { lanternName } from './lanternData';
import { revealForest } from './lanternActions';
import { lantern, remainingMs, useLantern, type LanternSound } from './lanternStore';
import { ToroArt } from './ToroArt';
import './lantern-bar.css';

/** Rafraîchit l'affichage 4×/s (le temps vient toujours de l'horloge). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Annonce vocale du temps restant, seulement aux paliers (début, mi-parcours,
 * dernière minute) et à la pause : un moment calme ne doit pas être
 * interrompu chaque minute.
 */
function spokenRemaining(total: number, minuteLeft: number, paused: boolean): string {
  if (paused) return `Lanterne en pause, ${remainingWords(minuteLeft * 60000)}`;
  const half = Math.ceil(total / 2);
  const milestone = minuteLeft >= total ? total : minuteLeft > half ? total : minuteLeft > 1 ? half : 1;
  return remainingWords(milestone * 60000);
}

const SOUNDS: ReadonlyArray<{ value: LanternSound; label: string }> = [
  { value: 'off', label: 'Silence' },
  { value: 'rain', label: 'Pluie' },
  { value: 'stream', label: 'Ruisseau' },
];

function Glyph({ name }: { name: 'pause' | 'play' | 'stop' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="currentColor">
      {name === 'pause' && (
        <>
          <rect x="5" y="4" width="3.2" height="12" rx="1.4" />
          <rect x="11.8" y="4" width="3.2" height="12" rx="1.4" />
        </>
      )}
      {name === 'play' && <path d="M6.5 4.6c0-.9 1-1.4 1.7-.9l7 4.9c.6.4.6 1.4 0 1.8l-7 4.9c-.7.5-1.7 0-1.7-.9V4.6Z" />}
      {name === 'stop' && <rect x="5" y="5" width="10" height="10" rx="2.4" />}
    </svg>
  );
}

function Running({ names, lanternId }: { names: Names; lanternId: string }) {
  const s = useLantern();
  const { isDesktop } = useShell();
  const [expanded, setExpanded] = useState(false);
  const moreId = useId();
  const now = useNow(s.phase === 'running');
  const config = s.config!;
  const paused = s.phase === 'paused';
  const remaining = remainingMs(s, now);
  const minuteLeft = Math.ceil(remaining / 60000);
  const who = whoLabel(config.who, names);

  return (
    <>
      <div className="lantern-bar__main">
        <button type="button" className="lantern-bar__look" onClick={() => revealForest(isDesktop)} aria-label="Voir la lanterne dans la forêt">
          <ToroArt id={lanternId} mode={paused ? 'unlit' : 'lit'} height={46} relative={false} />
        </button>
        <button
          type="button"
          className="lantern-bar__info"
          aria-expanded={expanded}
          aria-controls={moreId}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="lantern-bar__label">{config.label ?? 'Un moment de calme'}</span>
          <span className="lantern-bar__sub">{paused ? 'En pause' : `${who} · ${lanternName(lanternId)}`}</span>
        </button>
        <span className={cx('lantern-bar__time', 'num', paused && 'is-paused')} aria-hidden="true">
          {clock(remaining)}
        </span>
        <span className="visually-hidden" role="timer">
          {remainingWords(minuteLeft * 60000)}
        </span>
        <span className="visually-hidden" aria-live="polite">
          {spokenRemaining(config.minutes, minuteLeft, paused)}
        </span>
        {paused ? (
          <button type="button" className="lantern-bar__btn is-accent" onClick={() => lantern.resume()} aria-label="Reprendre" title="Reprendre">
            <Glyph name="play" />
          </button>
        ) : (
          <button type="button" className="lantern-bar__btn" onClick={() => lantern.pause()} aria-label="Pause" title="Pause">
            <Glyph name="pause" />
          </button>
        )}
        <button type="button" className="lantern-bar__btn" onClick={() => lantern.stop()} aria-label="Arrêter la lanterne" title="Arrêter">
          <Glyph name="stop" />
        </button>
      </div>
      <div id={moreId} className="lantern-bar__more" hidden={!expanded}>
        {ambience.supported() ? (
          <Segmented
            name="lantern-sound"
            legend="Ambiance sonore"
            size="sm"
            value={s.sound}
            onChange={(v) => {
              ambience.unlock();
              lantern.setSound(v);
            }}
            options={SOUNDS}
          />
        ) : (
          <p className="lantern-bar__note">La lanterne brûle en silence.</p>
        )}
      </div>
    </>
  );
}

/** Hauteur du bandeau → --lantern-bar-h (bulle, toasts et bas de feuille s'écartent). */
function useBarHeight(ref: RefObject<HTMLDivElement | null>, shown: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!shown || !el) return;
    const apply = () => root.style.setProperty('--lantern-bar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--lantern-bar-h');
    };
  }, [ref, shown]);
}

export function LanternBar({ names, onOpenCarnet }: { names: Names; onOpenCarnet: () => void }) {
  const s = useLantern();
  const { appState } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const shown = s.phase !== 'idle' && s.config !== null && !(s.phase === 'done' && !s.completed && s.minutesSpent < 1);
  useBarHeight(ref, shown);
  // Arrêtée avant la première minute : rien à raconter (le contrôleur réinitialise).
  if (!shown || typeof document === 'undefined') return null;
  const lanternId = activeLantern(appState?.focus);
  const live = s.phase === 'running' || s.phase === 'paused';

  return createPortal(
    <div
      ref={ref}
      className={cx('lantern-bar', live ? 'lantern-bar--live' : 'lantern-bar--done', s.phase === 'paused' && 'is-paused')}
      role="region"
      aria-label={live ? 'Lanterne allumée' : 'Fin de la lanterne'}
    >
      {live ? <Running names={names} lanternId={lanternId} /> : <LanternBarDone names={names} lanternId={lanternId} onOpenCarnet={onOpenCarnet} />}
    </div>,
    document.body,
  );
}
