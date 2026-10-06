/**
 * Les sept lanternes de pierre (tōrō) : nom poétique et une ligne de
 * légende. Les ids et les seuils sont ceux de LANTERNS (@a2/core).
 */
import { LANTERNS, type LanternDef } from '@a2/core';
import { NB, numberWords } from '../ritualText';

export interface LanternEntry {
  name: string;
  line: string;
}

export const LANTERN_ENTRIES: Record<string, LanternEntry> = {
  'kasuga-moss': {
    name: 'La Kasuga moussue',
    line: 'La toute première, couverte de mousse. Elle était là bien avant vous.',
  },
  yukimi: {
    name: 'Yukimi, la lanterne à neige',
    line: 'Basse, sur trois pieds, son large toit recueille la neige au bord de l’eau.',
  },
  oribe: {
    name: 'L’Oribe du sous-bois',
    line: 'Plantée dans la terre comme un pieu, avec un petit gardien gravé à son pied.',
  },
  kotoji: {
    name: 'Kotoji, la harpe',
    line: 'Deux pieds inégaux, comme le chevalet d’une harpe : l’un dans l’eau, l’autre sur la pierre.',
  },
  'tachi-carved': {
    name: 'La haute lanterne gravée',
    line: 'Élancée, sculptée de daims et de nuages, elle garde le chemin.',
  },
  'ancient-shrine': {
    name: 'La lanterne du vieux sanctuaire',
    line: 'Un toit lourd de lichen, une corde sacrée : des siècles de prières tranquilles.',
  },
  'spirit-light': {
    name: 'La lanterne des esprits',
    line: 'Les kodama l’ont choisie. Sa lumière n’a pas besoin de flamme.',
  },
};

export function lanternName(id: string): string {
  return LANTERN_ENTRIES[id]?.name ?? 'Une lanterne de pierre';
}

export function lanternDef(id: string): LanternDef | undefined {
  return LANTERNS.find((l) => l.id === id);
}

/** « après trois lanternes » (jamais un compteur : seulement le seuil). */
export function unlockWords(def: LanternDef): string {
  return def.unlockAt <= 1 ? `après une${NB}lanterne` : `après ${numberWords(def.unlockAt, true)} lanternes`;
}
