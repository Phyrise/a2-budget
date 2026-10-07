/**
 * État réaliste du Budget V4.1 (exécuté DANS la page, API publique de
 * @a2/core servie par Vite) : mois précédent payé et recalé, mois courant
 * avec compléments, deux cases cochées, une dépense à 0 €.
 */
export async function seedBudgetV41({ entry }) {
  const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
  const now = new Date();
  const key = core.currentMonthKey(now);
  const [y, m] = key.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';
  const month = (k, a, b, bonusB) => ({
    ...core.createMonthRecord(k, s.budget.settings),
    salaryACents: a,
    salaryBCents: b,
    bonusBCents: bonusB,
  });
  let prev = month(prevKey, 231_000, 300_000, 45_000);
  prev = core.setTransferPaid(core.setTransferPaid(prev, 'A', true), 'B', true);
  for (const e of prev.expenses) prev = core.setExpensePaid(prev, e.id, true);
  let cur = month(key, 220_000, 300_000, 67_500);
  cur = core.setTransferPaid(cur, 'A', true);
  cur = core.setExpensePaid(cur, cur.expenses[0].id, true);
  let budget = { ...s.budget, months: [prev, cur], selectedMonth: key };
  budget = core.recordBalanceCorrection(budget, prevKey, 184_000, {
    id: 'corr-1',
    recordedAt: new Date(y, m - 2, 2, 9).toISOString(),
    note: 'Relevé de la banque',
  });
  s = { ...s, budget };
  const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
  if (!v.ok) return { ok: false, reason: v.reason };
  localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
  localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'budget', guardianSeen: true, offlineAnnounced: true }));
  return { ok: true, key };
}
