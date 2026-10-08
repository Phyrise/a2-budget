/**
 * Projection « entité par entité » : AppState → documents (sans
 * métadonnées serveur). Chaque liste de l'état devient une collection
 * (ids existants, rang `order`) ; les réglages deviennent des documents
 * uniques. La forêt n'y est pas : elle se déduit des faits (replay).
 *
 * Jamais synchronisé : `budget.selectedMonth` et toutes les préférences
 * d'interface (elles vivent hors de AppState, par téléphone).
 *
 * Fonctions pures. `known` = documents déjà écrits (rangs, jour local et clé
 * de crédit des faits) : une liste inchangée redonne exactement les mêmes
 * documents.
 */

import {
  allocateOrders,
  completionFact,
  monthToDoc,
  settingsToDoc,
  type AppState,
} from '@a2/core';
import {
  clean,
  docKey,
  isPlainRecord,
  SETTINGS_ANNIVERSARIES,
  SETTINGS_BUDGET,
  SETTINGS_FOCUS,
  SETTINGS_GROCERY_MEMORY,
  type CollectionName,
  type DocData,
  type DocKey,
  type DocStore,
} from './docs';
import { QUESTS, questList } from './quests';

/** Une liste de l'état vue comme collection. */
export interface ListSpec {
  collection: CollectionName;
  /** Fait (jamais supprimé, seule l'annulation) ou objet (dernier qui écrit gagne). */
  fact: boolean;
  /** Ajout = remplacement complet (le dernier arrivé gagne) plutôt que « créer si absent ». */
  replaceOnAdd?: boolean;
  /** La liste (même référence si rien n'a changé). */
  list(state: AppState): readonly object[] | undefined;
  id(item: object): string;
  /** Données du document, sans `order`. */
  data(item: object, state: AppState, known: DocData | undefined): DocData;
}

function spec<T extends object>(s: {
  collection: CollectionName;
  fact: boolean;
  replaceOnAdd?: boolean;
  list(state: AppState): readonly T[] | undefined;
  id(item: T): string;
  data?(item: T, state: AppState, known: DocData | undefined): DocData;
}): ListSpec {
  return {
    ...s,
    data: s.data ?? ((item: T) => ({ ...item }) as DocData),
  } as ListSpec;
}

/** Les listes synchronisées, dans l'ordre d'écriture d'un lot. */
export const LIST_SPECS: readonly ListSpec[] = [
  spec({ collection: 'tasks', fact: false, list: (s) => s.chores.tasks, id: (t) => t.id }),
  spec({
    collection: 'completions',
    fact: true,
    list: (s) => s.chores.completions,
    id: (c) => c.id,
    data: (c, s, known) => {
      const fact = completionFact(c, s.chores.tasks.find((t) => t.id === c.taskId));
      const out: DocData = {
        ...c,
        localDay: typeof known?.localDay === 'string' ? known.localDay : fact.localDay,
        creditKey: typeof known?.creditKey === 'string' ? known.creditKey : fact.creditKey,
      };
      if (known?.imported === true) out.imported = true;
      return out;
    },
  }),
  spec({ collection: 'skips', fact: true, list: (s) => s.chores.skips, id: (k) => k.id }),
  spec({ collection: 'focusSessions', fact: true, list: (s) => s.focus?.sessions, id: (f) => f.id }),
  spec({ collection: 'groceries', fact: false, list: (s) => s.groceries.items, id: (g) => g.id }),
  spec({ collection: 'groceryHistory', fact: true, list: (s) => s.groceries.history, id: (p) => p.id }),
  spec({ collection: 'events', fact: false, list: (s) => s.calendar?.events, id: (e) => e.id }),
  // Ajout = remplacement : une part du cercle (id déterministe, V5.2) peut
  // être écrite par deux appareils du même rôle ; le dernier gagne.
  spec({ collection: 'circles', fact: false, replaceOnAdd: true, list: (s) => s.rituals?.circles, id: (c) => c.id }),
  spec({
    collection: 'months',
    fact: false,
    list: (s) => s.budget.months,
    id: (m) => m.monthKey,
    data: (m, _s, known) => ({ ...monthToDoc(m, known) }),
  }),
  spec({
    collection: 'balanceCorrections',
    fact: false,
    replaceOnAdd: true,
    list: (s) => s.budget.balance?.corrections,
    id: (c) => c.monthKey,
  }),
  // V5.1 — quêtes communes (sync/quests.ts)
  spec({ collection: QUESTS, fact: false, list: questList, id: (q) => q.id }),
];

