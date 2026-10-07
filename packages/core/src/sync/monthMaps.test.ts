import { describe, expect, it } from 'vitest';
import { setExpensePaid, setTransferPaid } from '../payments.js';
import { createMonthRecord, defaultSettings, validatePersistedState } from '../state.js';
import type { MonthRecord } from '../types.js';
import {
  expensesFromMap,
  expensesToMap,
  monthFromDoc,
  monthToDoc,
  settingsFromDoc,
  settingsToDoc,
} from './monthMaps.js';
import { allocateOrders, compareOrdered, sortByOrder } from './order.js';

function month(): MonthRecord {
  let m = createMonthRecord('2026-10', defaultSettings());
  m = setTransferPaid(m, 'A', true);
  m = setExpensePaid(m, 'rent', true);
  return { ...m, bonusACents: 12_000 };
}

function validMonth(input: Record<string, unknown>): MonthRecord {
  const r = validatePersistedState({ schemaVersion: 1, settings: defaultSettings(), months: [input], selectedMonth: '2026-10' });
  if (!r.ok) throw new Error(r.reason);
  return r.state.months[0]!;
}

describe('mois en maps', () => {
  it('aller-retour mois → document → mois identique (dépenses, paiements, compléments)', () => {
    const m = month();
    const doc = monthToDoc(m);
    expect(doc.expenses.rent).toEqual({ label: 'Loyer + charges', amountCents: 130_000, order: 0 });
    expect(doc.paid).toEqual({ transferA: true, expenses: { rent: true } });
    expect(validMonth(monthFromDoc(JSON.parse(JSON.stringify(doc))))).toEqual(m);
  });

  it('les rangs connus sont gardés ; une dépense ajoutée ou réinsérée se place entre ses voisines', () => {
    const m = month();
    const known = monthToDoc(m);
    const added = monthToDoc({ ...m, expenses: [...m.expenses, { id: 'new', label: 'Cinéma', amountCents: 2_000 }] }, known);
    expect(added.expenses.rent).toEqual(known.expenses.rent);
    expect(added.expenses.new?.order).toBe(6);
    const [first, ...rest] = m.expenses;
    const inserted = monthToDoc({ ...m, expenses: [first!, { id: 'mid', label: 'Gaz', amountCents: 5_000 }, ...rest] }, known);
    expect(inserted.expenses.mid?.order).toBe(0.5);
    expect(expensesFromMap(inserted.expenses).map((e) => e.id)).toEqual(['rent', 'mid', 'electricity', 'groceries', 'internet', 'insurance', 'other']);
  });

  it('relecture tolérante : entrée incomplète ignorée (la suppression gagne), map vide = absente', () => {
    const doc = JSON.parse(JSON.stringify(monthToDoc(month())));
    doc.expenses.rent = { amountCents: 99 }; // supprimée par l’un, montant modifié par l’autre
    doc.expenses.ghost = 'pas une dépense';
    doc.paid = { expenses: {} };
    const back = validMonth(monthFromDoc(doc));
    expect(back.expenses.map((e) => e.id)).not.toContain('rent');
    expect(back.paid).toBeUndefined();
  });

  it('même rang des deux côtés : l’id départage partout pareil', () => {
    const map = { b: { label: 'B', amountCents: 1, order: 3 }, a: { label: 'A', amountCents: 2, order: 3 } };
    expect(expensesFromMap(map).map((e) => e.id)).toEqual(['a', 'b']);
    expect(expensesFromMap(null)).toEqual([]);
  });

  it('réglages : dépenses récurrentes en map, aller-retour identique', () => {
    const settings = defaultSettings();
    const doc = settingsToDoc(settings);
    expect(Object.keys(doc.recurringExpenses)).toHaveLength(6);
    expect(settingsFromDoc(JSON.parse(JSON.stringify(doc)))).toEqual(settings);
    const renamed = settingsToDoc({ ...settings, recurringExpenses: settings.recurringExpenses.slice(1) }, doc);
    expect(renamed.recurringExpenses.electricity).toEqual(doc.recurringExpenses.electricity);
    expect(expensesToMap([])).toEqual({});
  });
});

describe('rangs d’ordre', () => {
  const none = () => undefined;
  it('première écriture : 0, 1, 2… ; ajouts en tête, au milieu, en fin', () => {
    expect(allocateOrders(['a', 'b', 'c'], none)).toEqual([0, 1, 2]);
    const known: Record<string, number> = { a: 0, b: 1 };
    const k = (id: string) => known[id];
    expect(allocateOrders(['x', 'y', 'a', 'b'], k)).toEqual([-2, -1, 0, 1]);
    expect(allocateOrders(['a', 'x', 'y', 'b'], k)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(allocateOrders(['a', 'b', 'x'], k)).toEqual([0, 1, 2]);
  });

  it('un rang devenu décroissant est réattribué (déplacement), les autres gardés', () => {
    const known: Record<string, number> = { a: 0, b: 1, c: 2 };
    expect(allocateOrders(['c', 'a', 'b'], (id) => known[id])).toEqual([2, 3, 4]);
    expect(allocateOrders(['a', 'c', 'b'], (id) => known[id])).toEqual([0, 2, 3]);
  });

  it('tri par rang puis id ; rang absent = 0', () => {
    const docs = [{ id: 'b', order: 1 }, { id: 'a', order: 1 }, { id: 'z' }, { id: 'c', order: -1 }];
    expect(sortByOrder(docs).map((d) => d.id)).toEqual(['c', 'z', 'a', 'b']);
    expect(compareOrdered({ id: 'a', order: 1 }, { id: 'a', order: 1 })).toBe(0);
  });
});
