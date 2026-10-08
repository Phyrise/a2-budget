/**
 * Labo Noiraudes — l'état du panneau « Réglages » : paramètres courants,
 * trois mémoires (A, B, C), panneau ouvert ou replié, onglet. Gardé dans le
 * localStorage de ce téléphone (relu prudemment : un stockage absent,
 * plein ou abîmé ne casse rien, on repart du modèle par défaut). Les
 * réglages enregistrés avant l'ajout d'un paramètre le reçoivent à sa valeur
 * par défaut (normalizeParams).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SOOT_PARAMS, cloneParams, normalizeParams, type SootSpriteParams } from '../../../creatures/susuwatari';
import { TABS, type TuneTab } from './paramSpecs';

export const TUNING_KEY = 'a2-budget:noiraudes-lab:v1';
export const SLOTS = ['A', 'B', 'C'] as const;
export type Slot = (typeof SLOTS)[number];

interface TuningState {
  params: SootSpriteParams;
  slots: Partial<Record<Slot, SootSpriteParams>>;
  open: boolean;
  tab: TuneTab;
}

function load(): TuningState {
  const fresh: TuningState = { params: cloneParams(DEFAULT_SOOT_PARAMS), slots: {}, open: false, tab: 'hair' };
  try {
    const raw = window.localStorage.getItem(TUNING_KEY);
    if (!raw) return fresh;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const slots: TuningState['slots'] = {};
    const stored = (typeof data.slots === 'object' && data.slots !== null ? data.slots : {}) as Record<string, unknown>;
    for (const s of SLOTS) if (stored[s]) slots[s] = normalizeParams(stored[s]);
    return {
      params: normalizeParams(data.params),
      slots,
      open: data.open === true,
      tab: TABS.some((t) => t.id === data.tab) ? (data.tab as TuneTab) : fresh.tab,
    };
  } catch {
    return fresh;
  }
}

function save(state: TuningState): void {
  try {
    window.localStorage.setItem(TUNING_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée, quota) : les réglages valent pour la visite.
  }
}

export interface Tuning {
  params: SootSpriteParams;
  setParams: (p: SootSpriteParams) => void;
  reset: () => void;
  slots: Partial<Record<Slot, SootSpriteParams>>;
  remember: (slot: Slot) => void;
  recall: (slot: Slot) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: TuneTab;
  setTab: (tab: TuneTab) => void;
}

export function useTuning(): Tuning {
  const [state, setState] = useState(load);
  const latest = useRef(state);
  latest.current = state;

  // Écrit peu après chaque changement (un glissé de curseur = une écriture),
  // et tout de suite si la page se cache ou se ferme.
  useEffect(() => {
    const id = window.setTimeout(() => save(state), 150);
    return () => window.clearTimeout(id);
  }, [state]);
  useEffect(() => {
    const flush = () => save(latest.current);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const setParams = useCallback((params: SootSpriteParams) => setState((s) => ({ ...s, params })), []);
  const reset = useCallback(() => setState((s) => ({ ...s, params: cloneParams(DEFAULT_SOOT_PARAMS) })), []);
  const remember = useCallback((slot: Slot) => setState((s) => ({ ...s, slots: { ...s.slots, [slot]: cloneParams(s.params) } })), []);
  const recall = useCallback(
    (slot: Slot) =>
      setState((s) => {
        const saved = s.slots[slot];
        return saved ? { ...s, params: cloneParams(saved) } : s;
      }),
    [],
  );
  const setOpen = useCallback((open: boolean) => setState((s) => ({ ...s, open })), []);
  const setTab = useCallback((tab: TuneTab) => setState((s) => ({ ...s, tab })), []);

  return useMemo(
    () => ({ ...state, setParams, reset, remember, recall, setOpen, setTab }),
    [state, setParams, reset, remember, recall, setOpen, setTab],
  );
}
