/**
 * Magasin du jeu des Noiraudes : bocal de kompeitō et compteur, derrière
 * une interface (`PlayBackend`) qu'on branchera plus tard sur l'état partagé
 * synchronisé. Aujourd'hui : stockage LOCAL, clé dédiée `a2-budget:play:v1`
 * (jamais dans l'AppState ; `a2-budget:ui:v1` appartient à la coquille),
 * lecture et écriture protégées (sans stockage : l'état vaut pour la session).
 *
 * L'interface : lire (`getPlay`, `usePlay`) et faire un geste (`playGive`,
 * `playSpend`, `playCatch`). Chaque geste est un delta appliqué tout de
 * suite ici (affichage immédiat) puis confié au backend.
 *
 * Pour brancher l'état partagé (après la V5) : écrire un backend dont
 * `record(gesture)` envoie un INCRÉMENT atomique (jar += n, caught += 1…) au
 * document partagé du couple, et dont `subscribe` pousse l'état reçu (les
 * gestes de l'autre téléphone compris) ; puis `setPlayBackend(backend)`.
 * Piège : ne compter que ses propres gestes. Les +1 viennent des gestes
 * faits ici (case cochée, soin fait, Noiraude attrapée), jamais d'un
 * changement d'état observé : sinon un virement coché sur un téléphone,
 * synchronisé sur l'autre, y ajouterait un second kompeitō.
 */
import { useSyncExternalStore } from 'react';
import { START_STATE, applyGesture, canSpend, parsePlay, type GiveCause, type PlayGesture, type PlayState } from './play';

export interface PlayBackend {
  /** État de départ (null : rien d'enregistré). */
  load(): PlayState | null;
  /** Enregistre un geste fait ICI ; `next` est l'état local après le geste. */
  record(gesture: PlayGesture, next: PlayState): void;
  /** État reçu d'ailleurs (l'autre téléphone) ; rend la fonction de désabonnement. */
  subscribe?(onState: (state: PlayState) => void): () => void;
}

const KEY = 'a2-budget:play:v1';
/** Ancien compteur (V4.2) : repris une fois si la nouvelle clé est absente. */
const LEGACY_KEY = 'a2-budget:susuwatari:v1';

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export const localPlayBackend: PlayBackend = {
  load() {
    const stored = parsePlay(readJson(KEY));
    if (stored) return stored;
    const legacy = readJson(LEGACY_KEY) as { caught?: unknown } | null;
    const caught = legacy?.caught;
    if (typeof caught === 'number' && Number.isInteger(caught) && caught > 0) return { ...START_STATE, caught };
    return null;
  },
  record(_gesture, next) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ v: 1, ...next }));
    } catch {
      // Stockage indisponible : l'état vaut pour cette session.
    }
  },
};

let backend: PlayBackend = localPlayBackend;
let current: PlayState | null = null;
let unsubscribe: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function getPlay(): PlayState {
  if (current === null) current = backend.load() ?? { ...START_STATE };
  return current;
}

/** Change de backend (état partagé synchronisé) ; relit son état. */
export function setPlayBackend(next: PlayBackend): void {
  unsubscribe?.();
  backend = next;
  current = null;
  unsubscribe =
    next.subscribe?.((state) => {
      current = state;
      notify();
    }) ?? null;
  notify();
}

function gesture(g: PlayGesture): PlayState {
  const before = getPlay();
  const next = applyGesture(before, g);
  if (next === before) return before;
  current = next;
  backend.record(g, next);
  notify();
  return next;
}

/** Le bocal reçoit `n` kompeitō (geste fait ici). */
export function playGive(n: number, cause: GiveCause): void {
  gesture({ kind: 'give', n, cause });
}

/** Dépense un kompeitō ; faux si le bocal est vide. */
export function playSpend(n = 1): boolean {
  if (!canSpend(getPlay(), n)) return false;
  gesture({ kind: 'spend', n });
  return true;
}

/** Une Noiraude attrapée (dorée : +5 kompeitō). */
export function playCatch(golden = false): void {
  gesture({ kind: 'catch', golden });
}

export function subscribePlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlay(): PlayState {
  return useSyncExternalStore(subscribePlay, getPlay, getPlay);
}

/** Tests : oublie l'état en mémoire (relu au prochain accès). */
export function resetPlayForTests(next: PlayBackend = localPlayBackend): void {
  unsubscribe?.();
  unsubscribe = null;
  backend = next;
  current = null;
}
