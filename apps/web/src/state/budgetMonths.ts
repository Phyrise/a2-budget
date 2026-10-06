/**
 * Mois du budget : consulter n'écrit rien (V4).
 *
 * Le solde du compte commun additionne le net de chaque mois connu. Créer un
 * mois sur une simple consultation (« Mois précédent ») ajoutait donc son net
 * « par défaut » au report et changeait le solde du mois courant. Désormais :
 *
 * - seul le mois courant (calendrier) est créé à l'ouverture ou quand on y
 *   revient : c'est le mois que l'on vit ;
 * - un autre mois affiché sans enregistrement est **virtuel** : préparé à
 *   partir des réglages (`createMonthRecord`, ids des dépenses stables), il
 *   n'est écrit qu'à la première modification (`mapMonthOrCreate`).
 *
 * Fonctions pures (état de `@a2/core`), utilisées par le store.
 */
import {
  anchorBalance,
  createMonthRecord,
  currentMonthKey,
  ensureMonth,
  isValidMonthKey,
  type AppState,
  type MonthRecord,
  type PersistedState,
} from '@a2/core';

type MonthsSource = Pick<PersistedState, 'months' | 'settings'>;

/** Mois enregistré, ou mois virtuel préparé depuis les réglages (jamais écrit). */
export function monthOrVirtual(source: MonthsSource, monthKey: string): MonthRecord {
  return source.months.find((m) => m.monthKey === monthKey) ?? createMonthRecord(monthKey, source.settings);
}

/**
 * Applique `fn` au mois ; un mois virtuel est créé à cette première
 * modification (sauf si `fn` le rend inchangé). Clé invalide → même état.
 */
export function mapMonthOrCreate<S extends MonthsSource>(state: S, monthKey: string, fn: (m: MonthRecord) => MonthRecord): S {
  const index = state.months.findIndex((m) => m.monthKey === monthKey);
  if (index === -1) {
    if (!isValidMonthKey(monthKey)) return state;
    const virtual = createMonthRecord(monthKey, state.settings);
    const next = fn(virtual);
    if (next === virtual) return state;
    return { ...state, months: [...state.months, next] };
  }
  const current = state.months[index]!;
  const next = fn(current);
  if (next === current) return state;
  const months = state.months.slice();
  months[index] = next;
  return { ...state, months };
}

/**
 * Sélection d'un mois : le mois courant est créé s'il manque ; un autre
 * mois est seulement sélectionné (virtuel tant qu'on ne le modifie pas).
 */
export function selectBudgetMonth(state: PersistedState, monthKey: string, now: Date = new Date()): PersistedState {
  if (!isValidMonthKey(monthKey)) return state;
  if (monthKey === currentMonthKey(now)) return ensureMonth(state, monthKey);
  return state.selectedMonth === monthKey ? state : { ...state, selectedMonth: monthKey };
}

/**
 * Préparation du budget au chargement : crée le mois courant s'il est
 * affiché, et ancre le solde des données d'avant V4 (0 € au début du mois
 * courant, à confirmer : `anchorBalance`).
 */
export function prepareBudget(
  budget: AppState['budget'],
  now: Date,
  anchor: { id: string; recordedAt: string },
): AppState['budget'] {
  const persisted = selectBudgetMonth({ schemaVersion: 1, ...budget }, budget.selectedMonth, now);
  const next: AppState['budget'] =
    persisted.months === budget.months && persisted.selectedMonth === budget.selectedMonth
      ? budget
      : { ...budget, months: persisted.months, selectedMonth: persisted.selectedMonth };
  return anchorBalance(next, currentMonthKey(now), anchor);
}
