/**
 * État réaliste de la QA d'intégration V4, construit DANS la page avec
 * @a2/core (import /@fs du serveur de dev) puis vérifié par validateAppState :
 * - Budget : mois précédent payé et recalé, mois courant en partie payé ;
 * - Maison : tâches hebdomadaires à jour fixe (aujourd'hui, demain), une
 *   mensuelle, une ponctuelle, une quotidienne ; forêt au stade 3 ;
 *   huit lanternes déjà allumées (trois modèles débloqués), Yukimi posée ;
 * - Calendrier : quelques moments, dont un avec une note ;
 * - Courses : six articles.
 * Passé tel quel à `page.evaluate` (fonction autonome, sans fermeture).
 */
export async function seedIntegrationState({ entry }) {
  const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
  const now = new Date();
  const day = (d) => core.localDateKey(core.addDays(now, d));
  const wd = (d) => core.isoWeekday(core.addDays(now, d));
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';

  // --- Budget -----------------------------------------------------------------
  const key = core.currentMonthKey(now);
  const [y, m] = key.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const month = (k, a, b, bonusB) => ({ ...core.createMonthRecord(k, s.budget.settings), salaryACents: a, salaryBCents: b, bonusBCents: bonusB });
  let prev = month(prevKey, 231_000, 298_700, 40_000);
  prev = core.setTransferPaid(core.setTransferPaid(prev, 'A', true), 'B', true);
  for (const e of prev.expenses) prev = core.setExpensePaid(prev, e.id, true);
  let cur = month(key, 231_000, 298_700, 67_500);
  cur = core.setTransferPaid(cur, 'A', true);
  if (cur.expenses[0]) cur = core.setExpensePaid(cur, cur.expenses[0].id, true);
  let budget = { ...s.budget, months: [prev, cur], selectedMonth: key };
  budget = core.recordBalanceCorrection(budget, prevKey, 162_000, {
    id: 'corr-1',
    recordedAt: new Date(y, m - 2, 2, 9).toISOString(),
    note: 'Relevé de la banque',
  });
  s = { ...s, budget };

  // --- Maison -------------------------------------------------------------------
  const created = day(-21);
  const tasks = [
    core.createTask({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'b', recurrence: 'weekly', weeklyDay: wd(0), effort: 1 }, created),
    core.createTask({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: wd(1), effort: 1 }, created),
    core.createTask({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'weekly', weeklyDay: wd(-2), effort: 3 }, created),
    core.createTask(
      { id: 't-bouilloire', title: 'Détartrer la bouilloire', assignee: 'a', recurrence: 'monthly', monthlyDay: core.addDays(now, 3).getDate(), rotation: true },
      created,
    ),
    core.createTask({ id: 't-bureau', title: 'Ranger le bureau', assignee: 'a', recurrence: 'none', effort: 2 }, day(0)),
    core.createTask({ id: 't-vaisselle', title: 'Faire la vaisselle', assignee: 'both', recurrence: 'daily', effort: 1 }, created),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };
  s = core.toggleTaskToday(s, 't-draps', core.addDays(now, -2), 'c-draps', { doneBy: 'both' }).state;
  const morning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30);
  s = core.toggleTaskToday(s, 't-vaisselle', morning, 'c-vaisselle').state;
  s = { ...s, forest: { ...s.forest, growthStage: 3, unlockedCreatureIds: ['moss-ling', 'seed-spirit'] } };
  let focus;
  for (let i = 0; i < 8; i += 1) {
    const d = core.addDays(now, -(i + 1));
    d.setHours(19, 0, 0, 0);
    focus = core.addFocusSession(focus, { id: `f-${i}`, startedAt: d.toISOString(), minutes: 10, who: i % 2 ? 'a' : 'both', label: 'Ranger un peu' }).focus;
  }
  s = { ...s, focus: { ...focus, selectedLantern: 'yukimi' } };

  // --- Calendrier ------------------------------------------------------------------
  let events = [];
  const drafts = [
    { title: 'Apéro avec Inès', date: day(0), time: '19:30', kind: 'repas', who: 'both', note: 'Inès apporte les olives\nRéserver la terrasse' },
    { title: 'Livraison du canapé', date: day(1), kind: 'maison', who: 'a', note: 'Entre 8 h et 13 h' },
    { title: 'Dentiste', date: day(6), time: '09:15', kind: 'rdv', who: 'b' },
  ];
  drafts.forEach((d, i) => {
    const r = core.addEvent(events, { ...d, id: `evt-${i}`, createdAt: now.toISOString() });
    if (!r.ok) throw new Error(r.reason);
    events = r.events;
  });

  // --- Courses ----------------------------------------------------------------------
  let items = [];
  for (const [i, label] of ['pommes', 'lait x2', 'pain de campagne', 'café', 'tomates', 'œufs x6'].entries()) {
    items = core.addGroceryItem(items, label, { id: `g-${i}`, now: core.addDays(now, -1) }).items;
  }
  s = { ...s, calendar: { events }, groceries: { ...s.groceries, items } };

  const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
  if (!v.ok) return { ok: false, reason: v.reason };
  localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
  localStorage.setItem(
    'a2-budget:ui:v1',
    JSON.stringify({ module: 'maison', forestMotion: 'full', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true }),
  );
  return { ok: true };
}
