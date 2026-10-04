/**
 * Les petits rituels de Maison (sous « À venir ») : Cercle de la semaine,
 * Lanterne, Carnet de la forêt. Composant sans props : useApp() + useWorld().
 *
 * - Le cercle est mis en avant du vendredi au lundi tant qu'il n'a pas été
 *   tenu ; ensuite il se fait discret (« Tenu », pour le relire).
 * - La lanterne continue de brûler quand on ferme sa feuille : la carte
 *   montre alors le temps restant, et la feuille se rouvre à la floraison.
 */
import { circleForWeek } from '@a2/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Icon, cx } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { CarnetSheet } from './carnet/CarnetSheet';
import { CircleSheet } from './circle/CircleSheet';
import { LanternSheet } from './lantern/LanternSheet';
import { remainingMs, useLantern } from './lantern/lanternStore';
import { useLanternController } from './lantern/useLanternController';
import { RitualGlyph } from './RitualGlyph';
import { NB, isCircleWindow, ritualWeek, typo, type Names } from './ritualText';
import './rituals.css';

type Open = 'circle' | 'lantern' | 'carnet' | null;

function LanternStatus() {
  const s = useLantern();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (s.phase !== 'running') return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [s.phase]);
  if (s.phase === 'running') {
    const m = Math.max(1, Math.ceil(remainingMs(s) / 60000));
    return <>Allumée · {m}{NB}min</>;
  }
  if (s.phase === 'paused') return <>En pause</>;
  if (s.phase === 'done') return <>Elle a fleuri</>;
  return <>Un minuteur doux pour s’y mettre</>;
}

export function RitualsBar() {
  const { appState, today } = useApp();
  const { pulse } = useWorld();
  const { isDesktop, setForegroundSheet } = useShell();
  const lanternState = useLantern();
  const [open, setOpen] = useState<Open>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Cercle et carnet recouvrent la forêt : elle peut se figer. La lanterne, non.
  useEffect(() => {
    if (open !== 'circle' && open !== 'carnet') return;
    setForegroundSheet(true);
    return () => setForegroundSheet(false);
  }, [open, setForegroundSheet]);

  // Floraison : la feuille de la lanterne se rouvre, sauf si une autre
  // feuille est ouverte (on n'interrompt pas une saisie) — la carte le dit.
  const onLanternFinished = useCallback(() => {
    if (document.querySelector('dialog[open]')) return;
    setOpen((current) => (current === null ? 'lantern' : current));
  }, []);
  useLanternController({ onFinished: onLanternFinished });

  // Après le cercle : retour vers la forêt, puis deux lumières qui montent.
  const forestMoment = useCallback(
    (key: string) => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
      later(() => {
        if (!isDesktop) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        later(() => {
          const cx0 = isDesktop ? (window.innerWidth - 480) / 2 : window.innerWidth / 2;
          const y = window.innerHeight * (isDesktop ? 0.72 : 0.6);
          pulse({ id: `circle-${key}-a`, who: 'a', fromClientX: cx0 - 48, fromClientY: y, strong: true });
          later(() => pulse({ id: `circle-${key}-b`, who: 'b', fromClientX: cx0 + 48, fromClientY: y, strong: true }), 520);
        }, reduce || isDesktop ? 250 : 950);
      }, 280);
    },
    [isDesktop, pulse],
  );

  if (!appState) return null;

  const names: Names = { a: appState.budget.settings.personA.name, b: appState.budget.settings.personB.name };
  const week = ritualWeek(today);
  const held = circleForWeek(appState.rituals, week.weekStart);
  const highlight = held === null && isCircleWindow(today);
  const lastIntention = held === null ? [...(appState.rituals?.circles ?? [])].reverse().find((c) => c.intentions.length > 0)?.intentions[0] : undefined;
  const lanternLive = lanternState.phase === 'running' || lanternState.phase === 'paused';

  return (
    <section className="sheet-section rituals" aria-labelledby="rituals-title">
      <div className="section-head">
        <h2 id="rituals-title" className="section-title">
          Petits rituels
        </h2>
      </div>
      {highlight && (
        <p className="rituals__invite">
          C’est le moment du cercle{NB}: dix minutes à deux pour se dire merci.
        </p>
      )}
      {!highlight && held === null && lastIntention && (
        <p className="rituals__intention">
          <Icon name="sparkle" size={15} /> Votre intention{NB}: <em>{typo(lastIntention)}</em>
        </p>
      )}
      <div className="rituals__row">
        <button
          type="button"
          className={cx('ritual-card', 'ritual-card--circle', highlight && 'is-highlight', held && 'is-held')}
          onClick={() => setOpen('circle')}
          aria-label={held ? 'Cercle de la semaine, tenu — le relire' : 'Cercle de la semaine'}
        >
          <span className="ritual-card__glyph">
            <RitualGlyph name="circle" />
          </span>
          <span className="ritual-card__title">Cercle de la semaine</span>
          <span className="ritual-card__sub">
            {held ? (
              <>
                <Icon name="check" size={14} /> Tenu
              </>
            ) : highlight ? (
              'Ce week-end'
            ) : (
              'Merci, ce qui pèse'
            )}
          </span>
        </button>

        <button
          type="button"
          className={cx('ritual-card', 'ritual-card--lantern', lanternLive && 'is-live', lanternState.phase === 'done' && 'is-bloom')}
          onClick={() => setOpen('lantern')}
        >
          <span className="ritual-card__glyph">
            <RitualGlyph name="lantern" />
          </span>
          <span className="ritual-card__title">{lanternLive ? 'Lanterne allumée' : 'Lanterne'}</span>
          <span className="ritual-card__sub">
            <LanternStatus />
          </span>
        </button>

        <button type="button" className="ritual-card ritual-card--carnet" onClick={() => setOpen('carnet')}>
          <span className="ritual-card__glyph">
            <RitualGlyph name="carnet" />
          </span>
          <span className="ritual-card__title">Carnet de la forêt</span>
          <span className="ritual-card__sub">Créatures, souvenirs</span>
        </button>
      </div>

      <CircleSheet
        open={open === 'circle'}
        onClose={() => setOpen(null)}
        onHeld={() => forestMoment(week.weekStart)}
        names={names}
      />
      <LanternSheet open={open === 'lantern'} onClose={() => setOpen(null)} names={names} />
      <CarnetSheet open={open === 'carnet'} onClose={() => setOpen(null)} />
    </section>
  );
}
