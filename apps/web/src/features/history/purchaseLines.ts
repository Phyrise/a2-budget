/**
 * Historique des Courses : dans une même journée, un article acheté
 * plusieurs fois n'apparaît qu'une fois (même `groceryKey` : casse, accents
 * et pluriels simples ignorés) — « Pommes » + « pomme » → « Pommes ×2 ».
 * Quantités : les comptes (absent = 1, « ×3 ») s'additionnent ; une mesure
 * (« 500 g ») est gardée, comptée si elle revient (« 500 g ×2 »).
 */
import { groceryKey, type GroceryPurchase } from '@a2/core';

export interface PurchaseLine {
  /** Id du premier achat combiné (clé de liste). */
  id: string;
  /** Libellé du plus récent. */
  label: string;
  /** « ×2 », « 500 g », « ×2 + 1 kg »… ; absent pour un seul article. */
  quantity?: string;
}

const TIMES = /^×(\d+)$/;

function combinedQuantity(group: readonly GroceryPurchase[]): string | undefined {
  let count = 0;
  const measures = new Map<string, number>();
  for (const p of group) {
    const times = p.quantity === undefined ? null : TIMES.exec(p.quantity);
    if (p.quantity === undefined || times !== null) count += times ? Number(times[1]) : 1;
    else measures.set(p.quantity, (measures.get(p.quantity) ?? 0) + 1);
  }
  const parts = count > 1 ? [`×${count}`] : [];
  for (const [quantity, n] of measures) parts.push(n > 1 ? `${quantity} ×${n}` : quantity);
  return parts.length > 0 ? parts.join(' + ') : undefined;
}

/** Combine les achats identiques, dans l'ordre de leur première apparition. */
export function purchaseLines(purchases: readonly GroceryPurchase[]): PurchaseLine[] {
  const groups = new Map<string, GroceryPurchase[]>();
  for (const p of purchases) {
    const key = groceryKey(p.label) || p.id;
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.values()].map((group) => {
    const quantity = combinedQuantity(group);
    return { id: group[0]!.id, label: group[0]!.label, ...(quantity !== undefined ? { quantity } : {}) };
  });
}
