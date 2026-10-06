import { describe, expect, it } from 'vitest';
import {
  anchorBalance,
  balanceStatus,
  currentBalanceEstimate,
  endOfMonthProjection,
  openingBalance,
  recordBalanceCorrection,
  restoreBalanceCorrection,
  BALANCE_ANCHOR_NOTE,
  type BalanceSource,
} from './accountBalance.js';
import { formatEuros } from './euros.js';
import { monthFlows } from './monthFlows.js';
import { setExpensePaid, setTransferPaid } from './payments.js';
import { createMonthRecord, defaultSettings, ensureMonth, emptyState } from './state.js';
import type { MonthRecord } from './types.js';

const AT = '2026-10-05T19:00:00.000Z';

/** Deux salaires de 1 501 € à 40 % : 600,40 € chacun → affichés 601 € + 600 €. */
function oddMonth(): MonthRecord {
  const m = createMonthRecord('2026-10', defaultSettings());
  return {
    ...m,
    salaryACents: 150_100,
    salaryBCents: 150_100,
    expenses: [
      { id: 'e1', label: 'Loyer', amountCents: 80_050 },
      { id: 'e2', label: 'Box', amountCents: 2_050 },
      { id: 'e3', label: 'Eau', amountCents: 1_234 },
    ],
  };
}

describe('mouvements affichés du mois (monthFlows)', () => {
  it('virements et dépenses en euros entiers, totaux cohérents', () => {
    const f = monthFlows(oddMonth());
    expect(f.transferACents).toBe(60_100);
    expect(f.transferBCents).toBe(60_000);
    expect(f.transfersTotalCents).toBe(120_100);
    const rows = Object.values(f.expenseCents);
    rows.forEach((v) => expect(v % 100).toBe(0));
    expect(rows.reduce((a, b) => a + b, 0)).toBe(f.expensesTotalCents);
    expect(f.expensesTotalCents).toBe(83_300); // 833,34 € → 833 €
    expect(f.netCents).toBe(120_100 - 83_300);
  });

  it('cocher A seul : le solde bouge exactement de la ligne affichée', () => {
    const src = { months: [setTransferPaid(oddMonth(), 'A', true)] };
    const delta = currentBalanceEstimate(src, '2026-10') - openingBalance(src, '2026-10');
    expect(formatEuros(delta)).toBe(formatEuros(monthFlows(oddMonth()).transferACents));
    expect(delta).toBe(60_100);
  });

  it('cocher une dépense héritée avec centimes : même montant que sa ligne', () => {
    const m = setExpensePaid(oddMonth(), 'e3', true);
    const src = { months: [m] };
    expect(openingBalance(src, '2026-10') - currentBalanceEstimate(src, '2026-10')).toBe(monthFlows(m).expenseCents.e3);
  });

  it('tout coché = projection de fin de mois', () => {
    let m = setTransferPaid(setTransferPaid(oddMonth(), 'A', true), 'B', true);
    for (const id of ['e1', 'e2', 'e3']) m = setExpensePaid(m, id, true);
    const src = { months: [m] };
    expect(currentBalanceEstimate(src, '2026-10')).toBe(endOfMonthProjection(src, '2026-10'));
  });

  it('une correction héritée avec centimes est lue à l’euro', () => {
    const src = recordBalanceCorrection({ months: [oddMonth()] }, '2026-10', 12_345, { id: 'c', recordedAt: AT });
    expect(openingBalance(src, '2026-10')).toBe(12_300);
  });
});

describe('consulter un mois ne change pas le solde', () => {
  it('ensureMonth sur un mois passé jamais ouvert change le report (raison du mois virtuel du store)', () => {
    const base = ensureMonth(emptyState(), '2026-10');
    const before = currentBalanceEstimate(base, '2026-10');
    const viewed = ensureMonth(base, '2026-09');
    // Créer le mois l'ajoute au report : le store ne doit donc pas le créer à la consultation.
    expect(currentBalanceEstimate(viewed, '2026-10')).not.toBe(before);
    // Sans création (mois virtuel), le solde du mois courant est inchangé.
    expect(currentBalanceEstimate({ months: base.months }, '2026-10')).toBe(before);
  });
});

describe('ancrage des données d’avant le solde', () => {
  const list = ['2026-02', '2026-03', '2026-10'].map((k) => createMonthRecord(k, defaultSettings()));
  const bare = (months: MonthRecord[]): BalanceSource => ({ months });

  it('pose 0 € au début du mois courant quand il y a un historique', () => {
    const anchored = anchorBalance(bare(list), '2026-10', { id: 'a', recordedAt: AT });
    expect(anchored.balance?.corrections).toEqual([
      { id: 'a', monthKey: '2026-10', balanceCents: 0, recordedAt: AT, note: BALANCE_ANCHOR_NOTE },
    ]);
    expect(openingBalance(anchored, '2026-10')).toBe(0);
    expect(balanceStatus(anchored)).toEqual({ confirmed: false, sinceMonthKey: '2026-10' });
  });

  it('ne touche à rien si le solde existe déjà ou sans mois antérieur', () => {
    const withBalance = { months: list, balance: { corrections: [] } };
    expect(anchorBalance(withBalance, '2026-10', { id: 'a', recordedAt: AT })).toBe(withBalance);
    const fresh = { months: [list[2]!] };
    expect(anchorBalance(fresh, '2026-10', { id: 'a', recordedAt: AT })).toBe(fresh);
    expect(balanceStatus(fresh)).toEqual({ confirmed: false, sinceMonthKey: '2026-10' });
  });

  it('un vrai recalage confirme le solde', () => {
    const anchored = anchorBalance(bare(list), '2026-10', { id: 'a', recordedAt: AT });
    const real = recordBalanceCorrection(anchored, '2026-10', 150_000, { id: 'b', recordedAt: AT });
    expect(balanceStatus(real).confirmed).toBe(true);
  });
});

describe('restoreBalanceCorrection (annuler un recalage)', () => {
  it('réinsère la correction à l’identique, centimes et horodatage compris', () => {
    const old = { id: 'c1', monthKey: '2026-10', balanceCents: 12_345, recordedAt: '2026-09-01T08:00:00.000Z', note: 'x' };
    const src = recordBalanceCorrection({ months: [], balance: { corrections: [old] } }, '2026-10', 50_000, {
      id: 'c2',
      recordedAt: AT,
    });
    const back = restoreBalanceCorrection(src, old);
    expect(back.balance?.corrections).toEqual([old]);
  });

  it('refuse une correction invalide', () => {
    expect(() =>
      restoreBalanceCorrection({ months: [] }, { id: '', monthKey: '2026-10', balanceCents: 0, recordedAt: AT }),
    ).toThrow(RangeError);
  });
});
