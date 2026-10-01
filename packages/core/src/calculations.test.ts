import { describe, expect, it } from 'vitest';
import {
  computeContributionBreakdown,
  computeMonthSummary,
  MAX_AMOUNT_CENTS,
  MAX_RATE_BPS,
} from './index.js';
import type { MonthRecord, PersonSettings } from './types.js';

const personA = (): PersonSettings => ({
  id: 'a',
  name: 'A',
  baseSalaryCents: 220_000,
  baseRateBps: 4000,
  variableRateBps: 2000,
});

const personB = (): PersonSettings => ({
  id: 'b',
  name: 'B',
  baseSalaryCents: 300_000,
  baseRateBps: 4000,
  variableRateBps: 2000,
});

/** Mois de test avec les dépenses récurrentes par défaut (total 1845 €). */
function makeMonth(
  salaryACents: number,
  salaryBCents: number,
  overrides: Partial<MonthRecord> = {},
): MonthRecord {
  return {
    monthKey: '2026-10',
    personA: personA(),
    personB: personB(),
    salaryACents,
    salaryBCents,
    expenses: [
      { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
      { id: 'electricity', label: 'Électricité', amountCents: 10_000 },
      { id: 'groceries', label: 'Courses', amountCents: 40_000 },
      { id: 'internet', label: 'Internet', amountCents: 3_000 },
      { id: 'insurance', label: 'Assurance', amountCents: 1_500 },
      { id: 'other', label: 'Autres', amountCents: 0 },
    ],
    reserveTargetCents: 0,
    ...overrides,
  };
}

describe('computeContributionBreakdown — tableau de référence (CONTRACTS §8)', () => {
  const rows: Array<[number, number, number, number, number, number]> = [
    // [salaire A, salaire B, contrib. A, contrib. B, total, reste]
    [220_000, 300_000, 88_000, 120_000, 208_000, 23_500],
    [220_000, 350_000, 88_000, 130_000, 218_000, 33_500],
    [220_000, 367_500, 88_000, 133_500, 221_500, 37_000],
    [220_000, 400_000, 88_000, 140_000, 228_000, 43_500],
  ];

  it.each(rows)(
    'A=%i B=%i → A=%i B=%i total=%i reste=%i',
    (salaryA, salaryB, contribA, contribB, total, remaining) => {
      const summary = computeMonthSummary(makeMonth(salaryA, salaryB));
      expect(summary.contributionACents).toBe(contribA);
      expect(summary.contributionBCents).toBe(contribB);
      expect(summary.householdContributionCents).toBe(total);
      expect(summary.expensesTotalCents).toBe(184_500);
      expect(summary.remainingCents).toBe(remaining);
    },
  );
});

describe('computeContributionBreakdown — cas particuliers', () => {
  it('salaire inférieur à la base : A = 1800 € → 720 €', () => {
    const b = computeContributionBreakdown(180_000, personA());
    expect(b.baseIncomeCents).toBe(180_000);
    expect(b.variableIncomeCents).toBe(0);
    expect(b.contributionCents).toBe(72_000);
  });

  it('revenu nul → contribution nulle', () => {
    const b = computeContributionBreakdown(0, personA());
    expect(b).toEqual({
      baseIncomeCents: 0,
      variableIncomeCents: 0,
      baseContributionCents: 0,
      variableContributionCents: 0,
      contributionCents: 0,
    });
  });

  it('revenu égal à la base : toute la tranche au taux de base', () => {
    const b = computeContributionBreakdown(220_000, personA());
    expect(b.baseIncomeCents).toBe(220_000);
    expect(b.variableIncomeCents).toBe(0);
    expect(b.contributionCents).toBe(88_000);
  });

  it('taux 0 → contribution nulle', () => {
    const p: PersonSettings = { ...personA(), baseRateBps: 0, variableRateBps: 0 };
    expect(computeContributionBreakdown(500_000, p).contributionCents).toBe(0);
  });

  it('taux 100 % → contribution égale au revenu', () => {
    const p: PersonSettings = { ...personA(), baseRateBps: 10_000, variableRateBps: 10_000 };
    expect(computeContributionBreakdown(500_000, p).contributionCents).toBe(500_000);
  });

  it('taux 33,33 % (3333 bps) sur la tranche de base', () => {
    const p: PersonSettings = { ...personA(), baseRateBps: 3333, variableRateBps: 3333 };
    // floor((220000 × 3333 + 5000) / 10000) = floor(73326.5) = 73326
    const b = computeContributionBreakdown(220_000, p);
    expect(b.baseContributionCents).toBe(73_326);
    expect(b.contributionCents).toBe(73_326);
  });

  it('arrondi au demi-centime : 1,25 € × 50 % → 63 c', () => {
    const p: PersonSettings = {
      ...personA(),
      baseSalaryCents: 125,
      baseRateBps: 5000,
      variableRateBps: 0,
    };
    // 125 × 5000 = 625000 ; (625000 + 5000) / 10000 = 63,0 → 63
    expect(computeContributionBreakdown(125, p).contributionCents).toBe(63);
  });

  it('chaque tranche est arrondie séparément avant l’addition', () => {
    // base : 101 c × 50 % = 50,5 → 51 ; variable : 101 c × 50 % = 50,5 → 51 ; total 102
    const p: PersonSettings = {
      ...personA(),
      baseSalaryCents: 101,
      baseRateBps: 5000,
      variableRateBps: 5000,
    };
    const b = computeContributionBreakdown(202, p);
    expect(b.baseContributionCents).toBe(51);
    expect(b.variableContributionCents).toBe(51);
    expect(b.contributionCents).toBe(102);
  });
});

describe('computeMonthSummary — réserve et déficit', () => {
  it('réserve insuffisante (cas 3 + réserve 500 €) : loisirs 0, non couvert 130 €', () => {
    const summary = computeMonthSummary(
      makeMonth(220_000, 367_500, { reserveTargetCents: 50_000 }),
    );
    expect(summary.remainingCents).toBe(37_000);
    expect(summary.leisureCents).toBe(0);
    expect(summary.reserveCovered).toBe(false);
    expect(summary.reserveShortfallCents).toBe(13_000);
  });

  it('réserve couverte : loisirs = reste − réserve', () => {
    const summary = computeMonthSummary(
      makeMonth(220_000, 400_000, { reserveTargetCents: 20_000 }),
    );
    expect(summary.remainingCents).toBe(43_500);
    expect(summary.leisureCents).toBe(23_500);
    expect(summary.reserveCovered).toBe(true);
    expect(summary.reserveShortfallCents).toBe(0);
  });

  it('réserve nulle : couverte par convention, loisirs = reste', () => {
    const summary = computeMonthSummary(makeMonth(220_000, 300_000));
    expect(summary.reserveCovered).toBe(true);
    expect(summary.leisureCents).toBe(23_500);
    expect(summary.reserveShortfallCents).toBe(0);
  });

  it('déficit : remainingCents négatif, jamais masqué', () => {
    const summary = computeMonthSummary(
      makeMonth(220_000, 300_000, {
        expenses: [{ id: 'big', label: 'Travaux', amountCents: 300_000 }],
      }),
    );
    expect(summary.householdContributionCents).toBe(208_000);
    expect(summary.expensesTotalCents).toBe(300_000);
    expect(summary.remainingCents).toBe(-92_000);
    expect(summary.leisureCents).toBe(0);
    // Formule du contrat : max(0, réserve − reste) = max(0, 0 − (−92000))
    expect(summary.reserveShortfallCents).toBe(92_000);
  });
});

describe('computeContributionBreakdown — entrées invalides', () => {
  it('salaire négatif', () => {
    expect(() => computeContributionBreakdown(-1, personA())).toThrow(RangeError);
  });

  it('salaire non entier', () => {
    expect(() => computeContributionBreakdown(100.5, personA())).toThrow(RangeError);
  });

  it('salaire NaN', () => {
    expect(() => computeContributionBreakdown(Number.NaN, personA())).toThrow(RangeError);
  });

  it('salaire Infinity', () => {
    expect(() => computeContributionBreakdown(Number.POSITIVE_INFINITY, personA())).toThrow(
      RangeError,
    );
  });

  it('salaire hors plage (> MAX_AMOUNT_CENTS)', () => {
    expect(() => computeContributionBreakdown(MAX_AMOUNT_CENTS + 1, personA())).toThrow(
      RangeError,
    );
  });

  it('salaire à la limite MAX_AMOUNT_CENTS est accepté', () => {
    expect(() => computeContributionBreakdown(MAX_AMOUNT_CENTS, personA())).not.toThrow();
  });

  it('taux négatif / > 10000 / non entier', () => {
    expect(() =>
      computeContributionBreakdown(1000, { ...personA(), baseRateBps: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      computeContributionBreakdown(1000, { ...personA(), variableRateBps: MAX_RATE_BPS + 1 }),
    ).toThrow(RangeError);
    expect(() =>
      computeContributionBreakdown(1000, { ...personA(), baseRateBps: 4000.5 }),
    ).toThrow(RangeError);
  });

  it('salaire de base invalide', () => {
    expect(() =>
      computeContributionBreakdown(1000, { ...personA(), baseSalaryCents: -5 }),
    ).toThrow(RangeError);
  });
});
