/**
 * Fête d'anniversaire d'AL ou d'AC (V4.3), à la première ouverture du jour
 * (préférence locale : une fois par jour) ou à la demande du panneau DEV :
 * - AL : Jiji au chapeau pointu, pluie de kompeitō ;
 * - AC : Calcifer sur un gâteau entre deux bougies, étincelles qui montent.
 * Au plus « Joyeux anniversaire, <prénom> » (prénom des réglages). Un vrai
 * bouton : le toucher ferme la fête, sinon elle s'efface seule. Sans
 * mouvement (prefers-reduced-motion, Forêt « Immobile ») : ni pluie ni
 * étincelles, un simple fondu. Petit son seulement si les petits sons sont
 * activés (playCue). Une fête à la fois (anti-rafale).
 */
import { fetesOn, localDateKey } from '@a2/core';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useMediaQuery, useShell } from '../../app/ShellContext';
import { playCue } from '../../app/sound';
import { useApp } from '../../state/store';
import { budgetTheme } from '../../themes/manifest';
import { cx } from '../../ui';
import { claimPartyDay, usePartyRequest, type PartyWho } from './feteEvents';
import { CalciferParty, JijiParty } from './PartyArt';
import './party.css';

/** Attente après l'ouverture (l'app se pose), durée de la fête, sortie. */
const OPEN_DELAY_MS = 900;
const SHOW_MS = 6800;
const STILL_SHOW_MS = 5200;
const LEAVE_MS = 420;
const KONPEITO = 24;
const SPARKS = 16;

interface Party {
  who: PartyWho;
  key: number;
}

/** Hasard reproductible (positions des kompeitō et des étincelles). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function KonpeitoRain({ seed }: { seed: number }) {
  const drops = useMemo(() => {
    const r = seeded(seed);
    const colors = Object.values(budgetTheme.gold.konpeito);
    return Array.from({ length: KONPEITO }, (_, i) => ({
      src: colors[i % colors.length]!,
      style: {
        '--x': `${(4 + r() * 92).toFixed(1)}vw`,
        '--size': `${Math.round(14 + r() * 12)}px`,
        '--delay': `${Math.round(r() * 1700)}ms`,
        '--dur': `${Math.round(2600 + r() * 1500)}ms`,
        '--spin': `${Math.round((r() - 0.5) * 720)}deg`,
        '--drift': `${Math.round((r() - 0.5) * 60)}px`,
      } as CSSProperties,
    }));
  }, [seed]);
  return (
    <div className="party__rain">
      {drops.map((d, i) => (
        <img key={i} className="party__konpeito" src={d.src} alt="" draggable={false} style={d.style} />
      ))}
    </div>
  );
}

function Sparks({ seed }: { seed: number }) {
  const sparks = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: SPARKS }, () => ({
      '--x': `${Math.round((r() - 0.5) * 70)}px`,
      '--rise': `${Math.round(70 + r() * 90)}px`,
      '--drift': `${Math.round((r() - 0.5) * 50)}px`,
      '--delay': `${Math.round(r() * 2600)}ms`,
      '--dur': `${Math.round(1100 + r() * 900)}ms`,
      '--size': `${(2.5 + r() * 3).toFixed(1)}px`,
    })) as CSSProperties[];
  }, [seed]);
  return (
    <span className="party__sparks">
      {sparks.map((style, i) => (
        <span key={i} className="party__spark" style={style} />
      ))}
    </span>
  );
}

export function BirthdayParty() {
  const { appState, today } = useApp();
  const { prefs } = useShell();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const still = reduced || prefs.forestMotion === 'still';
  const [party, setParty] = useState<Party | null>(null);
  const [leaving, setLeaving] = useState(false);

  const todayKey = localDateKey(today);
  const fetes = fetesOn(appState?.anniversaries, todayKey);
  const birthday: PartyWho | null = fetes.includes('a') ? 'a' : fetes.includes('b') ? 'b' : null;

  // Première ouverture du jour d'un anniversaire : la fête, une seule fois.
  useEffect(() => {
    if (birthday === null) return;
    const timer = window.setTimeout(() => {
      if (claimPartyDay(todayKey)) setParty((cur) => cur ?? { who: birthday, key: Date.now() });
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [birthday, todayKey]);

  // Panneau DEV : rejouer (jamais deux fêtes à la fois).
  usePartyRequest((who) => setParty((cur) => cur ?? { who, key: Date.now() }));

  useEffect(() => {
    if (party === null) return;
    setLeaving(false);
    playCue(party.who === 'a' ? 'konpeito' : 'lanternLit', { who: party.who });
    const leave = window.setTimeout(() => setLeaving(true), still ? STILL_SHOW_MS : SHOW_MS);
    return () => window.clearTimeout(leave);
  }, [party, still]);

  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(() => {
      setParty(null);
      setLeaving(false);
    }, LEAVE_MS);
    return () => window.clearTimeout(done);
  }, [leaving]);

  if (party === null || appState === null) return null;
  const name = party.who === 'a' ? appState.budget.settings.personA.name : appState.budget.settings.personB.name;
  const message = `Joyeux anniversaire, ${name}`;

  return (
    <div className={cx('party', `party--${party.who}`, still && 'party--still', leaving && 'is-leaving')} key={party.key}>
      {!still && party.who === 'a' && <KonpeitoRain seed={party.key} />}
      <button type="button" className="party__card" aria-label={`${message} (fermer)`} onClick={() => setLeaving(true)}>
        <span className="party__stage" aria-hidden="true">
          {party.who === 'a' ? <JijiParty /> : <CalciferParty />}
          {!still && party.who === 'b' && <Sparks seed={party.key} />}
        </span>
        <span className="party__text" aria-hidden="true">
          {message}
        </span>
      </button>
      <span className="visually-hidden" role="status">
        {message}
      </span>
    </div>
  );
}
