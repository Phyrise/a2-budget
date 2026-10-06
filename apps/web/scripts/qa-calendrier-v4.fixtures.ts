/**
 * Fixtures de la QA V4 Calendrier / Courses (servies par Vite, construites
 * par @a2/core, vérifiées par validateAppState) : une semaine de moments
 * (dont des notes), des tâches de la maison à date fixe (une faite il y a
 * trois jours, une du jour, une de demain, une mensuelle tour à tour, une
 * ponctuelle, une quotidienne qui ne doit pas apparaître) et une liste de
 * courses de huit articles.
 */
import {
  addDays,
  addEvent,
  addGroceryItem,
  createTask,
  emptyAppState,
  isoWeekday,
  localDateKey,
  toggleTaskToday,
  validateAppState,
  type AppState,
  type CalendarEvent,
  type CalendarEventDraft,
  type GroceryItem,
} from '@a2/core';

function build(): AppState {
  const now = new Date();
  const day = (delta: number) => localDateKey(addDays(now, delta));
  const wd = (delta: number) => isoWeekday(addDays(now, delta));
  const createdAt = now.toISOString();
  const drafts: CalendarEventDraft[] = [
    { title: 'Apéro avec Inès', date: day(0), time: '19:30', kind: 'repas', who: 'both', place: 'Le Perchoir', note: 'Inès apporte les olives\nRéserver la terrasse' },
    { title: 'Livraison du canapé', date: day(1), kind: 'maison', who: 'a', note: 'Entre 8 h et 13 h, code porte 4521' },
    { title: 'Ciné : Le Château ambulant', date: day(2), time: '21:00', endTime: '23:10', kind: 'sortie', who: 'both', place: 'Le Grand Rex' },
    { title: 'Calcifer', date: `1994${day(3).slice(4)}`, kind: 'anniversaire', who: 'both' },
    { title: 'Dîner chez Léa', date: day(5), time: '20:00', kind: 'repas', who: 'both', place: 'Montreuil' },
    { title: 'Marché bio', date: day(5), time: '10:00', kind: 'maison', who: 'a' },
    { title: 'Dentiste', date: day(9), time: '09:15', kind: 'rdv', who: 'b', place: 'Cabinet du Dr Martin' },
    { title: 'Week-end à Étretat', date: day(16), kind: 'voyage', who: 'both', note: 'Train de 8 h 12' },
  ];
  let events: CalendarEvent[] = [];
  let seq = 0;
  for (const draft of drafts) {
    const r = addEvent(events, { ...draft, id: `evt-${++seq}`, createdAt });
    if (!r.ok) throw new Error(`événement « ${draft.title} » refusé : ${r.reason}`);
    events = r.events;
  }

  const created = day(-20);
  const tasks = [
    createTask({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'b', recurrence: 'weekly', weeklyDay: wd(0) }, created),
    createTask({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: wd(1) }, created),
    createTask({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'weekly', weeklyDay: wd(-3), effort: 3 }, created),
    createTask(
      { id: 't-bouilloire', title: 'Détartrer la bouilloire', assignee: 'a', recurrence: 'monthly', monthlyDay: addDays(now, 4).getDate(), rotation: true },
      created,
    ),
    createTask({ id: 't-cles', title: 'Rendre les clés au syndic', assignee: 'b', recurrence: 'none' }, day(2)),
    createTask({ id: 't-vaisselle', title: 'Faire la vaisselle', assignee: 'both', recurrence: 'daily' }, created),
  ];

  let groceries: GroceryItem[] = [];
  const labels = ['2 pommes', 'lait x2', 'pain de campagne', 'tomates', '500 g de farine', 'liquide vaisselle', 'œufs x6', 'café'];
  labels.forEach((label, i) => {
    const r = addGroceryItem(groceries, label, { id: `g-${i}`, now: addDays(now, -1) });
    groceries = r.items;
  });

  const s = emptyAppState();
  let state: AppState = {
    ...s,
    chores: { ...s.chores, tasks },
    calendar: { events },
    groceries: { ...s.groceries, items: groceries },
  };
  // « Changer les draps » a été fait il y a trois jours : barré dans la grille.
  state = toggleTaskToday(state, 't-draps', addDays(now, -3), 'c-draps', { doneBy: 'both' }).state;
  return state;
}

const check = (name: string, s: AppState) => {
  const r = validateAppState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`fixture ${name} invalide : ${r.reason}`);
  return JSON.stringify(s);
};

(window as unknown as { __fixtures: Record<string, string> }).__fixtures = {
  empty: check('empty', emptyAppState()),
  busy: check('busy', build()),
};
