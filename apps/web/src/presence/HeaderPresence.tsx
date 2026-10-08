/**
 * En-tête, mode connecté : quand l'autre est sur le même onglet, son
 * compagnon apparaît en petit à côté du tien, vivant (respire, regarde
 * autour de lui). Le toucher envoie un « coucou » (anti-rafale 5 s).
 * Coucou reçu : ton compagnon fait un petit saut avec une bulle « ♡ »
 * (et un son léger si les sons sont permis), où que tu sois.
 * Calme (« Immobile », mouvement réduit) : pose seulement, rien ne bouge.
 */
import { useEffect, useRef, useState } from 'react';
import { playCue } from '../app/sound/play';
import { useShell } from '../app/ShellContext';
import { HOUSEHOLD_NAMES } from '../sync/household';
import { Companion, cx } from '../ui';
import type { CompanionMood } from '../world/types';
import { useLive } from './LiveContext';
import './presence.css';

const HEART_MS = 2_400;
const LOOK_MS = 7_000;

/** Regarde autour de lui de temps en temps (pas en mode calme). */
function useLooking(active: boolean, calm: boolean): { mood: CompanionMood; key: number } {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || calm) return;
    const t = window.setInterval(() => setN((x) => x + 1), LOOK_MS);
    return () => window.clearInterval(t);
  }, [active, calm]);
  return { mood: n % 2 === 1 ? 'curious' : 'idle', key: n };
}

export function HeaderPresence() {
  const { me, partner, partnerTab, poke, pokesReceived } = useLive();
  const { module, prefs } = useShell();
  const calm = prefs.forestMotion === 'still';
  const together = partner !== null && partnerTab === module;
  const look = useLooking(together, calm);
  const [heart, setHeart] = useState(false);
  const [sent, setSent] = useState(0);
  const seen = useRef(pokesReceived);

  // Coucou reçu : petit saut + bulle ♡.
  useEffect(() => {
    if (pokesReceived === seen.current || me === null) return;
    seen.current = pokesReceived;
    setHeart(true);
    playCue(me === 'b' ? 'crackle' : 'woodNote', { who: me });
    const t = window.setTimeout(() => setHeart(false), HEART_MS);
    return () => window.clearTimeout(t);
  }, [pokesReceived, me]);

  if (me === null || partner === null || (!together && !heart)) return null;
  return (
    <div className={cx('presence', calm && 'is-calm', heart && 'is-poked')}>
      <span className="presence__me">
        <Companion who={me} size={26} mood={heart && !calm ? 'happy' : 'idle'} reactKey={heart ? `poke-${pokesReceived}` : 'rest'} />
        {heart && (
          <span key={pokesReceived} className="presence__heart" aria-hidden="true">
            ♡
          </span>
        )}
      </span>
      {together && (
        <button
          type="button"
          className={cx('presence__partner', sent > 0 && 'is-sent')}
          aria-label={`Coucou à ${HOUSEHOLD_NAMES[partner]}`}
          onClick={() => {
            if (poke()) setSent((n) => n + 1);
          }}
        >
          <span key={sent} className="presence__breath">
            <Companion who={partner} size={26} mood={sent > 0 && !calm ? 'happy' : look.mood} reactKey={`${look.key}-${sent}`} />
          </span>
        </button>
      )}
      <span className="visually-hidden" role="status">
        {heart ? `Coucou de ${HOUSEHOLD_NAMES[partner]}` : ''}
      </span>
    </div>
  );
}
