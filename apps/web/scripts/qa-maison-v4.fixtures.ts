/**
 * Fixtures de la QA Maison V4 (servies par Vite, construites par @a2/core) :
 * quelques tâches du jour (dont une corvée), deux déjà faites, une forêt au
 * stade 3 avec deux créatures rencontrées, sept lanternes déjà allumées (la
 * huitième débloquera l'Oribe), Yukimi posée dans la forêt. Vérifiées par
 * validateAppState.
 */
import {
  addDays,
  addFocusSession,
  createTask,
  emptyAppState,
  localDateKey,
  toggleTaskToday,
  validateAppState,
  type AppState,
  type FocusState,
} from '@a2/core';

const now = new Date();
const created = localDateKey(addDays(now, -20));

function base(): AppState {
  let s = emptyAppState();
  s = {
    ...s,
    budget: {
      ...s.budget,
      settings: { ...s.budget.settings, personA: { ...s.budget.settings.personA, name: 'AL' }, personB: { ...s.budget.settings.personB, name: 'AC' } },
    },
  };
  const tasks = [
    createTask({ id: 't-basilic', title: 'Arroser le basilic', assignee: 'b', recurrence: 'daily', effort: 1 }, created),
    createTask({ id: 't-bureau', title: 'Ranger le bureau', assignee: 'a', recurrence: 'none', effort: 2 }, created),
    createTask({ id: 't-sdb', title: 'Nettoyer la salle de bain', assignee: 'a', recurrence: 'daily', effort: 3, rotation: true }, created),
    createTask({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'a', recurrence: 'daily', effort: 1 }, created),
    createTask({ id: 't-vaisselle', title: 'Vider le lave-vaisselle', assignee: 'b', recurrence: 'daily', effort: 1 }, created),
    createTask({ id: 't-plantes', title: 'Tourner les plantes', assignee: 'both', recurrence: 'daily', effort: 1 }, created),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  // Deux gestes faits ce matin.
  const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30);
  s = toggleTaskToday(s, 't-poubelles', morning, 'c-p').state;
  s = toggleTaskToday(s, 't-vaisselle', new Date(morning.getTime() + 20 * 60_000), 'c-v').state;
  s = {
    ...s,
    forest: {
      ...s.forest,
      growthStage: 3,
      unlockedCreatureIds: ['moss-ling', 'seed-spirit'],
    },
  };
  let focus: FocusState | undefined;
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(now, -(i + 1));
    day.setHours(19, 0, 0, 0);
    focus = addFocusSession(focus, { id: `f-${i}`, startedAt: day.toISOString(), minutes: 10, who: i % 2 ? 'a' : 'both', label: 'Ranger un peu' }).focus;
  }
  return { ...s, focus: { ...focus!, selectedLantern: 'yukimi' } };
}

function check(s: AppState): string {
  const r = validateAppState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`fixture invalide : ${r.reason}`);
  return JSON.stringify(s);
}

(window as unknown as { __fixtures: Record<string, string> }).__fixtures = {
  home: check(base()),
};
