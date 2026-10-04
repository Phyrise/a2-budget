/**
 * Fixtures de la QA Maison V3 (servies par Vite, construites par @a2/core) :
 * tâches avec effort / tour à tour / souple, faits de la semaine, un « pas
 * aujourd'hui », un coup de main. Crédits de la forêt cohérents (toujours
 * via toggleTaskToday). Chaque état est vérifié par migrateState.
 */
import {
  addDays,
  createTask,
  emptyAppState,
  isoWeekday,
  localDateKey,
  migrateState,
  skipDateFor,
  skipOccurrence,
  startOfWeek,
  toggleTaskToday,
  type AppState,
  type ChoreDoer,
  type HouseholdTask,
} from '@a2/core';

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;
const at = (base: Date, h: number, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);

type Mode = 'carried' | 'balanced' | 'quiet';

function build(mode: Mode): AppState {
  const now = new Date();
  let s = emptyAppState();
  const wd = isoWeekday(now);
  const created = localDateKey(addDays(now, -30));
  const t = (title: string, assignee: HouseholdTask['assignee'], recurrence: HouseholdTask['recurrence'], extra: Partial<HouseholdTask> = {}) =>
    createTask({ id: id('t'), title, assignee, recurrence, ...extra } as Parameters<typeof createTask>[0], created);
  const tasks: HouseholdTask[] = [
    t('Arroser les plantes', 'a', 'daily'),
    t('Vider le lave-vaisselle', 'b', 'daily', { effort: 2, rotation: true }),
    t('Sortir les poubelles', 'b', 'weekly', { weeklyDay: wd, effort: 2 }),
    t('Nettoyer la salle de bain', 'b', 'weekly', { weeklyDay: 6, flexible: true, effort: 3 }),
    t('Courses du marché', 'both', 'weekly', { weeklyDay: wd }),
    t('Plier le linge', 'b', 'daily'),
    t('Changer les draps', 'both', 'weekly', { weeklyDay: (wd % 7) + 1, effort: 3 }),
    t('Passer l’aspirateur', 'a', 'weekly', { weeklyDay: ((wd + 1) % 7) + 1, effort: 2 }),
    createTask({ id: id('t'), title: 'Appeler le plombier', assignee: 'unassigned', recurrence: 'none' }, localDateKey(now)),
  ];
  if (mode === 'quiet') tasks.splice(5, 3);
  s.chores.tasks = tasks;
  const byTitle = (title: string) => tasks.find((x) => x.title === title)!;
  const done = (task: HouseholdTask, when: Date, doneBy?: ChoreDoer) => {
    const r = toggleTaskToday(s, task.id, when, id('c'), doneBy ? { doneBy } : {});
    s = r.state;
  };

  // Semaines passées (croissance de la forêt, historique).
  for (let d = 20; d >= 8; d--) {
    const day = addDays(now, -d);
    done(byTitle('Arroser les plantes'), at(day, 8, 10));
    if (d % 2 === 0) done(byTitle('Vider le lave-vaisselle'), at(day, 21, 5), d % 4 === 0 ? 'a' : 'b');
  }

  // Cette semaine (lundi → hier).
  const monday = startOfWeek(now);
  for (let day = new Date(monday); localDateKey(day) < localDateKey(now); day = addDays(day, 1)) {
    const i = Math.round((day.getTime() - monday.getTime()) / 86_400_000);
    if (mode === 'quiet') {
      if (i === 0) done(byTitle('Arroser les plantes'), at(day, 9));
      continue;
    }
    done(byTitle('Arroser les plantes'), at(day, 8, 20), mode === 'carried' && i % 2 === 0 ? 'b' : undefined);
    done(byTitle('Vider le lave-vaisselle'), at(day, 21, 10), 'b');
    if (mode === 'carried' || i % 2 === 1) done(byTitle('Plier le linge'), at(day, 19, 30), mode === 'balanced' ? 'a' : undefined);
    if (mode === 'balanced' && i === 2) done(byTitle('Passer l’aspirateur'), at(day, 11));
  }

  // Aujourd'hui : un coup de main (AL a vidé le lave-vaisselle à la place d'AC ?)
  // et un « pas aujourd'hui ».
  if (mode !== 'quiet') {
    const linge = byTitle('Plier le linge');
    s.chores.skips = skipOccurrence(s.chores.skips, { id: id('s'), taskId: linge.id, dueDate: skipDateFor(linge, now), at: now.toISOString() }).skips;
    done(byTitle('Arroser les plantes'), at(now, Math.min(now.getHours(), 3), 2), 'b');
  }
  return s;
}

const check = (name: string, s: AppState) => {
  const r = migrateState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`fixture ${name} invalide : ${r.reason}`);
  return JSON.stringify(s);
};

(window as unknown as { __fixtures: Record<string, string> }).__fixtures = {
  carried: check('carried', build('carried')),
  balanced: check('balanced', build('balanced')),
  quiet: check('quiet', build('quiet')),
};
