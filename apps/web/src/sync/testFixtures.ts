/**
 * Données de test du pont (jamais importées par l'app) : un foyer complet
 * construit avec les vraies transitions de @a2/core, et des helpers pour
 * jouer des gestes comme le ferait le store.
 */

import {
  addEvent,
  addFocusSession,
  addGroceryItem,
  advanceDay,
  clearDoneGroceries,
  createMonthRecord,
  createTask,
  emptyAppState,
  localDateKey,
  pauseForest,
  recordBalanceCorrection,
  rememberGroceryCategory,
  resumeForest,
  saveCircle,
  selectLantern,
  setExpensePaid,
  setTransferPaid,
  skipOccurrence,
  toggleGroceryItem,
  toggleTaskToday,
  validateAppState,
  withAnniversaries,
  type AppState,
  type ChoreDoer,
} from '@a2/core';

/** Jeudi 8 octobre 2026 (heure locale). */
export const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
export const NOW = at(8, 20);

let seq = 0;
export const testId = (prefix = 'id') => `${prefix}-${String((seq += 1)).padStart(4, '0')}`;

/** Bascule de tâche du jour (comme toggleHomeTask). */
export function toggle(s: AppState, taskId: string, when: Date, doneBy?: ChoreDoer): AppState {
  return toggleTaskToday(s, taskId, when, testId('c'), doneBy !== undefined ? { doneBy } : {}).state;
}

/** « Mettre en pause » / « Réveiller » (comme toggleHomePause). */
export function togglePause(s: AppState, when: Date): AppState {
  const day = localDateKey(when);
  const forest = s.forest.paused ? resumeForest(s.forest, day) : pauseForest(advanceDay(s.forest, day), day);
  return { ...s, forest };
}

/** Ajout aux courses (comme addGrocery). */
export function addGrocery(s: AppState, label: string, when: Date, by: 'a' | 'b'): AppState {
  const r = addGroceryItem(s.groceries.items, label, { id: testId('g'), now: when, addedBy: by });
  return { ...s, groceries: { ...s.groceries, items: r.items } };
}

/** Valide et normalise (forme rechargée). */
export function canonical(s: AppState): AppState {
  const r = validateAppState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`état invalide : ${r.reason}`);
  return r.state;
}

/** Un foyer bien rempli : budget, solde, tâches, faits, forêt, courses, calendrier, cercle, lanternes. */
export function richState(): AppState {
  let s = withAnniversaries(emptyAppState());
  s = { ...s, budget: { ...s.budget, selectedMonth: '2026-10' } };
  const tasks = [
    createTask({ id: 'plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily' }, '2026-09-20'),
    createTask({ id: 'draps', title: 'Changer les draps', assignee: 'b', recurrence: 'weekly', weeklyDay: 4, flexible: true, effort: 3 }, '2026-09-20'),
    createTask({ id: 'vaisselle', title: 'Vaisselle', assignee: 'a', recurrence: 'daily', rotation: true, effort: 2 }, '2026-09-20'),
    createTask({ id: 'rideaux', title: 'Laver les rideaux', assignee: 'both', recurrence: 'none' }, '2026-10-08'),
    createTask({ id: 'factures', title: 'Classer les factures', assignee: 'unassigned', recurrence: 'monthly', monthlyDay: 31 }, '2026-09-20'),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  s = toggle(s, 'plantes', at(1, 9));
  s = toggle(s, 'vaisselle', at(1, 21));
  s = toggle(s, 'plantes', at(2, 9), 'b');
  s = togglePause(s, at(3, 8));
  s = togglePause(s, at(5, 8));
  s = toggle(s, 'draps', at(6, 10));
  s = toggle(s, 'plantes', at(7, 9));
  s = toggle(s, 'plantes', at(7, 9, 5)); // décochée
  s = toggle(s, 'vaisselle', at(8, 21));
  s = toggle(s, 'rideaux', at(8, 15), 'both');
  const skip = skipOccurrence(s.chores.skips, { id: 'k1', taskId: 'plantes', dueDate: '2026-10-08', at: at(8, 7).toISOString(), by: 'b' });
  s = { ...s, chores: { ...s.chores, skips: skip.skips }, forest: advanceDay(s.forest, localDateKey(NOW)) };

  const september = createMonthRecord('2026-09', s.budget.settings);
  let october = createMonthRecord('2026-10', s.budget.settings);
  october = setExpensePaid(setTransferPaid(october, 'B', true), 'rent', true);
  october = { ...october, salaryACents: 231_000, bonusBCents: 18_000, expenses: [...october.expenses, { id: 'cine', label: 'Cinéma', amountCents: 2_400 }] };
  let budget: AppState['budget'] = { ...s.budget, months: [september, october] };
  budget = recordBalanceCorrection(budget, '2026-09', 154_000, { id: 'bal-09', recordedAt: at(1, 12).toISOString(), note: 'Relevé' });
  s = { ...s, budget };

  let items = s.groceries.items;
  for (const [label, by] of [['2 pommes', 'a'], ['Lait', 'b'], ['Pain', 'a'], ['Liquide vaisselle', 'b']] as const) {
    items = addGroceryItem(items, label, { id: testId('g'), now: at(7, 18), addedBy: by }).items;
  }
  items = toggleGroceryItem(items, items[2]!.id, at(7, 19));
  let groceries = clearDoneGroceries({ ...s.groceries, items }, at(7, 20));
  groceries = { ...groceries, items: toggleGroceryItem(groceries.items, groceries.items[0]!.id, at(8, 10)) };
  groceries = { ...groceries, categoryMemory: rememberGroceryCategory(rememberGroceryCategory(undefined, 'Lait', 'frais'), 'Café moulu', 'epicerie') };
  s = { ...s, groceries };

  const event = addEvent([], { id: 'ev1', createdAt: at(2, 9).toISOString(), title: 'Dîner chez Léa', date: '2026-10-10', time: '20:00', kind: 'repas', place: 'Lyon' });
  if (!event.ok) throw new Error(event.reason);
  const birthday = addEvent(event.events, { id: 'ev2', createdAt: at(2, 9).toISOString(), title: 'Mamie', date: '1950-03-29', kind: 'anniversaire', yearKnown: true });
  if (!birthday.ok) throw new Error(birthday.reason);
  s = { ...s, calendar: { events: birthday.events } };

  s = {
    ...s,
    rituals: saveCircle(undefined, {
      id: 'cercle-1', weekStart: '2026-10-05', heldAt: at(5, 21).toISOString(),
      gratitude: [{ from: 'a', to: 'b', text: 'Merci pour le dîner' }],
      burdens: [{ who: 'b', text: 'Le linge' }],
      intentions: ['Plier ensemble'],
    }),
  };
  let focus = s.focus;
  for (let i = 0; i < 4; i += 1) {
    focus = addFocusSession(focus, { id: `f${i}`, startedAt: at(2 + i, 18).toISOString(), minutes: 10 + i, who: i % 2 === 0 ? 'a' : 'b', ...(i === 1 ? { label: 'Rangement' } : {}) }).focus;
  }
  focus = selectLantern(focus, 'yukimi').focus;
  s = { ...s, focus };
  return canonical(s);
}