/** Un document unique (réglages), toujours présent (vide = « absent »). */
export interface SingletonSpec {
  id: string;
  /** Sources dans l'état (mêmes références si rien n'a changé). */
  sources(state: AppState): readonly unknown[];
  data(state: AppState, known: DocData | undefined): DocData;
}

function memoryDoc(memory: Record<string, string> | undefined, known: DocData | undefined): DocData {
  const keys = Object.keys(memory ?? {});
  const before = isPlainRecord(known?.memory) ? known.memory : {};
  const orders = allocateOrders(keys, (key) => {
    const entry = before[key];
    return isPlainRecord(entry) && typeof entry.order === 'number' ? entry.order : undefined;
  });
  const out: Record<string, DocData> = {};
  keys.forEach((key, i) => {
    out[key] = { category: memory![key], order: orders[i]! };
  });
  return { memory: out };
}

export const SINGLETON_SPECS: readonly SingletonSpec[] = [
  {
    id: SETTINGS_BUDGET,
    sources: (s) => [s.budget.settings, s.budget.balance === undefined],
    data: (s, known) => ({
      ...settingsToDoc(s.budget.settings, known),
      ...(s.budget.balance !== undefined ? { balanceTracked: true } : {}),
    }),
  },
  {
    id: SETTINGS_FOCUS,
    sources: (s) => [s.focus?.selectedLantern],
    data: (s) => (s.focus?.selectedLantern !== undefined ? { selectedLantern: s.focus.selectedLantern } : {}),
  },
  {
    id: SETTINGS_GROCERY_MEMORY,
    sources: (s) => [s.groceries.categoryMemory],
    data: (s, known) => memoryDoc(s.groceries.categoryMemory, known),
  },
  {
    id: SETTINGS_ANNIVERSARIES,
    sources: (s) => [s.anniversaries],
    data: (s) => (s.anniversaries !== undefined ? { ...s.anniversaries } : {}),
  },
];

/** Documents d'une liste : clé → données (avec `order`). */
export function listDocs(spec: ListSpec, state: AppState, known: DocStore): Map<DocKey, DocData> {
  const items = spec.list(state) ?? [];
  const ids = items.map((item) => spec.id(item));
  const orders = allocateOrders(ids, (id) => {
    const order = known.get(docKey(spec.collection, id))?.order;
    return typeof order === 'number' ? order : undefined;
  });
  const out = new Map<DocKey, DocData>();
  items.forEach((item, i) => {
    const key = docKey(spec.collection, ids[i]!);
    out.set(key, clean({ ...spec.data(item, state, known.get(key)), order: orders[i]! }));
  });
  return out;
}

/** Données d'un document unique. */
export function singletonDoc(spec: SingletonSpec, state: AppState, known: DocStore): DocData {
  return clean(spec.data(state, known.get(docKey('settings', spec.id))));
}

/** Tous les documents d'entité de l'état (sans la forêt ni les métadonnées serveur). Pur. */
export function entityDocs(state: AppState, known: DocStore = new Map()): Map<DocKey, DocData> {
  const out = new Map<DocKey, DocData>();
  for (const spec of LIST_SPECS) for (const [key, data] of listDocs(spec, state, known)) out.set(key, data);
  for (const spec of SINGLETON_SPECS) out.set(docKey('settings', spec.id), singletonDoc(spec, state, known));
  return out;
}
