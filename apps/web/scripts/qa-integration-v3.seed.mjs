/**
 * État réaliste pour la QA d'intégration V3, construit DANS LA PAGE (fonction
 * autonome passée à page.evaluate) avec l'API publique de @a2/core servie par
 * Vite. Crédits de la forêt cohérents : uniquement toggleTaskToday.
 */
export async function seedState({ entry }) {
  const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
  const now = new Date();
  const at = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';
  const wd = core.isoWeekday(now);
  const created = core.localDateKey(core.addDays(now, -30));
  const mk = (input) => core.createTask(input, created);
  const tasks = [
    mk({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily', effort: 1 }),
    mk({ id: 't-lave', title: 'Vider le lave-vaisselle', assignee: 'b', recurrence: 'daily', effort: 2, rotation: true }),
    mk({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'b', recurrence: 'weekly', weeklyDay: wd, effort: 2 }),
    mk({ id: 't-sdb', title: 'Nettoyer la salle de bain', assignee: 'b', recurrence: 'weekly', weeklyDay: 6, flexible: true, effort: 3 }),
    mk({ id: 't-marche', title: 'Courses du marché', assignee: 'both', recurrence: 'weekly', weeklyDay: wd, effort: 2 }),
    mk({ id: 't-linge', title: 'Plier le linge', assignee: 'a', recurrence: 'daily', effort: 1 }),
    mk({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'weekly', weeklyDay: (wd % 7) + 1, effort: 3 }),
    mk({ id: 't-aspi', title: 'Passer l’aspirateur', assignee: 'a', recurrence: 'weekly', weeklyDay: ((wd + 1) % 7) + 1, effort: 2 }),
    core.createTask({ id: 't-plombier', title: 'Appeler le plombier', assignee: 'unassigned', recurrence: 'none' }, core.localDateKey(now)),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  let n = 0;
  const done = (id, when, doneBy) => {
    n += 1;
    s = core.toggleTaskToday(s, id, when, `c-${n}`, doneBy ? { doneBy } : {}).state;
  };
  // Trois semaines de vie commune (croissance, créatures).
  for (let k = 21; k >= 7; k--) {
    const d = core.addDays(now, -k);
    done('t-plantes', at(d, 8, 10));
    if (k % 2 === 0) done('t-lave', at(d, 21, 5), k % 4 === 0 ? 'a' : 'b');
    if (k % 3 === 0) done('t-linge', at(d, 19, 30));
  }
  // Cette semaine (lundi → hier) : AC porte un peu plus, AL donne des coups de main.
  const monday = core.startOfWeek(now);
  for (let d = new Date(monday); core.localDateKey(d) < core.localDateKey(now); d = core.addDays(d, 1)) {
    const i = Math.round((d.getTime() - monday.getTime()) / 86_400_000);
    done('t-plantes', at(d, 8, 20), i === 3 ? 'b' : undefined);
    done('t-lave', at(d, 21, 10), i % 2 === 0 ? 'b' : 'a');
    if (i % 2 === 1) done('t-linge', at(d, 19, 30), i === 1 ? 'b' : undefined);
  }
  // Aujourd'hui : un fait, un « pas aujourd'hui ».
  done('t-plantes', at(now, Math.min(now.getHours(), 9), 5));
  const linge = tasks.find((t) => t.id === 't-linge');
  s = {
    ...s,
    chores: {
      ...s.chores,
      skips: core.skipOccurrence(s.chores.skips, { id: 'sk-1', taskId: linge.id, dueDate: core.skipDateFor(linge, now), at: now.toISOString() }).skips,
    },
  };
  // Cercle de la semaine passée, tenu.
  s = {
    ...s,
    rituals: core.saveCircle(s.rituals, {
      id: 'circle-prev',
      weekStart: core.weekStartKey(core.addDays(now, -7)),
      heldAt: at(core.addDays(now, -7), 20, 30).toISOString(),
      gratitude: [
        { from: 'a', to: 'b', text: 'Merci d’avoir vidé le lave-vaisselle 4 fois cette semaine' },
        { from: 'b', to: 'a', text: 'Merci pour le petit-déjeuner de dimanche' },
      ],
      burdens: [{ who: 'b', text: 'Les soirées étaient chargées.' }],
      intentions: ['Une balade ensemble'],
    }),
  };
  // Deux lanternes déjà allumées.
  let focus;
  [[25, 'a', 3], [10, 'both', 2]].forEach(([minutes, who, ago], i) => {
    focus = core.addFocusSession(focus, { id: `f-${i}`, startedAt: at(core.addDays(now, -ago), 18).toISOString(), minutes, who, label: 'Rangement' }).focus;
  });
  s = { ...s, focus };
  const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
  if (!v.ok) return { ok: false, reason: v.reason };
  localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
  localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', forestMotion: 'full', guardianSeen: true, offlineAnnounced: true }));
  return { ok: true, stage: s.forest.growthStage, creatures: s.forest.unlockedCreatureIds };
}
