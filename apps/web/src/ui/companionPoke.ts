/**
 * Toucher un compagnon, pour rien, juste pour le plaisir (V4.3).
 *
 * - Un toucher : petite réaction (Calcifer crépite et s'élève, Jiji penche
 *   la tête et balance la queue). Anti-rafale : une réaction en cours n'est
 *   jamais relancée, les touchers sont seulement comptés.
 * - Touché trop souvent (≥ 4 fois en 2 s) : Calcifer s'énerve (flamme plus
 *   haute et rouge-orangé, tremblement, bouffée de fumée, grognement), Jiji
 *   boude (il se détourne), puis ils se calment ; pendant ce temps, plus
 *   aucune réaction.
 * - Calme (prefers-reduced-motion, ou Forêt « Immobile ») : la pose et la
 *   couleur changent, rien ne bouge. Sons seulement si les petits sons sont
 *   permis (playCue).
 *
 * Logique pure (`pokeStep`, testée) + hook. Le mode développeur déclenche
 * une réaction sur les compagnons montés (`previewPoke`), sans rien écrire.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readPrefs } from '../app/prefs';
import { playCue } from '../app/sound/play';
import type { CompanionMood } from '../world/types';

export type PokeKind = 'poke' | 'upset';
export type PokeWho = 'a' | 'b';

export interface PokeState {
  kind: PokeKind | null;
  /** Fin de la réaction en cours (ms, horloge monotone). */
  until: number;
  /** Touchers récents (rafale). */
  taps: readonly number[];
  /** Compteur de réactions (une nouvelle réaction = n + 1). */
  n: number;
}

export const IDLE_POKE: PokeState = { kind: null, until: 0, taps: [], n: 0 };
export const POKE_MS = 760;
export const UPSET_MS = 2800;
export const BURST = { taps: 4, windowMs: 2000 } as const;

/** Un toucher à l'instant `now` (ms). */
export function pokeStep(s: PokeState, now: number): PokeState {
  const active = s.kind !== null && now < s.until;
  if (active && s.kind === 'upset') return s;
  const taps = [...s.taps.filter((t) => now - t < BURST.windowMs), now];
  if (taps.length >= BURST.taps) return { kind: 'upset', until: now + UPSET_MS, taps: [], n: s.n + 1 };
  if (active) return { ...s, taps };
  return { kind: 'poke', until: now + POKE_MS, taps, n: s.n + 1 };
}

/** La réaction terminée laisse place à l'humeur du moment. */
export function pokeSettle(s: PokeState, now: number): PokeState {
  return s.kind !== null && now >= s.until ? { ...s, kind: null } : s;
}

/** Pose peinte pendant la réaction (planches v3 : aucune pose « fâché ») ; null = l'humeur du moment. */
export function pokeMood(who: PokeWho, kind: PokeKind | null): CompanionMood | null {
  if (kind === 'poke') return who === 'b' ? 'happy' : 'curious';
  if (kind === 'upset') return who === 'b' ? 'proud' : 'idle';
  return null;
}

function calmNow(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || readPrefs().forestMotion === 'still';
  } catch {
    return false;
  }
}

function sound(who: PokeWho, kind: PokeKind) {
  if (who !== 'b') return;
  playCue(kind === 'upset' ? 'grumble' : 'crackle');
}

const PREVIEW_EVENT = 'a2:companion-poke';

/** Mode développeur : la réaction voulue sur chaque compagnon touchable monté. */
export function previewPoke(who: PokeWho, kind: PokeKind) {
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: { who, kind } }));
}

export function useCompanionPoke(who: PokeWho | null) {
  const [state, setState] = useState<PokeState>(IDLE_POKE);
  const [calm, setCalm] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  const apply = useCallback(
    (next: PokeState) => {
      const prev = ref.current;
      if (next === prev) return;
      ref.current = next;
      setState(next);
      if (who && next.kind && next.n !== prev.n) {
        setCalm(calmNow());
        sound(who, next.kind);
      }
    },
    [who],
  );

  const poke = useCallback(() => apply(pokeStep(ref.current, performance.now())), [apply]);

  // Fin de la réaction.
  useEffect(() => {
    if (state.kind === null) return;
    const t = window.setTimeout(() => apply(pokeSettle(ref.current, performance.now())), Math.max(0, state.until - performance.now()) + 16);
    return () => window.clearTimeout(t);
  }, [state, apply]);

  useEffect(() => {
    if (!who) return;
    const onPreview = (e: Event) => {
      const d = (e as CustomEvent<{ who: PokeWho; kind: PokeKind }>).detail;
      if (d?.who !== who) return;
      const now = performance.now();
      apply({ kind: d.kind, until: now + (d.kind === 'upset' ? UPSET_MS : POKE_MS), taps: [], n: ref.current.n + 1 });
    };
    window.addEventListener(PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(PREVIEW_EVENT, onPreview);
  }, [who, apply]);

  return { kind: state.kind, n: state.n, calm, poke };
}
