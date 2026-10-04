/**
 * Le carnet de la forêt : noms poétiques et légendes des créatures, noms des
 * stades du cèdre. Les ids des créatures sont ceux de CREATURES (@a2/core).
 */

export interface CreatureEntry {
  id: string;
  name: string;
  legend: string;
}

/** Les kodama sont toujours là : ils ouvrent le carnet. */
export const KODAMA: CreatureEntry = {
  id: 'kodama',
  name: 'Les kodama',
  legend: 'Les esprits des arbres. Ils étaient là bien avant vous, et tournent la tête quand une lumière se pose.',
};

export const CREATURE_ENTRIES: Record<string, Omit<CreatureEntry, 'id'>> = {
  'moss-ling': {
    name: 'Boule-de-Mousse',
    legend: 'Elle dort entre les racines du cèdre et n’ouvre un œil que pour les gestes faits avec soin.',
  },
  'seed-spirit': {
    name: 'Graine-Lueur',
    legend: 'Une graine qui garde un peu de lumière en réserve, pour les jours gris.',
  },
  'leaf-sprite': {
    name: 'Fil-de-Lucioles',
    legend: 'Un souffle de petites lueurs qui suit le vent. Il aime les maisons où l’on s’entraide.',
  },
  'ember-wisp': {
    name: 'Brume-qui-Veille',
    legend: 'Deux yeux sombres dans la brume. Elle veille sur la clairière quand tout le monde dort.',
  },
  'mushroom-pip': {
    name: 'Petit-Chapeau',
    legend: 'Timide comme un champignon après la pluie. Il pousse là où l’on a pris le temps.',
  },
  'water-drip': {
    name: 'Faon des Sources',
    legend: 'Il vient boire au ruisseau quand la forêt est en paix. Approchez sans bruit.',
  },
};

export const STAGE_NAMES: Record<number, string> = {
  1: 'La pousse',
  2: 'Le jeune cèdre',
  3: 'Premières branches',
  4: 'La ramure',
  5: 'Le grand cèdre',
  6: 'L’ancien',
  7: 'Le millénaire',
};
