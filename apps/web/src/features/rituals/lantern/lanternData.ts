/**
 * Les sept lanternes de pierre (tōrō) : nom poétique et une ligne de
 * légende. Les ids et les seuils sont ceux de LANTERNS (@a2/core).
 */
import type { LanternDef } from '@a2/core';
import { NB, numberWords } from '../ritualText';

export interface LanternEntry {
  name: string;
  /** Nom court (bandeau). */
  short: string;
  line: string;
}

export const LANTERN_ENTRIES: Record<string, LanternEntry> = {
  'kasuga-moss': {
    short: 'la Kasuga',
    name: 'La Kasuga moussue',
    line: 'La toute première, couverte de mousse. Elle était là bien avant vous.',
  },
  yukimi: {
    short: 'Yukimi',
    name: 'Yukimi, la lanterne à neige',
    line: 'Basse, sur trois pieds, son large toit recueille la neige au bord de l’eau.',
  },
  oribe: {
    short: 'l’Oribe',
    name: 'L’Oribe du sous-bois',
    line: 'Plantée dans la terre comme un pieu, avec un petit gardien gravé à son pied.',
  },
  kotoji: {
    short: 'Kotoji',
    name: 'Kotoji, la harpe',
    line: 'Deux pieds inégaux, comme le chevalet d’une harpe : l’un dans l’eau, l’autre sur la pierre.',
  },
  'tachi-carved': {
    short: 'la haute lanterne',
    name: 'La haute lanterne gravée',
    line: 'Élancée, sculptée de daims et de nuages, elle garde le chemin.',
  },
  'ancient-shrine': {
    short: 'le vieux sanctuaire',
    name: 'La lanterne du vieux sanctuaire',
    line: 'Un toit lourd de lichen, une corde sacrée : des siècles de prières tranquilles.',
  },
  'spirit-light': {
    short: 'la lanterne des esprits',
    name: 'La lanterne des esprits',
    line: 'Les kodama l’ont choisie. Sa lumière n’a pas besoin de flamme.',
  },
};

export function lanternName(id: string): string {
  return LANTERN_ENTRIES[id]?.name ?? 'Une lanterne de pierre';
}

export function lanternShortName(id: string): string {
  const short = LANTERN_ENTRIES[id]?.short ?? 'la lanterne';
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** « après trois lanternes » (jamais un compteur : seulement le seuil). */
export function unlockWords(def: LanternDef): string {
  return def.unlockAt <= 1 ? `après une${NB}lanterne` : `après ${numberWords(def.unlockAt, true)} lanternes`;
}
