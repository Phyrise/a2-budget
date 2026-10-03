import { describe, expect, it } from 'vitest';
import { emptyAppState, migrateState, migrateV1toV2, validateAppState } from './appState.js';
import { v1Basic } from './fixtures/v1.js';
import {
  addGroceryItem,
  clearDoneGroceries,
  removeGroceryItem,
  restoreGroceryItem,
  toggleGroceryItem,
} from './groceries.js';
import type { AppState, GroceryItem } from './types.js';

const NOW = new Date('2026-10-15T09:00:00.000Z');

/** Aller-retour JSON (comme localStorage / export). */
function roundTrip(state: unknown): unknown {
  return JSON.parse(JSON.stringify(state));
}

function withGroceries(groceries: unknown): Record<string, unknown> {
  return { ...(roundTrip(emptyAppState()) as Record<string, unknown>), groceries };
}

describe('validateAppState — courses rétrocompatibles', () => {
  it('un JSON V2 ancien (id, label, done seulement) se charge tel quel, sans champ inventé', () => {
    const legacy = withGroceries({
      items: [
        { id: 'g1', label: 'Lait', done: false },
        { id: 'g2', label: 'Pain', done: true },
      ],
    });
    const result = migrateState(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.groceries).toEqual({
      items: [
        { id: 'g1', label: 'Lait', done: false },
        { id: 'g2', label: 'Pain', done: true },
      ],
    });
    expect('history' in result.state.groceries).toBe(false);
    expect(Object.keys(result.state.groceries.items[0]!)).toEqual(['id', 'label', 'done']);
  });

  it('migration V1 → V2 : liste vide, sans historique', () => {
    const v2 = migrateV1toV2(v1Basic);
    expect(v2.groceries).toEqual({ items: [] });
    expect(validateAppState(roundTrip(v2)).ok).toBe(true);
  });

  it('conserve tous les nouveaux champs valides (article + historique)', () => {
    const groceries = {
      items: [
        {
          id: 'g1',
          label: 'Farine',
          done: true,
          quantity: '500 g',
          category: 'epicerie',
          addedAt: '2026-10-14T08:00:00.000Z',
          doneAt: '2026-10-15T08:00:00.000Z',
          addedBy: 'b',
        },
        { id: 'g2', label: 'Pain', done: false, doneAt: null },
      ],
      history: [
        { id: 'h1', label: 'Lait', quantity: '×2', category: 'frais', addedBy: 'a', boughtAt: '2026-10-10T18:00:00.000Z' },
        { id: 'h2', label: 'Café', boughtAt: '2026-10-09T18:00:00+02:00' },
      ],
    };
    const result = validateAppState(withGroceries(groceries));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.groceries).toEqual(groceries);
  });

  it('absents ou null → omis (doneAt null est conservé)', () => {
    const result = validateAppState(withGroceries({
      items: [{ id: 'g1', label: 'Riz', done: false, quantity: null, category: null, addedAt: null, addedBy: null, doneAt: null }],
      history: null,
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.groceries).toEqual({ items: [{ id: 'g1', label: 'Riz', done: false, doneAt: null }] });
  });

  it.each([
    [{ quantity: 2 }, 'grocery-invalid-quantity'],
    [{ category: 'rayon-inconnu' }, 'grocery-invalid-category'],
    [{ addedBy: 'c' }, 'grocery-invalid-added-by'],
    [{ addedAt: '2026-10-15' }, 'grocery-invalid-added-at'],
    [{ addedAt: 'hier' }, 'grocery-invalid-added-at'],
    [{ doneAt: '2026-02-30T10:00:00.000Z' }, 'grocery-invalid-done-at'],
    [{ doneAt: 5 }, 'grocery-invalid-done-at'],
  ])('article invalide %j → %s', (patch, reason) => {
    const result = validateAppState(withGroceries({ items: [{ id: 'g1', label: 'Lait', done: false, ...patch }] }));
    expect(result).toEqual({ ok: false, reason });
  });

  it.each([
    ['pas un tableau', { not: 'array' }, 'grocery-history-not-array'],
    ['entrée non objet', ['x'], 'grocery-history-not-object'],
    ['id vide', [{ id: '', label: 'A', boughtAt: NOW.toISOString() }], 'grocery-history-invalid-id'],
    ['libellé', [{ id: 'h', label: 3, boughtAt: NOW.toISOString() }], 'grocery-history-invalid-label'],
    ['date', [{ id: 'h', label: 'A', boughtAt: '2026-10-15' }], 'grocery-history-invalid-bought-at'],
    ['rayon', [{ id: 'h', label: 'A', category: 'x', boughtAt: NOW.toISOString() }], 'grocery-history-invalid-category'],
    ['doublon', [
      { id: 'h', label: 'A', boughtAt: NOW.toISOString() },
      { id: 'h', label: 'B', boughtAt: NOW.toISOString() },
    ], 'duplicate-grocery-history-id'],
  ])('historique invalide (%s) → raison stable', (_name, history, reason) => {
    const result = validateAppState(withGroceries({ items: [], history }));
    expect(result).toEqual({ ok: false, reason });
  });

  it('un parcours complet (ajout, panier, vidage) survit à l’aller-retour JSON', () => {
    const state: AppState = emptyAppState();
    let items = addGroceryItem([], '2 pommes', { id: 'g1', now: NOW, addedBy: 'a' }).items;
    items = addGroceryItem(items, 'lessive', { id: 'g2', now: NOW }).items;
    items = toggleGroceryItem(items, 'g1', NOW);
    state.groceries = clearDoneGroceries({ items }, NOW);
    const result = migrateState(roundTrip(state));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.groceries).toEqual(state.groceries);
    expect(result.state.groceries.history).toHaveLength(1);
  });
});

describe('restoreGroceryItem (annuler un retrait)', () => {
  const items: GroceryItem[] = [
    { id: 'a', label: 'Lait', done: false },
    { id: 'b', label: 'Pain', done: false },
    { id: 'c', label: 'Café', done: false },
  ];

  it('remet l’article à sa position d’origine', () => {
    const removed = removeGroceryItem(items, 'b');
    expect(restoreGroceryItem(removed, items[1]!, 1)).toEqual(items);
  });

  it('position bornée ; id déjà présent → même référence', () => {
    const removed = removeGroceryItem(items, 'c');
    expect(restoreGroceryItem(removed, items[2]!, 99).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(restoreGroceryItem(removed, items[2]!, -4).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(restoreGroceryItem(items, items[0]!, 0)).toBe(items);
  });
});
