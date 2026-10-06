/**
 * Fixtures de la QA MONDE V4 (servies par Vite, construites par @a2/core) :
 * une Maison réaliste avec une longue liste du jour (pour défiler jusqu'à
 * recouvrir la forêt), quelques tâches déjà faites, et 4 sessions de
 * lanterne terminées : la lanterne « yukimi » est débloquée et choisie.
 * Chaque état est vérifié par validateAppState.
 */
import {
  addDays,
  addFocusSession,
  createTask,
  emptyAppState,
  localDateKey,
  selectLantern,
  toggleTaskToday,
  validateAppState,
  type AppState,
  type HouseholdTask,
} from '@a2/core';

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;
const at = (base: Date, h: number, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);

const TITLES: [string, HouseholdTask['assignee']][] = [
  ['Arroser les plantes', 'a'],
  ['Vider le lave-vaisselle', 'b'],
  ['Nourrir le chat', 'both'],
  ['Plier le linge', 'b'],
  ['Ranger l’entrée', 'a'],
  ['Essuyer la table', 'b'],
  ['Aérer les chambres', 'a'],
  ['Préparer le déjeuner', 'both'],
  ['Trier le courrier', 'a'],
  ['Arroser le balcon', 'b'],
  ['Brosser le chat', 'a'],
  ['Remplir la carafe', 'b'],
];

function build(lantern: boolean): AppState {
  const now = new Date();
  let s = emptyAppState();
  const created = localDateKey(addDays(now, -30));
  const tasks = TITLES.map(([title, assignee]) => createTask({ id: id('t'), title, assignee, recurrence: 'daily' }, created));
  s.chores.tasks = tasks;
  // Quelques jours passés (forêt qui a un peu poussé).
  for (let d = 14; d >= 1; d--) {
    const day = addDays(now, -d);
    for (const t of tasks.slice(0, 3)) s = toggleTaskToday(s, t.id, at(day, 9), id('c')).state;
  }
  // Aujourd'hui : deux lumières déjà posées.
  for (const t of tasks.slice(10)) s = toggleTaskToday(s, t.id, at(now, Math.min(now.getHours(), 7)), id('c')).state;
  if (lantern) {
    let focus = s.focus;
    for (let i = 0; i < 4; i++) {
      focus = addFocusSession(focus, { id: id('f'), startedAt: at(addDays(now, -i - 1), 20).toISOString(), minutes: 25, who: i % 2 ? 'a' : 'b' }).focus;
    }
    s = { ...s, focus: selectLantern(focus, 'yukimi').focus };
  }
  return s;
}

const check = (name: string, s: AppState) => {
  const r = validateAppState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`fixture ${name} invalide : ${r.reason}`);
  return JSON.stringify(s);
};

(window as unknown as { __fixtures: Record<string, string> }).__fixtures = {
  long: check('long', build(false)),
  yukimi: check('yukimi', build(true)),
};
