/**
 * V5.1 — actions des quêtes communes (même sémantique que les autres :
 * transition PURE via `transact`, heure capturée avant). La quête n'est
 * écrite (partagée) qu'au premier toucher, ou par le mode développeur.
 *
 * Qui touche : le rôle du compte connecté ; en invité (personne), le premier
 * rôle qui n'a pas encore aidé (AL puis AC), pour tester seul.
 */
import { useCallback, useMemo } from 'react';
import { addQuest, devQuest, helpQuest, localDateKey, type AppState, type QuestKind, type QuestRole, type SharedQuest } from '@a2/core';
import type { Transact } from './careActions';

export interface QuestActions {
  /** Toucher la quête (une fois par personne) ; rend le rôle qui a aidé, ou null. */
  helpQuest: (quest: SharedQuest, as?: QuestRole) => QuestRole | null;
  /** Mode développeur : fait apparaître une quête aujourd'hui (partagée si synchronisé), à l'emplacement voulu. */
  spawnQuest: (kind: QuestKind, spot?: number) => SharedQuest | null;
}

function withItems(s: AppState, items: SharedQuest[]): AppState {
  return items === s.quests?.items ? s : { ...s, quests: { items } };
}

export function useQuestActions(transact: Transact, me: QuestRole | null): QuestActions {
  const help = useCallback(
    (quest: SharedQuest, as?: QuestRole): QuestRole | null => {
      const now = new Date();
      return transact<QuestRole | null>((s) => {
        const items = s.quests?.items ?? [];
        const stored = items.find((q) => q.id === quest.id) ?? quest;
        const role: QuestRole = as ?? me ?? (stored.helpers.a === undefined ? 'a' : 'b');
        const next = helpQuest(items, stored, role, now);
        return next === items ? { state: s, result: null } : { state: withItems(s, next), result: role };
      }, null);
    },
    [transact, me],
  );

  const spawn = useCallback(
    (kind: QuestKind, spot?: number): SharedQuest | null => {
      const now = new Date();
      const made = devQuest(kind, localDateKey(now), me ?? 'a', now.getTime().toString(36).slice(-6));
      const quest = spot === undefined ? made : { ...made, spot };
      return transact<SharedQuest | null>((s) => {
        const items = s.quests?.items ?? [];
        const next = addQuest(items, quest);
        return next === items ? { state: s, result: null } : { state: withItems(s, next), result: quest };
      }, null);
    },
    [transact, me],
  );

  return useMemo(() => ({ helpQuest: help, spawnQuest: spawn }), [help, spawn]);
}
