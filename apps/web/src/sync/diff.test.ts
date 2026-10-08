import { describe, expect, it } from 'vitest';
import {
  addFocusSession,
  advanceDay,
  localDateKey,
  clearDoneGroceries,
  prunePaidExpenses,
  recordBalanceCorrection,
  removeEvent,
  removeGroceryItem,
  restoreEvent,
  restoreGroceryItem,
  saveCircle,
  selectLantern,
  setTransferPaid,
  toggleGroceryItem,
  unskipOccurrence,
  updateGroceryItem,
  updateTask,
  rememberGroceryCategory,
  type AppState,
  type MonthRecord,
} from '@a2/core';
import { applyBatch } from './apply';
import { DELETE_FIELD, type DocData, type WriteOp } from './docs';
import { diffToOps } from './diff';
import { migrationOps } from './migration';
import { projectState } from './project';
import { NOW, addGrocery, at, canonical, richState, testId, toggle, togglePause } from './testFixtures';

/**
 * Téléphone seul : chaque geste local → diffToOps → lot appliqué (règles du
 * serveur) → projection. La projection doit redonner exactement l'état local.
 */
function phone(initial: AppState = richState()) {
  const r = applyBatch(new Map(), migrationOps(initial, { now: NOW, role: 'a' }), { rules: true });
  if (!r.ok) throw new Error(r.reason);
  let docs = r.docs;
  let state = initial;
  return {
    get state() { return state; },
    get docs() { return docs; },
    act(fn: (s: AppState) => AppState, when: Date = NOW, role: 'a' | 'b' = 'a'): WriteOp[] {
      const next = fn(state);
      const ops = diffToOps(state, next, { docs, role, now: when, newId: () => testId('e') });
      const applied = applyBatch(docs, ops, { rules: true });
      if (!applied.ok) throw new Error(applied.reason);
      docs = applied.docs;
      const projected = projectState(docs, { selectedMonth: next.budget.selectedMonth, today: when });
      if (!projected.ok) throw new Error(projected.issues.join(', '));
      // Le store avance la forêt au jour (au chargement, au focus) : la projection aussi.
      expect(projected.state).toEqual(canonical({ ...next, forest: advanceDay(next.forest, localDateKey(when)) }));
      state = projected.state;
      return ops;
    },
  };
}

const iso = NOW.toISOString();
const fieldsOf = (op: WriteOp | undefined) => (op !== undefined && 'fields' in op ? op.fields : []);
const month = (s: AppState, key: string) => s.budget.months.find((m) => m.monthKey === key)!;
function mapMonth(s: AppState, key: string, fn: (m: MonthRecord) => MonthRecord): AppState {
  return { ...s, budget: { ...s.budget, months: s.budget.months.map((m) => (m.monthKey === key ? fn(m) : m)) } };
}

