import { describe, expect, it } from 'vitest';
import type { GroceryPurchase } from '@a2/core';
import { purchaseLines } from './purchaseLines';

let n = 0;
const bought = (label: string, quantity?: string): GroceryPurchase => ({
  id: `p${++n}`,
  label,
  ...(quantity !== undefined ? { quantity } : {}),
  boughtAt: '2026-10-07T10:00:00.000Z',
});

const shown = (lines: ReturnType<typeof purchaseLines>) => lines.map((l) => (l.quantity ? `${l.label} ${l.quantity}` : l.label));

describe('historique des courses : achats identiques combinés', () => {
  it('casse, accents et pluriel simple ignorés ; libellé du plus récent', () => {
    const lines = purchaseLines([bought('Pommes'), bought('pomme'), bought('Lait'), bought('POMMES'), bought('Café'), bought('cafe')]);
    expect(shown(lines)).toEqual(['Pommes ×3', 'Lait', 'Café ×2']);
  });

  it('les comptes s’additionnent, une mesure est gardée', () => {
    expect(shown(purchaseLines([bought('Pommes', '×2'), bought('Pommes')]))).toEqual(['Pommes ×3']);
    expect(shown(purchaseLines([bought('Œufs', '×6')]))).toEqual(['Œufs ×6']);
    expect(shown(purchaseLines([bought('Farine', '500 g'), bought('Farine', '500 g')]))).toEqual(['Farine 500 g ×2']);
    expect(shown(purchaseLines([bought('Farine', '1 kg'), bought('Farine', '×2'), bought('Farine')]))).toEqual(['Farine ×3 + 1 kg']);
  });

  it('un seul achat : inchangé', () => {
    expect(purchaseLines([bought('Riz')])).toEqual([{ id: expect.any(String), label: 'Riz' }]);
  });
});
