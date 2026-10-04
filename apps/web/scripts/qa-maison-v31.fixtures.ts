/**
 * Fixtures de la QA Maison V3.1 (servies par Vite, construites par @a2/core) :
 * dix tâches hebdomadaires le même jour (dans six jours) pour « À venir »,
 * quelques autres dans la semaine, des faits de la semaine pour le partage
 * (AC a beaucoup porté), aucune lanterne encore allumée. Vérifiées par
 * validateAppState.
 */
import {
  addDays,
  createTask,
  emptyAppState,
  isoWeekday,
  localDateKey,
  startOfWeek,
  toggleTaskToday,
  validateAppState,
  type AppState,
  type HouseholdTask,
} from '@a2/core';

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;
const at = (base: Date, h: number, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);

const BUSY_DAY = [
  'Changer les draps',
  'Laver les vitres',
  'Passer la serpillière',
  'Détartrer la bouilloire',
  'Trier le courrier',
  'Ranger le garage',
  'Nettoyer le four',
  'Arroser le balcon',
  'Repasser les chemises',
  'Vider le frigo',
];

function build(): AppState {
  const now = new Date();
  let s = emptyAppState();
  const wd = isoWeekday(now);
  const inDays = (n: number) => ((wd - 1 + n) % 7) + 1;
  const created = localDateKey(addDays(now, -30));
  const t = (title: string, assignee: HouseholdTask['assignee'], recurrence: HouseholdTask['recurrence'], extra: Partial<HouseholdTask> = {}) =>
    createTask({ id: id('t'), title, assignee, recurrence, ...extra } as Parameters<typeof createTask>[0], created);
  const busy = inDays(6);
  const tasks: HouseholdTask[] = [
    t('Arroser les plantes', 'a', 'daily'),
    t('Vider le lave-vaisselle', 'b', 'daily', { effort: 2, rotation: true }),
    t('Sortir les poubelles', 'b', 'weekly', { weeklyDay: inDays(1), effort: 2 }),
    t('Courses du marché', 'both', 'weekly', { weeklyDay: inDays(1) }),
    t('Plier le linge', 'a', 'weekly', { weeklyDay: inDays(1) }),
    t('Passer l’aspirateur', 'a', 'weekly', { weeklyDay: inDays(3), effort: 2 }),
    t('Nettoyer la salle de bain', 'b', 'weekly', { weeklyDay: inDays(4), effort: 3, rotation: true }),
    ...BUSY_DAY.map((title, i) =>
      t(title, i % 3 === 0 ? 'both' : i % 2 === 0 ? 'a' : 'b', 'weekly', { weeklyDay: busy, effort: ((i % 3) + 1) as 1 | 2 | 3 }),
    ),
  ];
  s.chores.tasks = tasks;
  const byTitle = (title: string) => tasks.find((x) => x.title === title)!;
  const done = (task: HouseholdTask, when: Date, doneBy?: 'a' | 'b' | 'both') => {
    s = toggleTaskToday(s, task.id, when, id('c'), doneBy ? { doneBy } : {}).state;
  };

  // Cette semaine (lundi → hier) : AC a beaucoup porté.
  const monday = startOfWeek(now);
  for (let day = new Date(monday); localDateKey(day) < localDateKey(now); day = addDays(day, 1)) {
    done(byTitle('Arroser les plantes'), at(day, 8, 20), 'b');
    done(byTitle('Vider le lave-vaisselle'), at(day, 21, 10), 'b');
  }
  done(byTitle('Arroser les plantes'), at(now, Math.min(now.getHours(), 3), 2));
  return s;
}

const check = (name: string, s: AppState) => {
  const r = validateAppState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`fixture ${name} invalide : ${r.reason}`);
  return JSON.stringify(s);
};

(window as unknown as { __fixtures: Record<string, string> }).__fixtures = {
  busy: check('busy', build()),
};
