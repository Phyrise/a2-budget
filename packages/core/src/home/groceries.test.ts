import { describe, expect, it } from 'vitest';
import {
  GROCERY_CATEGORIES,
  GROCERY_HISTORY_MAX,
  addGroceryItem,
  categorizeGrocery,
  clearDoneGroceries,
  clearedGroceries,
  groceryKey,
  grocerySuggestions,
  groupGroceryItems,
  normalizeGroceryLabel,
  normalizeGroceryQuantity,
  parseGroceryInput,
  recentGroceryPurchases,
  removeGroceryItem,
  toggleGroceryItem,
  undoClearGroceries,
  updateGroceryItem,
} from './groceries.js';
import type { GroceriesState, GroceryItem, GroceryPurchase } from './types.js';

const NBSP = ' ';
const NOW = new Date('2026-10-15T09:00:00.000Z');
const LATER = new Date('2026-10-15T18:30:00.000Z');

function item(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return { id: 'g1', label: 'Lait', done: false, ...overrides };
}

describe('GROCERY_CATEGORIES', () => {
  it('liste chaque rayon une fois, « autre » en dernier, libellés français', () => {
    const ids = GROCERY_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'fruits-legumes', 'boulangerie', 'frais', 'epicerie', 'boissons',
      'surgeles', 'hygiene', 'maison', 'autre',
    ]);
    expect(GROCERY_CATEGORIES[0]!.label).toBe('Fruits & légumes');
    expect(GROCERY_CATEGORIES.find((c) => c.id === 'epicerie')!.label).toBe('Épicerie');
  });
});

describe('parseGroceryInput (quantité simple)', () => {
  it.each([
    ['2 pommes', 'Pommes', '×2'],
    ['12 œufs', 'Œufs', '×12'],
    ['lait x2', 'Lait', '×2'],
    ['lait ×2', 'Lait', '×2'],
    ['lait x 3', 'Lait', '×3'],
    ['lait (2)', 'Lait', '×2'],
    ['2x bières', 'Bières', '×2'],
    ['x3 yaourts', 'Yaourts', '×3'],
    ['500 g de farine', 'Farine', `500${NBSP}g`],
    ['500g farine', 'Farine', `500${NBSP}g`],
    ['farine 500 g', 'Farine', `500${NBSP}g`],
    ['1,5 kg pommes de terre', 'Pommes de terre', `1,5${NBSP}kg`],
    ['1.5 L de lait', 'Lait', `1,5${NBSP}l`],
    ['2 litres de jus', 'Jus', `2${NBSP}l`],
    ['1 kilo de carottes', 'Carottes', `1${NBSP}kg`],
    ["1 kg d'oranges", 'Oranges', `1${NBSP}kg`],
    ['2 paquets de pâtes', 'Pâtes', `2${NBSP}paquets`],
    ["6 bouteilles d'eau", 'Eau', `6${NBSP}bouteilles`],
  ])('« %s » → %s · %s', (raw, label, quantity) => {
    expect(parseGroceryInput(raw)).toEqual({ label, quantity });
  });

  it('×1 est omis', () => {
    expect(parseGroceryInput('1 baguette')).toEqual({ label: 'Baguette' });
    expect(parseGroceryInput('lait x1')).toEqual({ label: 'Lait' });
  });

  it("ne détourne pas les nombres qui font partie du nom", () => {
    expect(parseGroceryInput('2026 calendrier')).toEqual({ label: '2026 calendrier' });
    expect(parseGroceryInput('7up')).toEqual({ label: '7up' });
    expect(parseGroceryInput('Pastis 51')).toEqual({ label: 'Pastis 51' });
    expect(parseGroceryInput('0 pomme')).toEqual({ label: '0 pomme' });
    expect(parseGroceryInput('2 l')).toEqual({ label: 'L', quantity: '×2' });
  });

  it('normalise le libellé (espaces, initiale, article superflu)', () => {
    expect(parseGroceryInput('  du   café  ')).toEqual({ label: 'Café' });
    expect(parseGroceryInput("de l'huile d'olive")).toEqual({ label: "Huile d'olive" });
    expect(parseGroceryInput('une salade')).toEqual({ label: 'Salade' });
    expect(parseGroceryInput('dulce de leche')).toEqual({ label: 'Dulce de leche' });
    expect(parseGroceryInput('Desperados')).toEqual({ label: 'Desperados' });
    expect(parseGroceryInput('   ')).toEqual({ label: '' });
  });
});

