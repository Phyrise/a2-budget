/**
 * Mouvements du mois sur le compte commun, en euros entiers (V4).
 *
 * Ce qui est affiché est ce qui bouge : chaque ligne « À payer ce mois »
 * (virement d'AL, d'AC, chaque dépense) est arrondie à l'euro, et ce sont
 * ces mêmes montants que le solde du compte commun additionne. Ainsi :
 *
 *   - cocher le virement d'AL (« 601 € ») fait monter le solde de 601 € ;
 *   - Σ lignes de dépenses = total « Dépenses communes » affiché ;
 *   - net du mois = A + B − dépenses, tous affichés.
 *
 * Virements : `roundEurosConsistent` (A + B = total « À verser » affiché :
 * c'est ce que chacun vire réellement). Dépenses : `splitRounded` (plus forts
 * restes ; Σ = arrondi du total exact). Les montants saisis en V4 sont déjà
 * des euros entiers : seules les données héritées avec centimes sont
 * concernées (écart < 1 € par ligne). Pur.
 */

import { computeMonthSummary } from './calculations.js';
import { roundEurosConsistent, splitRounded } from './euros.js';
import { isExpensePaid, isTransferPaid } from './payments.js';
import type { MonthRecordInput } from './types.js';

export interface MonthFlows {
  /** Virement d'A affiché (euros entiers, en centimes). */
  transferACents: number;
  /** Virement de B affiché. */
  transferBCents: number;
  /** A + B (= total « À verser » affiché). */
  transfersTotalCents: number;
  /** Montant affiché de chaque dépense, par id. */
  expenseCents: Record<string, number>;
  /** Σ des dépenses affichées (= total « Dépenses communes »). */
  expensesTotalCents: number;
  /** Net du mois : virements − dépenses (peut être négatif). */
  netCents: number;
}

/** Mouvements arrondis du mois (voir l'en-tête). */
export function monthFlows(month: MonthRecordInput): MonthFlows {
  const s = computeMonthSummary(month);
  const t = roundEurosConsistent(s.contributionACents, s.contributionBCents);
  const rounded = splitRounded(month.expenses.map((e) => e.amountCents));
  const expenseCents: Record<string, number> = {};
  let expensesTotalCents = 0;
  month.expenses.forEach((e, i) => {
    const v = rounded[i]!;
    expenseCents[e.id] = (expenseCents[e.id] ?? 0) + v;
    expensesTotalCents += v;
  });
  return {
    transferACents: t.aCents,
    transferBCents: t.bCents,
    transfersTotalCents: t.totalCents,
    expenseCents,
    expensesTotalCents,
    netCents: t.totalCents - expensesTotalCents,
  };
}

/**
 * Ce qui est déjà passé sur le compte ce mois-ci, d'après les cases cochées,
 * avec les montants affichés : `{ transfersCents, expensesCents }`.
 */
export function paidFlows(month: MonthRecordInput): { transfersCents: number; expensesCents: number } {
  const f = monthFlows(month);
  let transfersCents = 0;
  if (isTransferPaid(month, 'A')) transfersCents += f.transferACents;
  if (isTransferPaid(month, 'B')) transfersCents += f.transferBCents;
  let expensesCents = 0;
  const seen = new Set<string>();
  for (const e of month.expenses) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    if (isExpensePaid(month, e.id)) expensesCents += f.expenseCents[e.id] ?? 0;
  }
  return { transfersCents, expensesCents };
}
