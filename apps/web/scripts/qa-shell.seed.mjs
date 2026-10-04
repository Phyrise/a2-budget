/**
 * État réaliste pour la QA de la coquille V3.2, construit DANS LA PAGE
 * (fonction autonome passée à page.evaluate) avec l'API publique de
 * @a2/core servie par Vite : budget du mois, tâches et trois semaines de
 * soins (crédits cohérents : toggleTaskToday seulement), courses, et
 * événements du calendrier passés et à venir. validateAppState doit passer.
 */
export async function seedShellState({ entry, module, devMode }) {
  const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
  const now = new Date();
  const at = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  const key = (d) => core.localDateKey(d);
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';

  // Budget du mois.
  const monthKey = core.currentMonthKey(now);
  const month = { ...core.createMonthRecord(monthKey, s.budget.settings), salaryACents: 220000, salaryBCents: 300000, bonusBCents: 67500 };
  month.expenses = [
    { id: 'e-loyer', label: 'Loyer', amountCents: 150000 },
    { id: 'e-courses', label: 'Courses', amountCents: 34500 },
  ];
  s.budget.months = [month];
  s.budget.selectedMonth = monthKey;

  // Tâches et soins.
  const wd = core.isoWeekday(now);
  const created = key(core.addDays(now, -40));
  const mk = (input) => core.createTask(input, created);
  const tasks = [
    mk({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily', effort: 1 }),
    mk({ id: 't-lave', title: 'Vider le lave-vaisselle', assignee: 'b', recurrence: 'daily', effort: 2, rotation: true }),
    mk({ id: 't-linge', title: 'Plier le linge', assignee: 'a', recurrence: 'daily', effort: 1 }),
    mk({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'b', recurrence: 'weekly', weeklyDay: wd, effort: 2 }),
    mk({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'weekly', weeklyDay: (wd % 7) + 1, effort: 3 }),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  let n = 0;
  const done = (id, when, doneBy) => {
    n += 1;
    s = core.toggleTaskToday(s, id, when, `c-${n}`, doneBy ? { doneBy } : {}).state;
  };
  for (let k = 28; k >= 7; k--) {
    const d = core.addDays(now, -k);
    done('t-plantes', at(d, 8, 10));
    if (k % 2 === 0) done('t-lave', at(d, 21, 5), k % 4 === 0 ? 'a' : 'b');
    if (k % 3 === 0) done('t-linge', at(d, 19, 30));
  }
  const monday = core.startOfWeek(now);
  for (let d = new Date(monday); key(d) < key(now); d = core.addDays(d, 1)) {
    done('t-plantes', at(d, 8, 20));
    done('t-lave', at(d, 21, 10), 'b');
  }
  done('t-plantes', at(now, Math.min(now.getHours(), 9), 5));

  // Courses : trois à acheter, un déjà dans le panier.
  let items = s.groceries.items;
  for (const [i, raw] of ['2 pommes', 'Lait', 'Pain', 'Riz 1 kg'].entries()) {
    items = core.addGroceryItem(items, raw, { id: `g-${i}`, now }).items;
  }
  items = core.toggleGroceryItem(items, 'g-3', now);
  s = { ...s, groceries: { ...s.groceries, items } };

  // Calendrier : des souvenirs et des projets.
  let events = [];
  const ev = (draft, i) => {
    const r = core.addEvent(events, { ...draft, id: `ev-${i}`, createdAt: core.addDays(now, -60).toISOString() });
    if (r.ok) events = r.events;
  };
  [
    { title: 'Dîner chez Léa et Hugo', date: key(core.addDays(now, -3)), time: '20:00', kind: 'repas', place: 'Montreuil' },
    { title: 'Cinéma : Le Garçon et le Héron', date: key(core.addDays(now, -9)), time: '18:30', endTime: '20:45', kind: 'sortie' },
    { title: 'Anniversaire de maman', date: key(core.addDays(now, -20)), kind: 'anniversaire', who: 'b' },
    { title: 'Brunch au marché', date: key(core.addDays(now, -9)), time: '11:00', kind: 'repas' },
    { title: 'Dîner prévu à la maison', date: key(core.addDays(now, 2)), time: '19:30', kind: 'repas' },
    { title: 'Week-end à Kyoto', date: key(core.addDays(now, 12)), kind: 'voyage' },
  ].forEach(ev);
  s = { ...s, calendar: { events } };

  const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
  if (!v.ok) return { ok: false, reason: v.reason };
  localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
  localStorage.setItem(
    'a2-budget:ui:v1',
    JSON.stringify({ module, forestMotion: 'still', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true, devMode }),
  );
  return {
    ok: true,
    stage: s.forest.growthStage,
    lifetimeCare: s.forest.lifetimeCare,
    goal: core.weeklyCareGoal(s.forest, now),
    events: events.length,
  };
}