describe('normalizeGroceryLabel / normalizeGroceryQuantity / groceryKey', () => {
  it('capitalise sans casser les marques en casse mixte', () => {
    expect(normalizeGroceryLabel('œufs bio')).toBe('Œufs bio');
    expect(normalizeGroceryLabel('iPhone câble')).toBe('iPhone câble');
    expect(normalizeGroceryLabel('a'.repeat(300))).toHaveLength(120);
  });

  it('normalise une quantité saisie à part', () => {
    expect(normalizeGroceryQuantity('2')).toBe('×2');
    expect(normalizeGroceryQuantity('x2')).toBe('×2');
    expect(normalizeGroceryQuantity('3x')).toBe('×3');
    expect(normalizeGroceryQuantity('500g')).toBe(`500${NBSP}g`);
    expect(normalizeGroceryQuantity('1.5 kg')).toBe(`1,5${NBSP}kg`);
    expect(normalizeGroceryQuantity('un gros')).toBe('un gros');
    expect(normalizeGroceryQuantity('1')).toBeUndefined();
    expect(normalizeGroceryQuantity('  ')).toBeUndefined();
  });

  it('identité d’article insensible aux accents, à la casse et au pluriel', () => {
    expect(groceryKey('Pommes')).toBe(groceryKey('pomme'));
    expect(groceryKey('OEUFS')).toBe(groceryKey('œuf'));
    expect(groceryKey('Crème fraîche')).toBe(groceryKey('creme fraiche'));
    expect(groceryKey('Lait')).not.toBe(groceryKey('Pain'));
  });
});

describe('categorizeGrocery (mots-clés français)', () => {
  it.each([
    ['Pommes', 'fruits-legumes'],
    ['Pommes de terre', 'fruits-legumes'],
    ['Chou-fleur', 'fruits-legumes'],
    ['Tomates cerises', 'fruits-legumes'],
    ['Baguette', 'boulangerie'],
    ['Pain de mie', 'boulangerie'],
    ['Lait', 'frais'],
    ['Yaourts nature', 'frais'],
    ['Fromage râpé', 'frais'],
    ['Œufs', 'frais'],
    ['oeufs', 'frais'],
    ['Beurre doux', 'frais'],
    ['Crème fraîche', 'frais'],
    ['Jambon', 'frais'],
    ['Saumon', 'frais'],
    ['Pâte à tarte', 'frais'],
    ['Pâtes', 'epicerie'],
    ['Riz basmati', 'epicerie'],
    ['Farine', 'epicerie'],
    ['Sucre', 'epicerie'],
    ['Café', 'epicerie'],
    ['Thé vert', 'epicerie'],
    ["Huile d'olive", 'epicerie'],
    ['Conserves de thon', 'epicerie'],
    ['Sauce tomate', 'epicerie'],
    ['Lait de coco', 'epicerie'],
    ["Jus d'orange", 'boissons'],
    ['Eau gazeuse', 'boissons'],
    ['Bières', 'boissons'],
    ["Lait d'avoine", 'boissons'],
    ['Glace vanille', 'surgeles'],
    ['Petits pois surgelés', 'surgeles'],
    ['Épinards congelés', 'surgeles'],
    ['Dentifrice', 'hygiene'],
    ['Gel douche', 'hygiene'],
    ['Crème solaire', 'hygiene'],
    ['Lessive', 'maison'],
    ['Éponges', 'maison'],
    ['Papier toilette', 'maison'],
    ['Essuie-tout', 'maison'],
    ['Liquide vaisselle', 'maison'],
    ['Vinaigre blanc', 'maison'],
    ['Eau de javel', 'maison'],
    ['Truc bizarre', 'autre'],
    ['', 'autre'],
  ])('« %s » → %s', (label, category) => {
    expect(categorizeGrocery(label)).toBe(category);
  });
});

