/**
 * L'avatar de l'autre (V5.2) : quand l'autre est sur le même onglet, son
 * compagnon (Jiji pour AL, Calcifer pour AC) vient vivre sur le haut de la
 * barre du bas. Le serveur ne dit que « il est là » (présence existante,
 * aucune écriture de plus) ; tout le reste se joue sur ce téléphone.
 *
 * Gestes (seul l'avatar capte le doigt, rien d'autre n'est masqué) :
 * - toucher → petit saut + ♡, et le coucou existant part (anti-rafale) ;
 * - caresser (glisser le doigt dessus) → Jiji ronronne, Calcifer crépite.
 * Coucou reçu pendant qu'il est là : il fait coucou (saut + ♡).
 *
 * Mode développeur : « faire venir » l'avatar en local (devVisit.ts).
 */
import { useEffect, useRef, type PointerEvent } from 'react';
import { useShell, useMediaQuery } from '../../app/ShellContext';
import { playCue } from '../../app/sound/play';
import { HOUSEHOLD_NAMES } from '../../sync/household';
import { Companion, cx } from '../../ui';
import { useLive } from '../LiveContext';
import type { AvatarReact, AvatarWho } from './avatarModel';
import { devVisitLeave, useDevVisit } from './devVisit';
import { useAvatar } from './useAvatar';
import './avatar.css';

/** Glissé (px) au-delà duquel le toucher devient une caresse. */
const PET_PX = 26;
/** Une caresse continue relance le ronron au plus toutes les… */
const PET_EVERY_MS = 1_300;

export function PartnerAvatar() {
  const live = useLive();
  const dev = useDevVisit();
  const { module, prefs } = useShell();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const calm = reduced || prefs.forestMotion === 'still';

  const liveWho = live.partner !== null && live.partnerTab === module ? live.partner : null;
  const devWho = prefs.devMode && dev !== null ? dev.who : null;
  const who: AvatarWho | null = liveWho ?? devWho;
  const simulated = liveWho === null && devWho !== null;
  const pokesIn = simulated ? (dev?.pokes ?? 0) : live.pokesReceived;

  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { view, react, finger } = useAvatar(who, calm, stageRef, bodyRef);

  // Quitter le mode développeur renvoie le visiteur simulé.
  useEffect(() => {
    if (!prefs.devMode) devVisitLeave();
  }, [prefs.devMode]);

  // Coucou reçu pendant qu'il est là : il fait coucou.
  const seenPokes = useRef(pokesIn);
  useEffect(() => {
    if (pokesIn === seenPokes.current) return;
    seenPokes.current = pokesIn;
    react('wave');
  }, [pokesIn, react]);

  // Ton doigt ailleurs sur l'écran : il le regarde.
  useEffect(() => {
    if (view === null) return;
    const onDown = (e: globalThis.PointerEvent) => finger(e.clientX);
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, [view === null, finger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toucher ou caresse.
  const gesture = useRef<{ id: number; x: number; y: number; dist: number; petAt: number } | null>(null);
  const pet = () => {
    react('purr');
    playCue(who === 'b' ? 'crackle' : 'purr', { who: who ?? 'none' });
  };
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dist: 0, petAt: 0 };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointeur déjà relâché.
    }
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (g === null || g.id !== e.pointerId) return;
    g.dist += Math.hypot(e.clientX - g.x, e.clientY - g.y);
    g.x = e.clientX;
    g.y = e.clientY;
    const now = performance.now();
    if (g.dist >= PET_PX && now - g.petAt >= PET_EVERY_MS) {
      g.petAt = now;
      pet();
    }
  };
  const tap = () => {
    react('hop');
    if (!simulated) live.poke();
  };
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (g === null || g.id !== e.pointerId) return;
    if (g.petAt === 0) tap();
  };

  if (view === null || who === null) return <div ref={stageRef} className="avatar-stage" aria-hidden="true" />;
  const hearts: readonly (AvatarReact | null)[] = ['hop', 'wave'];
  return (
    <div ref={stageRef} className={cx('avatar-stage', calm && 'is-calm')}>
      <div
        ref={bodyRef}
        className={cx('avatar', `avatar--${view.who}`, `is-${view.motion}`, view.react && `is-${view.react}`)}
        data-testid="partner-avatar"
        data-phase={view.phase}
        data-react={view.react ?? ''}
      >
        <button
          type="button"
          className="avatar__body"
          aria-label={`Coucou à ${HOUSEHOLD_NAMES[view.who]}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (gesture.current = null)}
          onClick={(e) => {
            if (e.detail === 0) tap(); // clavier
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="avatar__flip" style={{ transform: view.facing === 1 ? undefined : 'scaleX(-1)' }}>
            <span key={view.reactN} className="avatar__move">
              <Companion who={view.who} size={44} mood={view.mood} />
            </span>
          </span>
        </button>
        {hearts.includes(view.react) && (
          <span key={`h${view.reactN}`} className="avatar__heart" data-testid="partner-avatar-heart" aria-hidden="true">
            ♡
          </span>
        )}
        {view.phase === 'sleep' && (
          <span className="avatar__zz" aria-hidden="true">
            z
          </span>
        )}
      </div>
    </div>
  );
}