describe('diffToOps — écritures minimales, et la projection redonne l’état local', () => {
  it('rien ne change, ou seulement le mois affiché → aucune écriture', () => {
    const p = phone();
    expect(diffToOps(p.state, p.state, { docs: p.docs, role: 'a', now: NOW, newId: testId })).toEqual([]);
    expect(p.act((s) => ({ ...s, budget: { ...s.budget, selectedMonth: '2026-09' } }))).toEqual([]);
  });

  it('tâche : seuls les champs modifiés (un champ retiré est supprimé)', () => {
    const p = phone();
    const ops = p.act((s) => ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'vaisselle', { title: 'La vaisselle', rotation: false }) } }));
    expect(ops).toEqual([{
      kind: 'update', collection: 'tasks', id: 'vaisselle',
      fields: [[['title'], 'La vaisselle'], [['rotation'], DELETE_FIELD], [['updatedAt'], iso]],
    }]);
  });

  it('« pas aujourd’hui » annulé, cocher, décocher, recocher : faits créés puis annulés, jamais supprimés', () => {
    const p = phone();
    const unskip = p.act((s) => ({ ...s, chores: { ...s.chores, skips: unskipOccurrence(s.chores.skips, 'plantes', '2026-10-08').skips } }));
    expect(unskip).toEqual([{
      kind: 'update', collection: 'skips', id: 'k1',
      fields: [[['undoneAt'], iso], [['undoneDay'], '2026-10-08'], [['undoneBy'], 'a']],
    }]);
    const done = p.act((s) => toggle(s, 'plantes', NOW), NOW, 'b');
    expect(done[0]).toMatchObject({ kind: 'create', collection: 'completions', data: { taskId: 'plantes', localDay: '2026-10-08', creditKey: 'plantes|2026-10-08', role: 'b' } });
    const id = done[0]!.id;
    const undo = p.act((s) => toggle(s, 'plantes', NOW), NOW, 'b');
    expect(undo).toEqual([{ kind: 'update', collection: 'completions', id, fields: expect.any(Array) }]);
    expect(p.docs.get(`completions/${id}`)).toMatchObject({ undoneAt: iso, undoneBy: 'b' });
    p.act((s) => toggle(s, 'plantes', NOW)); // nouveau fait, aucun crédit redonné
    expect(p.state.forest.creditLedger['plantes|2026-10-08']?.status).toBe('tombstoned');
  });

  it('pause et réveil : un fait forestEvents, le reste de la forêt est dérivé', () => {
    const p = phone();
    const pause = p.act((s) => togglePause(s, NOW));
    expect(pause).toEqual([{ kind: 'create', collection: 'forestEvents', id: expect.any(String), data: { id: expect.any(String), kind: 'pause', localDay: '2026-10-08', at: iso, role: 'a' } }]);
    const later = at(10, 9);
    const wake = p.act((s) => togglePause(s, later), later);
    expect(wake[0]).toMatchObject({ collection: 'forestEvents', data: { kind: 'resume', localDay: '2026-10-10' } });
  });

  it('courses : ajout, panier, rayon (mémorisé), retrait doux, annulation, vider le panier', () => {
    const p = phone();
    const add = p.act((s) => addGrocery(s, 'Beurre', NOW, 'b'));
    expect(add).toEqual([{ kind: 'create', collection: 'groceries', id: expect.any(String), data: expect.objectContaining({ label: 'Beurre', addedBy: 'b', updatedAt: iso }) }]);
    const id = add[0]!.id;
    expect(fieldsOf(p.act((s) => ({ ...s, groceries: { ...s.groceries, items: toggleGroceryItem(s.groceries.items, id, NOW) } }))[0]))
      .toEqual([[['done'], true], [['doneAt'], iso], [['updatedAt'], iso]]);
    const recat = p.act((s) => ({
      ...s,
      groceries: {
        ...s.groceries,
        items: updateGroceryItem(s.groceries.items, id, { category: 'epicerie' }),
        categoryMemory: rememberGroceryCategory(s.groceries.categoryMemory, 'Beurre', 'epicerie'),
      },
    }));
    expect(recat.map((op) => `${op.kind} ${op.collection}/${op.id}`)).toEqual(['update groceries/' + id, 'merge settings/groceryMemory']);
    expect(fieldsOf(recat[1])[0]).toEqual([['memory', 'beurre'], { category: 'epicerie', order: 2 }]);
    const item = p.state.groceries.items.find((g) => g.id === id)!;
    const index = p.state.groceries.items.indexOf(item);
    const removed = p.act((s) => ({ ...s, groceries: { ...s.groceries, items: removeGroceryItem(s.groceries.items, id) } }));
    expect(removed).toEqual([{ kind: 'update', collection: 'groceries', id, fields: [[['deletedAt'], iso], [['updatedAt'], iso]] }]);
    const restored = p.act((s) => ({ ...s, groceries: { ...s.groceries, items: restoreGroceryItem(s.groceries.items, item, index) } }));
    expect(restored[0]).toMatchObject({ kind: 'set', collection: 'groceries', id });
    const cleared = p.act((s) => ({ ...s, groceries: clearDoneGroceries(s.groceries, NOW) }));
    expect(cleared.map((op) => `${op.kind} ${op.collection}`).sort()).toEqual([
      'create groceryHistory', 'create groceryHistory', 'update groceries', 'update groceries',
    ]);
  });

  it('mois : un montant, une case cochée, une dépense retirée → seulement ces champs', () => {
    const p = phone();
    const amount = p.act((s) => mapMonth(s, '2026-10', (m) => ({ ...m, expenses: m.expenses.map((e) => (e.id === 'rent' ? { ...e, amountCents: 131_000 } : e)) })));
    expect(fieldsOf(amount[0])).toEqual([[['expenses', 'rent', 'amountCents'], 131_000], [['updatedAt'], iso]]);
    const paid = p.act((s) => mapMonth(s, '2026-10', (m) => setTransferPaid(m, 'A', true)));
    expect(fieldsOf(paid[0])).toEqual([[['paid', 'transferA'], true], [['updatedAt'], iso]]);
    const removed = p.act((s) => mapMonth(s, '2026-10', (m) => prunePaidExpenses({ ...m, expenses: m.expenses.filter((e) => e.id !== 'rent') })));
    expect(fieldsOf(removed[0]).map(([path, value]) => `${path.join('.')}=${value === DELETE_FIELD ? '∅' : String(value)}`)).toEqual([
      'expenses.rent.label=∅', 'expenses.rent.amountCents=∅', 'expenses.rent.order=∅', 'paid.expenses.rent=∅', `updatedAt=${iso}`,
    ]);
    expect(month(p.state, '2026-10').paid).toEqual({ transferA: true, transferB: true });
  });

  it('mois effacé : suppression douce ; nouveau mois : créé si absent', () => {
    const p = phone();
    const cleared = p.act((s) => ({ ...s, budget: { ...s.budget, months: s.budget.months.filter((m) => m.monthKey !== '2026-09') } }));
    expect(cleared).toEqual([{ kind: 'update', collection: 'months', id: '2026-09', fields: [[['deletedAt'], iso], [['updatedAt'], iso]] }]);
    const november = { ...month(p.state, '2026-10'), monthKey: '2026-11', paid: undefined };
    delete november.paid;
    const created = p.act((s) => ({ ...s, budget: { ...s.budget, months: [...s.budget.months, november] } }));
    expect(created[0]).toMatchObject({ kind: 'create', collection: 'months', id: '2026-11' });
    const back = p.act((s) => ({ ...s, budget: { ...s.budget, months: [...s.budget.months, { ...november, monthKey: '2026-09' }] } }));
    expect(back[0]).toMatchObject({ kind: 'set', collection: 'months', id: '2026-09' });
  });

  it('réglages et solde : champs des documents uniques ; recalage = remplacement', () => {
    const p = phone();
    const rename = p.act((s) => ({
      ...s,
      household: { people: [{ id: 'a', name: 'Arthur' }, s.household.people[1]!] },
      budget: { ...s.budget, settings: { ...s.budget.settings, personA: { ...s.budget.settings.personA, name: 'Arthur' } } },
    }));
    expect(rename).toEqual([{ kind: 'merge', collection: 'settings', id: 'budget', fields: [[['personA', 'name'], 'Arthur'], [['updatedAt'], iso]] }]);
    const balance = p.act((s) => ({ ...s, budget: recordBalanceCorrection(s.budget, '2026-10', 99_000, { id: 'bal-10', recordedAt: iso }) }));
    expect(balance[0]).toMatchObject({ kind: 'set', collection: 'balanceCorrections', id: '2026-10', data: { id: 'bal-10', balanceCents: 99_000 } });
    const lantern = p.act((s) => ({ ...s, focus: selectLantern(s.focus, 'kasuga-moss').focus }));
    expect(lantern).toEqual([{ kind: 'merge', collection: 'settings', id: 'focus', fields: [[['selectedLantern'], 'kasuga-moss'], [['updatedAt'], iso]] }]);
    const fete = p.act((s) => ({ ...s, anniversaries: { ...s.anniversaries!, coupleDay: 20 } }));
    expect(fieldsOf(fete[0])[0]).toEqual([['coupleDay'], 20]);
  });

  it('calendrier, cercle, lanterne : création, retrait doux, restauration, champs', () => {
    const p = phone();
    const removed = removeEvent(p.state.calendar!.events, 'ev1');
    expect(p.act((s) => ({ ...s, calendar: { events: removed.events } }))[0]).toMatchObject({ kind: 'update', id: 'ev1' });
    expect(p.act((s) => ({ ...s, calendar: { events: restoreEvent(s.calendar!.events, removed.removed!) } }))[0]).toMatchObject({ kind: 'set', id: 'ev1' });
    const circle = p.act((s) => ({ ...s, rituals: saveCircle(s.rituals, { ...s.rituals!.circles[0]!, heldAt: iso, intentions: ['Plier ensemble', 'Marcher'] }) }));
    expect(fieldsOf(circle[0]).map(([path]) => path.join('.'))).toEqual(['heldAt', 'intentions', 'updatedAt']);
    const session = p.act((s) => ({ ...s, focus: addFocusSession(s.focus, { id: 'f9', startedAt: iso, minutes: 15, who: 'both' }).focus }));
    expect(session).toEqual([{ kind: 'create', collection: 'focusSessions', id: 'f9', data: { id: 'f9', startedAt: iso, minutes: 15, who: 'both', order: 4, role: 'a' } }]);
  });

  it('les jalons ne sont relevés que s’ils montent', () => {
    const p = phone();
    const doc = () => p.docs.get('meta/forestMilestones') as DocData;
    const before = doc().lifetimeCare as number;
    p.act((s) => toggle({ ...s, chores: { ...s.chores, skips: [] } }, 'plantes', NOW));
    expect(doc().lifetimeCare).toBe(before + 1);
    const undo = p.act((s) => toggle(s, 'plantes', NOW));
    expect(undo.some((op) => op.kind === 'raise')).toBe(false);
  });
});
