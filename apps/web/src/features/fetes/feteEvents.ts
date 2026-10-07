/**
 * Fêtes (V4.3) : petits signaux de fenêtre pour rejouer une fête à la demande
 * (panneau DEV, aperçus non persistants) et préférence locale « déjà vue »
 * (clé dédiée `a2-budget:fetes:v1`, comme `a2-budget:calendar:v1` :
 * `a2-budget:ui:v1` est réécrite en entier par la coquille).
 *
 * - `a2:fete` (detail 'a' | 'b') : la fête d'AL (Jiji) ou d'AC (Calcifer) ;
 * - `a2:train` : le train des eaux traverse la peinture du Budget.
 *
 * Lecture / écriture protégées (navigation privée, stockage bloqué) : sans
 * stockage, une fête peut se rejouer à la prochaine ouverture, rien de plus.
 * Jamais `localStorage.clear()`.
 */
import { useEffect, useRef } from 'react';

const KEY = 'a2-budget:fetes:v1';
const PARTY = 'a2:fete';
const TRAIN = 'a2:train';

export type PartyWho = 'a' | 'b';

interface FetePrefs {
  /** Dernier jour « YYYY-MM-DD » où la fête d'anniversaire a été montrée. */
  partySeen?: string;
  /** Dernier mois « YYYY-MM » où le train est passé. */
  trainSeen?: string;
}

function read(): FetePrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return {};
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(typeof v.partySeen === 'string' ? { partySeen: v.partySeen } : {}),
      ...(typeof v.trainSeen === 'string' ? { trainSeen: v.trainSeen } : {}),
    };
  } catch {
    return {};
  }
}

function write(patch: FetePrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch {
    // Stockage indisponible : vaut pour cette session.
  }
}

/** Première fois aujourd'hui (et la marque comme vue) : vrai une seule fois par jour. */
export function claimPartyDay(dayKey: string): boolean {
  if (read().partySeen === dayKey) return false;
  write({ partySeen: dayKey });
  return true;
}

/** Première ouverture du mois (et la marque) : vrai une seule fois par mois. */
export function claimTrainMonth(monthKey: string): boolean {
  if (read().trainSeen === monthKey) return false;
  write({ trainSeen: monthKey });
  return true;
}

export function playParty(who: PartyWho): void {
  window.dispatchEvent(new CustomEvent<PartyWho>(PARTY, { detail: who }));
}

export function playTrain(): void {
  window.dispatchEvent(new Event(TRAIN));
}

function useWindowEvent(name: string, handler: (event: Event) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (event: Event) => ref.current(event);
    window.addEventListener(name, on);
    return () => window.removeEventListener(name, on);
  }, [name]);
}

/** Fête demandée par le panneau DEV. */
export function usePartyRequest(handler: (who: PartyWho) => void): void {
  useWindowEvent(PARTY, (event) => {
    const who = (event as CustomEvent<unknown>).detail;
    if (who === 'a' || who === 'b') handler(who);
  });
}

/** Train demandé par le panneau DEV. */
export function useTrainRequest(handler: () => void): void {
  useWindowEvent(TRAIN, handler);
}
