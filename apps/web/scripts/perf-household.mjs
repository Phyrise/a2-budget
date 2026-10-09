/**
 * Foyer réaliste pour la sonde de charge (docs/PERF.md) : `months` mois de
 * vie à deux, rejoués jour par jour avec l'API publique de @a2/core (chargée
 * par Vite en SSR), puis vérifiés par validateAppState.
 *
 * Rythme (hypothèse « foyer actif ») : 11 tâches (2 quotidiennes,
 * 6 hebdomadaires, 2 mensuelles, la tâche Courses), ≈ 3 faits par jour,
 * 2 courses par semaine de 12 articles (historique gardé : 200), 1 moment de
 * calendrier par semaine, un mois de budget par mois avec 8 dépenses, une
 * lettre du cercle par personne et par semaine, 3 lanternes par semaine.
 */
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const coreEntry = fileURLToPath(new URL('../../../packages/core/src/index.ts', import.meta.url));

const LABELS = ['pommes', 'lait x2', 'pain de campagne', 'café', 'tomates', 'œufs x6', 'pâtes', 'riz', 'yaourts', 'beurre', 'fromage râpé', 'salade',
  'bananes', 'jus d’orange', 'papier toilette', 'liquide vaisselle', 'poulet', 'carottes', 'oignons', 'chocolat noir', 'farine', 'sucre', 'thé vert', 'eau pétillante'];

export async function householdState(months = 6, nowArg = new Date()) {
  const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
  try {
    const core = await server.ssrLoadModule(coreEntry);
    return build(core, months, nowArg);
  } finally {
    await server.close();
  }
}

function build(core, months, now) {
  const days = Math.round(months * 30.4);
  const start = core.addDays(now, -days);
  const dayKey = (d) => core.localDateKey(d);
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';
  const created = dayKey(start);
  const wd = (n) => ((n - 1) % 7) + 1;
  const tasks = [
    core.createTask({ id: 't-vaisselle', title: 'Faire la vaisselle', assignee: 'both', recurrence: 'daily', effort: 1 }, created),
    core.createTask({ id: 't-lit', title: 'Faire le lit', assignee: 'a', recurrence: 'daily', effort: 1, rotation: true }, created),
    core.createTask({ id: 't-plantes', title: 'Arroser les plantes', assignee: 'b', recurrence: 'weekly', weeklyDay: wd(1), effort: 1 }, created),
    core.createTask({ id: 't-poubelles', title: 'Sortir les poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: wd(2), effort: 1 }, created),
    core.createTask({ id: 't-draps', title: 'Changer les draps', assignee: 'both', recurrence: 'weekly', weeklyDay: wd(6), effort: 3 }, created),
    core.createTask({ id: 't-aspi', title: 'Passer l’aspirateur', assignee: 'a', recurrence: 'weekly', weeklyDay: wd(3), effort: 2, rotation: true }, created),
    core.createTask({ id: 't-sdb', title: 'Nettoyer la salle de bain', assignee: 'b', recurrence: 'weekly', weeklyDay: wd(5), effort: 3, flexible: true }, created),
    core.createTask({ id: 't-linge', title: 'Lancer une machine', assignee: 'both', recurrence: 'weekly', weeklyDay: wd(7), effort: 2 }, created),
    core.createTask({ id: 't-frigo', title: 'Vider le frigo', assignee: 'a', recurrence: 'monthly', monthlyDay: 1, effort: 2 }, created),
    core.createTask({ id: 't-bouilloire', title: 'Détartrer la bouilloire', assignee: 'b', recurrence: 'monthly', monthlyDay: 15, rotation: true }, created),
    core.createTask({ id: 't-courses', title: 'Faire les courses', assignee: 'both', recurrence: 'none', groceries: true }, created),
  ];
  s = { ...s, chores: { ...s.chores, tasks } };

  let items = [];
  let groceries = s.groceries;
  let events = [];
  let focus;
  let rituals = s.rituals;
  let n = 0;
  const who = () => (n % 3 === 0 ? 'a' : n % 3 === 1 ? 'b' : 'both');
  for (let i = 0; i <= days; i += 1) {
    const d = core.addDays(start, i);
    const at = (h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    for (const t of tasks) {
      if (t.groceries) continue;
      n += 1;
      if (n % 5 === 0) continue; // une occurrence sur cinq oubliée
      s = core.toggleTaskToday(s, t.id, at(19, n % 50), `c-${i}-${t.id}`, { doneBy: who() }).state;
    }
    // Courses : ajouts au fil des jours, panier vidé mardi et samedi (+ la tâche Courses).
    for (let k = 0; k < 2; k += 1) {
      n += 1;
      items = core.addGroceryItem(items, LABELS[n % LABELS.length], { id: `g-${i}-${k}`, now: at(12, k), addedBy: n % 2 ? 'a' : 'b' }).items;
    }
    if (d.getDay() === 2 || d.getDay() === 6) {
      for (const it of items.slice(0, 12)) items = core.toggleGroceryItem(items, it.id, at(18));
      groceries = core.clearDoneGroceries({ ...groceries, items }, at(18, 30));
      items = groceries.items;
      s = { ...s, groceries };
      s = core.toggleTaskToday(s, 't-courses', at(18, 31), `c-${i}-courses`, { doneBy: who() }).state;
    }
    if (d.getDay() === 4) {
      const r = core.addEvent(events, { id: `evt-${i}`, title: `Moment ${i}`, date: dayKey(core.addDays(d, 3)), time: '19:30', kind: 'repas', who: 'both', note: 'Un mot', createdAt: at(9).toISOString() });
      if (r.ok) events = r.events;
    }
    if (d.getDay() === 0) {
      const monday = dayKey(core.addDays(d, -6));
      for (const author of ['a', 'b']) {
        const other = author === 'a' ? 'b' : 'a';
        rituals = core.saveCirclePart(rituals, {
          weekStart: monday, heldAt: at(20).toISOString(), author,
          gratitude: [{ from: author, to: other, text: 'Merci pour la vaisselle de mardi' }], burdens: [], intentions: ['Se coucher plus tôt'],
          notes: [{ from: author, to: other, text: 'Belle semaine à toi' }],
        });
      }
    }
    if (d.getDay() % 2 === 1) {
      focus = core.addFocusSession(focus, { id: `f-${i}`, startedAt: at(21).toISOString(), minutes: 15, who: who(), label: 'Ranger un peu' }).focus;
    }
  }
  items = items.slice(-8).map((it) => ({ ...it, done: false, doneAt: null }));
  s = { ...s, groceries: { ...s.groceries, items }, calendar: { events }, rituals, focus: { ...focus, selectedLantern: 'yukimi' } };

  // Budget : un mois par mois écoulé, payé (le mois courant à moitié).
  const monthsList = [];
  for (let k = Math.ceil(months); k >= 0; k -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = core.currentMonthKey(d);
    let rec = { ...core.createMonthRecord(key, s.budget.settings), salaryACents: 231_000, salaryBCents: 298_700 };
    rec = core.setTransferPaid(rec, 'A', true);
    if (k > 0) rec = core.setTransferPaid(rec, 'B', true);
    for (const e of rec.expenses) rec = core.setExpensePaid(rec, e.id, true);
    monthsList.push(rec);
  }
  s = { ...s, budget: { ...s.budget, months: monthsList, selectedMonth: core.currentMonthKey(now) } };

  const plain = JSON.parse(JSON.stringify(s));
  const v = core.validateAppState(plain);
  if (!v.ok) throw new Error(`foyer invalide : ${v.reason}`);
  return v.state;
}