describe('addGroceryItem', () => {
  it('ajoute en fin de liste avec quantité, rayon, horodatage et auteur', () => {
    const items = [item()];
    const before = structuredClone(items);
    const result = addGroceryItem(items, '500 g de farine', { id: 'g2', now: NOW, addedBy: 'b' });
    expect(result.added).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toEqual({
      id: 'g2',
      label: 'Farine',
      done: false,
      quantity: `500${NBSP}g`,
      category: 'epicerie',
      addedAt: NOW.toISOString(),
      doneAt: null,
      addedBy: 'b',
    });
    expect(result.item).toBe(result.items[1]);
    expect(items).toEqual(before); // pur
  });

  it('sans quantité ni auteur, ces champs sont absents', () => {
    const { item: added } = addGroceryItem([], 'pain', { id: 'g2', now: NOW });
    expect(added).not.toBeNull();
    expect('quantity' in added!).toBe(false);
    expect('addedBy' in added!).toBe(false);
    expect(added!.category).toBe('boulangerie');
  });

  it('saisie vide → aucun changement (même référence)', () => {
    const items = [item()];
    const result = addGroceryItem(items, '   ', { id: 'g2', now: NOW });
    expect(result).toEqual({ items, item: null, added: false });
    expect(result.items).toBe(items);
  });

  it('article identique non coché → pas de doublon', () => {
    const items = [item({ label: 'Pommes' })];
    const result = addGroceryItem(items, 'pomme', { id: 'g2', now: NOW });
    expect(result.added).toBe(false);
    expect(result.items).toBe(items);
    expect(result.item).toBe(items[0]);
  });

  it('doublon avec une nouvelle quantité → la quantité est mise à jour', () => {
    const items = [item({ label: 'Lait', quantity: '×2' })];
    const result = addGroceryItem(items, 'lait x3', { id: 'g2', now: NOW });
    expect(result.added).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.quantity).toBe('×3');
    expect(items[0]!.quantity).toBe('×2'); // pur
  });

  it('un article identique déjà au panier n’empêche pas de le reprendre', () => {
    const items = [item({ done: true, doneAt: NOW.toISOString() })];
    const result = addGroceryItem(items, 'lait', { id: 'g2', now: LATER });
    expect(result.added).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('accepte un rayon imposé', () => {
    const { item: added } = addGroceryItem([], 'Truc', { id: 'g2', now: NOW, category: 'maison' });
    expect(added!.category).toBe('maison');
  });
});

describe('toggleGroceryItem / removeGroceryItem', () => {
  it('cocher pose doneAt, décocher le remet à null', () => {
    const items = [item()];
    const checked = toggleGroceryItem(items, 'g1', NOW);
    expect(checked[0]).toMatchObject({ done: true, doneAt: NOW.toISOString() });
    expect(items[0]!.done).toBe(false); // pur
    const unchecked = toggleGroceryItem(checked, 'g1', LATER);
    expect(unchecked[0]).toMatchObject({ done: false, doneAt: null });
  });

  it('id inconnu → même référence', () => {
    const items = [item()];
    expect(toggleGroceryItem(items, 'nope', NOW)).toBe(items);
    expect(removeGroceryItem(items, 'nope')).toBe(items);
  });

  it('retire exactement l’article visé', () => {
    const items = [item(), item({ id: 'g2', label: 'Pain' })];
    expect(removeGroceryItem(items, 'g1')).toEqual([items[1]]);
  });
});

describe('updateGroceryItem', () => {
  it('renommer recalcule le rayon et extrait une quantité incluse', () => {
    const items = [item({ category: 'frais' })];
    const next = updateGroceryItem(items, 'g1', { label: 'lessive x2' });
    expect(next[0]).toMatchObject({ label: 'Lessive', quantity: '×2', category: 'maison' });
    expect(items[0]!.label).toBe('Lait'); // pur
  });

  it('un rayon explicite l’emporte ; null revient au rayon automatique', () => {
    const items = [item()];
    const forced = updateGroceryItem(items, 'g1', { label: 'Lait de chèvre', category: 'autre' });
    expect(forced[0]!.category).toBe('autre');
    const auto = updateGroceryItem(forced, 'g1', { category: null });
    expect(auto[0]!.category).toBe('frais');
  });

  it('quantité : normalisée, ou retirée avec null / vide', () => {
    const items = [item({ quantity: '×2' })];
    expect(updateGroceryItem(items, 'g1', { quantity: '500g' })[0]!.quantity).toBe(`500${NBSP}g`);
    expect('quantity' in updateGroceryItem(items, 'g1', { quantity: null })[0]!).toBe(false);
    expect('quantity' in updateGroceryItem(items, 'g1', { quantity: ' ' })[0]!).toBe(false);
  });

  it('champs invalides ignorés ; patch sans effet → même référence', () => {
    const items = [item({ category: 'frais' })];
    expect(updateGroceryItem(items, 'g1', { label: '   ' })).toBe(items);
    expect(updateGroceryItem(items, 'g1', { label: 'Lait' })).toBe(items);
    expect(updateGroceryItem(items, 'g1', { category: 'rayon-inconnu' as never })).toBe(items);
    expect(updateGroceryItem(items, 'nope', { label: 'Pain' })).toBe(items);
  });
});

describe('clearDoneGroceries (vider le panier) + historique', () => {
  const state: GroceriesState = {
    items: [
      item({ id: 'g1', label: 'Lait', done: true, doneAt: NOW.toISOString(), addedBy: 'a', category: 'frais' }),
      item({ id: 'g2', label: 'Pain', done: false }),
      item({ id: 'g3', label: 'Lessive', done: true, doneAt: LATER.toISOString(), quantity: '×2' }),
    ],
  };

  it('retire les articles cochés et les archive (plus récent en tête)', () => {
    const before = structuredClone(state);
    const next = clearDoneGroceries(state, new Date('2026-10-16T08:00:00.000Z'));
    expect(next.items.map((i) => i.id)).toEqual(['g2']);
    expect(next.history).toEqual([
      { id: 'g3', label: 'Lessive', quantity: '×2', category: 'maison', boughtAt: LATER.toISOString() },
      { id: 'g1', label: 'Lait', category: 'frais', addedBy: 'a', boughtAt: NOW.toISOString() },
    ]);
    expect(state).toEqual(before); // pur
  });

  it('panier vide → même référence', () => {
    const empty: GroceriesState = { items: [item()] };
    expect(clearDoneGroceries(empty, NOW)).toBe(empty);
  });

  it('un article coché sans doneAt (ancien JSON) est daté du vidage', () => {
    const legacy: GroceriesState = { items: [{ id: 'old', label: 'Riz', done: true }] };
    const next = clearDoneGroceries(legacy, NOW);
    expect(next.history![0]!.boughtAt).toBe(NOW.toISOString());
  });

  it(`l’historique est borné à ${GROCERY_HISTORY_MAX} achats`, () => {
    const history: GroceryPurchase[] = Array.from({ length: GROCERY_HISTORY_MAX }, (_, i) => ({
      id: `h${i}`,
      label: `Article ${i}`,
      boughtAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
    }));
    const next = clearDoneGroceries({ ...state, history }, LATER);
    expect(next.history).toHaveLength(GROCERY_HISTORY_MAX);
    expect(next.history![0]!.id).toBe('g3');
  });

  it('Annuler le vidage : articles cochés à leur place (ids neufs), achats retirés', () => {
    const old: GroceryPurchase = { id: 'h0', label: 'Riz', boughtAt: NOW.toISOString() };
    const before: GroceriesState = { ...state, history: [old] };
    const cleared = clearedGroceries(before);
    expect(cleared.map((c) => [c.item.id, c.index])).toEqual([['g1', 0], ['g3', 2]]);
    const emptied = clearDoneGroceries(before, LATER);
    const frozen = structuredClone(emptied);
    const undone = undoClearGroceries(emptied, cleared, ['n1', 'n3']);
    expect(undone.items.map((i) => `${i.id}:${i.label}:${i.done}`)).toEqual(['n1:Lait:true', 'g2:Pain:false', 'n3:Lessive:true']);
    expect(undone.items[2]).toEqual({ ...state.items[2], id: 'n3' });
    expect(undone.history).toEqual([old]);
    expect(emptied).toEqual(frozen); // pur
    // Une seconde fois : plus rien à annuler.
    expect(undoClearGroceries(undone, cleared, ['x1', 'x3'])).toBe(undone);
  });

  it('Annuler le vidage après d’autres gestes : place bornée, achat disparu ignoré', () => {
    const cleared = clearedGroceries(state);
    const emptied = clearDoneGroceries(state, LATER);
    const later: GroceriesState = { items: [], history: emptied.history!.filter((p) => p.id !== 'g1') };
    const undone = undoClearGroceries(later, cleared, ['n1', 'n3']);
    expect(undone.items.map((i) => i.id)).toEqual(['n3']);
    expect(undone.history).toEqual([]);
  });

  it('recentGroceryPurchases fusionne panier et historique, plus récent d’abord', () => {
    const cleared = clearDoneGroceries(state, LATER);
    const withBasket: GroceriesState = {
      ...cleared,
      items: [...cleared.items, item({ id: 'g4', label: 'Café', done: true, doneAt: '2026-10-17T10:00:00.000Z' })],
    };
    expect(recentGroceryPurchases(withBasket).map((p) => p.id)).toEqual(['g4', 'g3', 'g1']);
    expect(recentGroceryPurchases(withBasket, 1).map((p) => p.id)).toEqual(['g4']);
  });
});

describe('grocerySuggestions', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 9, d, 10)).toISOString();
  const history: GroceryPurchase[] = [
    { id: 'h1', label: 'Lait', boughtAt: day(1) },
    { id: 'h2', label: 'Lait', boughtAt: day(8) },
    { id: 'h3', label: 'lait', boughtAt: day(14) },
    { id: 'h4', label: 'Pain', boughtAt: day(10) },
    { id: 'h5', label: 'Pain', boughtAt: day(13) },
    { id: 'h6', label: 'Café', boughtAt: day(12) },
    { id: 'h7', label: 'Lessive', boughtAt: '2026-05-01T10:00:00.000Z' },
  ];

  it('classe par fréquence puis récence, libellé du dernier achat', () => {
    const s = grocerySuggestions([], 10, { history });
    expect(s.map((x) => x.label)).toEqual(['lait', 'Pain', 'Café', 'Lessive']);
    expect(s[0]).toMatchObject({ count: 3, lastBoughtAt: day(14), category: 'frais' });
  });

  it('exclut les articles déjà dans la liste (à acheter ou au panier)', () => {
    const items = [item({ label: 'Laits' }), item({ id: 'g2', label: 'pain', done: true, doneAt: day(15) })];
    const s = grocerySuggestions(items, 10, { history });
    expect(s.map((x) => x.label)).toEqual(['Café', 'Lessive']);
  });

  it('fenêtre récente (now + windowDays), minCount et limite n', () => {
    const now = new Date(Date.UTC(2026, 9, 15, 12));
    expect(grocerySuggestions([], 10, { history, now }).map((x) => x.label)).toEqual(['lait', 'Pain', 'Café']);
    expect(grocerySuggestions([], 10, { history, now, minCount: 2 }).map((x) => x.label)).toEqual(['lait', 'Pain']);
    expect(grocerySuggestions([], 1, { history })).toHaveLength(1);
    expect(grocerySuggestions([], 6)).toEqual([]);
  });
});

describe('groupGroceryItems', () => {
  it('groupe par rayon dans l’ordre d’affichage, panier trié par doneAt décroissant', () => {
    const items: GroceryItem[] = [
      item({ id: '1', label: 'Lessive' }),
      item({ id: '2', label: 'Pommes' }),
      item({ id: '3', label: 'Lait', category: 'frais' }),
      item({ id: '4', label: 'Bananes' }),
      item({ id: '5', label: 'Pain', done: true, doneAt: NOW.toISOString() }),
      item({ id: '6', label: 'Café', done: true, doneAt: LATER.toISOString() }),
    ];
    const { toBuy, basket } = groupGroceryItems(items);
    expect(toBuy.map((g) => g.category)).toEqual(['fruits-legumes', 'frais', 'maison']);
    expect(toBuy[0]!.label).toBe('Fruits & légumes');
    expect(toBuy[0]!.items.map((i) => i.id)).toEqual(['2', '4']);
    expect(basket.map((i) => i.id)).toEqual(['6', '5']);
  });
});
