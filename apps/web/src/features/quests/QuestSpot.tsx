/**
 * V5.1 — la quête du jour dans la fenêtre sur le monde d'un onglet, jamais
 * annoncée. Un toucher = sa main posée (effet partiel, petite tête de Jiji
 * ou de Calcifer, vus des deux côtés) ; quand les deux ont aidé, petite fête
 * commune (une fois par téléphone), puis l'objet s'en va. Pas réglée dans la
 * journée : à minuit, elle s'efface en douceur.
 *
 * Synchronisé : quête du calendrier (déterministe) ou du mode développeur.
 * Invité : seulement celles du mode développeur (AL puis AC au toucher).
 * `QuestRewards` (monté une fois) donne les +3 kompeitō de ce téléphone.
 */
import {
  QUEST_GIFT,
  addDays,
  isQuestDone,
  localDateKey,
  questOfDay,
  questStatus,
  type QuestTab,
  type SharedQuest,
} from '@a2/core';
import { useEffect, useRef, useState } from 'react';
import { playCue } from '../../app/sound';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { budgetTheme } from '../../themes/manifest';
import { cx } from '../../ui';
import { CalciferArt, JijiArt } from '../../ui/companionArt';
import { QuestArt } from './QuestArt';
import { questMemory } from './questMemory';
import './quests.css';

const CELEBRATE_MS = 2800;
const FADE_MS = 1200;
const LABEL = { rocher: 'Un rocher', tresor: 'Un petit colis', pousse: 'Une pousse' } as const;

function Heads({ quest }: { quest: SharedQuest }) {
  return (
    <span className="quest__heads" aria-hidden="true">
      {quest.helpers.a !== undefined && (
        <span className="quest__head quest__head--a">
          <JijiArt mood="happy" />
        </span>
      )}
      {quest.helpers.b !== undefined && (
        <span className="quest__head quest__head--b">
          <CalciferArt mood="happy" />
        </span>
      )}
    </span>
  );
}

function Sparks() {
  const colors = Object.values(budgetTheme.gold.konpeito);
  return (
    <span className="quest__sparks" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <img key={i} className={`quest__spark quest__spark--${i}`} src={colors[i % colors.length]} alt="" draggable={false} />
      ))}
    </span>
  );
}

export function QuestSpot({ tab }: { tab: QuestTab }) {
  const { appState, today, me, helpQuest } = useApp();
  const found = questOfDay(appState?.quests?.items, localDateKey(today), { scheduled: me !== null });
  const quest = found !== null && found.tab === tab ? found : null;
  const done = quest !== null && isQuestDone(quest);
  const celebrating = done && !questMemory.wasShown(quest.id);
  const visible = quest !== null && (!done || celebrating) ? quest : null;

  const [, rerender] = useState(0);
  const [wiggle, setWiggle] = useState(false);
  const [fading, setFading] = useState<SharedQuest | null>(null);
  const last = useRef<SharedQuest | null>(null);

  // La fête commune : une fois par téléphone, puis l'objet s'en va.
  const celebrateId = celebrating ? quest.id : null;
  useEffect(() => {
    if (celebrateId === null) return;
    playCue('konpeito', { who: 'both' });
    const timer = window.setTimeout(() => {
      questMemory.markShown(celebrateId);
      rerender((n) => n + 1);
    }, CELEBRATE_MS);
    return () => window.clearTimeout(timer);
  }, [celebrateId]);

  // Pas réglée à minuit : elle s'efface en douceur.
  useEffect(() => {
    if (visible !== null) {
      last.current = visible;
      setFading(null);
      return;
    }
    const prev = last.current;
    last.current = null;
    if (prev === null || isQuestDone(prev)) return;
    setFading(prev);
    const timer = window.setTimeout(() => setFading(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!wiggle) return;
    const timer = window.setTimeout(() => setWiggle(false), 500);
    return () => window.clearTimeout(timer);
  }, [wiggle]);

  const shown = visible ?? fading;
  if (shown === null) return null;
  const status = questStatus(shown);

  const touch = () => {
    if (visible === null || status === 'done') return;
    const role = helpQuest(visible);
    if (role === null) setWiggle(true);
    else {
      questMemory.markHelped(visible.id);
      playCue('woodNote', { who: role });
    }
  };

  return (
    <button
      type="button"
      className={cx(
        'quest',
        `quest--${shown.kind}`,
        `quest--spot${shown.spot}`,
        `is-${status}`,
        celebrating && 'is-celebrating',
        wiggle && 'is-wiggle',
        visible === null && 'is-fading',
      )}
      aria-label={LABEL[shown.kind]}
      data-quest={shown.id}
      data-status={status}
      onClick={touch}
    >
      <QuestArt kind={shown.kind} status={status} />
      <Heads quest={shown} />
      {celebrating && <Sparks />}
    </button>
  );
}

/** Les +3 kompeitō de CE téléphone, une fois par quête réglée (aujourd'hui ou hier) où il a aidé. */
export function QuestRewards() {
  const { appState, today } = useApp();
  const items = appState?.quests?.items;
  useEffect(() => {
    if (items === undefined) return;
    const days = [localDateKey(today), localDateKey(addDays(today, -1))];
    for (const q of items) {
      if (isQuestDone(q) && days.includes(q.day) && questMemory.claimReward(q.id)) playGive(QUEST_GIFT, 'quete');
    }
  }, [items, today]);
  return null;
}
