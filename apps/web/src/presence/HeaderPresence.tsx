/**
 * En-tête, mode connecté : coucou reçu → ton compagnon fait un petit saut
 * avec une bulle « ♡ » (et un son léger si les sons sont permis : le son
 * « touché » de ton compagnon, sinon une note de bois), où que tu sois. Le
 * compagnon de l'autre n'est plus ici : il vit sur la barre du bas quand
 * l'autre est sur le même onglet (avatar/PartnerAvatar.tsx, V5.2).
 * Calme (« Immobile », mouvement réduit) : pose seulement, rien ne bouge.
 */
import { useEffect, useRef, useState } from 'react';
import { playCue } from '../app/sound/play';
import { useShell } from '../app/ShellContext';
import { HOUSEHOLD_NAMES } from '../sync/household';
import { Companion, cx } from '../ui';
import { companionProfile, useCompanionIds } from '../ui/companions';
import { useLive } from './LiveContext';
import './presence.css';

const HEART_MS = 2_400;

export function HeaderPresence() {
  const { me, partner, pokesReceived } = useLive();
  const { prefs } = useShell();
  const calm = prefs.forestMotion === 'still';
  const [heart, setHeart] = useState(false);
  const seen = useRef(pokesReceived);
  // Lu au moment du coucou (pas une dépendance : le minuteur de la bulle reste).
  const companions = useCompanionIds();
  const ids = useRef(companions);
  ids.current = companions;

  // Coucou reçu : petit saut + bulle ♡.
  useEffect(() => {
    if (pokesReceived === seen.current || me === null) return;
    seen.current = pokesReceived;
    setHeart(true);
    playCue(companionProfile(ids.current[me]).sounds?.poke ?? 'woodNote', { who: me });
    const t = window.setTimeout(() => setHeart(false), HEART_MS);
    return () => window.clearTimeout(t);
  }, [pokesReceived, me]);

  if (me === null || partner === null || !heart) return null;
  return (
    <div className={cx('presence', calm && 'is-calm', 'is-poked')}>
      <span className="presence__me">
        <Companion who={me} size={26} mood={calm ? 'idle' : 'happy'} reactKey={`poke-${pokesReceived}`} />
        <span key={pokesReceived} className="presence__heart" aria-hidden="true">
          ♡
        </span>
      </span>
      <span className="visually-hidden" role="status">
        {`Coucou de ${HOUSEHOLD_NAMES[partner]}`}
      </span>
    </div>
  );
}
