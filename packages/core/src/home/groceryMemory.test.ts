import { describe, expect, it } from 'vitest';
import { addGroceryItem, rememberedCategory, updateGroceryItem } from './groceries.js';
import {
  forgetGroceryCategory,
  GROCERY_MEMORY_MAX,
  rememberGroceryCategory,
  validateGroceryMemory,
} from './groceryMemory.js';
import type { GroceryCategoryMemory } from './types.js';

const NOW = new Date(2026, 9, 5, 18, 0, 0);

describe('mémoire des rayons', () => {
  it('mémorise par clé normalisée (accents, casse, pluriels)', () => {
    const memory = rememberGroceryCategory(undefined, 'Tomates', 'epicerie');
    expect(memory).toEqual({ tomate: 'epicerie' });
    expect(rememberedCategory(memory, 'tomate')).toBe('epicerie');
    expect(rememberedCategory(memory, 'TOMATES')).toBe('epicerie');
    expect(rememberedCategory(memory, 'Lait')).toBeUndefined();
    expect(rememberedCategory(undefined, 'Lait')).toBeUndefined();
  });

  it('même valeur → même référence ; nouvelle valeur → la plus récente en dernier', () => {
    const m1 = rememberGroceryCategory(undefined, 'Tomates', 'epicerie')!;
    expect(rememberGroceryCategory(m1, 'tomate', 'epicerie')).toBe(m1);
    const m2 = rememberGroceryCategory(rememberGroceryCategory(m1, 'Lait', 'frais'), 'tomates', 'fruits-legumes')!;
    expect(Object.entries(m2)).toEqual([['lait', 'frais'], ['tomate', 'fruits-legumes']]);
    expect(rememberGroceryCategory(m1, '   ', 'frais')).toBe(m1);
  });

  it('bornée à GROCERY_MEMORY_MAX (les plus anciennes oubliées)', () => {
    let memory: GroceryCategoryMemory | undefined;
    for (let i = 0; i < GROCERY_MEMORY_MAX + 3; i++) memory = rememberGroceryCategory(memory, `article ${i}`, 'autre');
    expect(Object.keys(memory!)).toHaveLength(GROCERY_MEMORY_MAX);
    expect(rememberedCategory(memory, 'article 0')).toBeUndefined();
    expect(rememberedCategory(memory, `article ${GROCERY_MEMORY_MAX + 2}`)).toBe('autre');
  });

  it('oublier (retour au rayon automatique)', () => {
    const memory = rememberGroceryCategory(undefined, 'Tomates', 'epicerie');
    expect(forgetGroceryCategory(memory, 'tomate')).toEqual({});
    expect(forgetGroceryCategory(memory, 'lait')).toBe(memory);
    expect(forgetGroceryCategory(undefined, 'lait')).toBeUndefined();
  });

  it('les clés héritées d’Object ne sont jamais lues', () => {
    expect(rememberedCategory({}, 'constructor')).toBeUndefined();
    expect(rememberedCategory({}, 'toString')).toBeUndefined();
  });
});

describe('addGroceryItem / updateGroceryItem avec mémoire', () => {
  it('la mémoire passe avant les mots-clés', () => {
    expect(addGroceryItem([], 'tomates', { id: 'x', now: NOW }).item!.category).toBe('fruits-legumes');
    const memory = rememberGroceryCategory(undefined, 'tomates', 'epicerie');
    const r = addGroceryItem([], '2 tomates', { id: 'x', now: NOW, memory });
    expect(r.item).toMatchObject({ label: 'Tomates', quantity: '×2', category: 'epicerie' });
  });

  it('un rayon explicite passe avant la mémoire', () => {
    const memory = rememberGroceryCategory(undefined, 'tomates', 'epicerie');
    expect(addGroceryItem([], 'tomates', { id: 'x', now: NOW, memory, category: 'surgeles' }).item!.category).toBe('surgeles');
  });

  it('renommer sans rayon explicite consulte la mémoire', () => {
    const items = addGroceryItem([], 'lait', { id: 'x', now: NOW }).items;
    const memory = rememberGroceryCategory(undefined, 'tomates', 'epicerie');
    expect(updateGroceryItem(items, 'x', { label: 'Tomates' }, memory)[0]!.category).toBe('epicerie');
    expect(updateGroceryItem(items, 'x', { label: 'Tomates' })[0]!.category).toBe('fruits-legumes');
  });
});

describe('validateGroceryMemory', () => {
  it('recopie à l’identique', () => {
    const value = { tomate: 'epicerie', lait: 'frais' };
    expect(validateGroceryMemory(value)).toEqual({ ok: true, state: value });
  });

  it('types stricts', () => {
    expect(validateGroceryMemory([])).toEqual({ ok: false, reason: 'grocery-memory-not-object' });
    expect(validateGroceryMemory({ tomate: 'rayon-x' })).toEqual({ ok: false, reason: 'grocery-memory-invalid-category' });
    expect(validateGroceryMemory({ '': 'frais' })).toEqual({ ok: false, reason: 'grocery-memory-invalid-key' });
  });

  it('au-delà du maximum : les plus anciennes sont oubliées', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < GROCERY_MEMORY_MAX + 10; i++) big[`k${i}`] = 'autre';
    const r = validateGroceryMemory(big);
    expect(r.ok && Object.keys(r.state)).toHaveLength(GROCERY_MEMORY_MAX);
    expect(r.ok && 'k0' in r.state).toBe(false);
  });
});
