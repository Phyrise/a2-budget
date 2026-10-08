/**
 * Fêtes (V4.3) : petits signaux de fenêtre pour rejouer une fête à la demande
 * (panneau DEV, aperçus non persistants) et préférence locale « déjà vue »
 * (clé dédiée `a2-budget:fetes:v1`, comme `a2-budget:calendar:v1` :
 * `a2-budget:ui:v1` est réécrite en entier par la coquille).
 *
 * - `a2:fete` (detail 'a' | 'b') : la fête d'AL (Jiji) ou d'AC (Calcifer).
 *
 * Lecture / écriture protégées (navigation privée, stockage bloqué) : sans
 * stockage, une fête peut se rejouer à la prochaine ouverture, rien de plus.
 * Jamais `localStorage.clear()`.
 */
import { useEffect, useRef } from 'react';

const KEY = 'a2-budget:fetes:v1';
const PARTY = 'a2:fete';

export type PartyWho = 'a' | 'b';

interface FetePrefs {
  /** Dernier jour « YYYY-MM-DD » où la fête d'anniversaire a été montrée. */
  partySeen?: string;
}

function read(): FetePrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return {};
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(typeof v.partySeen === 'string' ? { partySeen: v.partySeen } : {}),
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

export function playParty(who: PartyWho): void {
  window.dispatchEvent(new CustomEvent<PartyWho>(PARTY, { detail: who }));
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
