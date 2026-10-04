import { describe, expect, it } from 'vitest';
import {
  computeMonthSummary,
  createMonthRecord,
  defaultSettings,
  hasSharedRates,
  migrateState,
  monthIncomeCents,
  normalizeMonthIncome,
  setSharedRates,
  sharedRates,
  validateAppState,
  validatePersistedState,
} from './index.js';
import { V1_FIXTURES } from './home/fixtures/v1.js';
import type { MonthRecordInput, PersonSettings } from './types.js';

/** Ancienne formule (modèle à seuil, avant V3.1), recopiée telle quelle. */
function legacyContribution(salaryCents: number, person: PersonSettings): number {
  const base = Math.min(salaryCents, person.baseSalaryCents);
  const variable = Math.max(0, salaryCents - person.baseSalaryCents);
  return (
    Math.floor((base * person.baseRateBps + 5000) / 10000) +
    Math.floor((variable * person.variableRateBps + 5000) / 10000)
  );
}

function person(id: string, base: number, baseRate: number, variableRate: number): PersonSettings {
  return { id, name: id.toUpperCase(), baseSalaryCents: base, baseRateBps: baseRate, variableRateBps: variableRate };
}

function legacyMonth(
  salaryA: number,
  salaryB: number,
  personA = person('a', 220_000, 4000, 2000),
  personB = person('b', 300_000, 4000, 2000),
): MonthRecordInput {
  return {
    monthKey: '2026-10',
    personA,
    personB,
    salaryACents: salaryA,
    salaryBCents: salaryB,
    expenses: [{ id: 'rent', label: 'Loyer', amountCents: 130_000 }],
    reserveTargetCents: 0,
  };
}

/** Les contributions après normalisation sont celles de l'ancienne formule. */
function expectSameContributions(month: MonthRecordInput): void {
  const normalized = normalizeMonthIncome(month);
  const summary = computeMonthSummary(normalized);
  expect(summary.contributionACents).toBe(legacyContribution(month.salaryACents, month.personA));
  expect(summary.contributionBCents).toBe(legacyContribution(month.salaryBCents, month.personB));
}

describe('normalizeMonthIncome — ancien modèle → salaire + compléments', () => {
  it('sous le salaire de base : salaire inchangé, compléments 0', () => {
    const m = normalizeMonthIncome(legacyMonth(180_000, 250_000));
    expect([m.salaryACents, m.bonusACents, m.salaryBCents, m.bonusBCents]).toEqual([180_000, 0, 250_000, 0]);
    expectSameContributions(legacyMonth(180_000, 250_000));
  });

  it('égal au salaire de base : compléments 0', () => {
    const m = normalizeMonthIncome(legacyMonth(220_000, 300_000));
    expect([m.salaryACents, m.bonusACents, m.salaryBCents, m.bonusBCents]).toEqual([220_000, 0, 300_000, 0]);
    expectSameContributions(legacyMonth(220_000, 300_000));
  });

  it('au-dessus : l’excédent devient des compléments (B 3675 € → 3000 € + 675 €)', () => {
    const m = normalizeMonthIncome(legacyMonth(220_000, 367_500));
    expect([m.salaryBCents, m.bonusBCents]).toEqual([300_000, 67_500]);
    const summary = computeMonthSummary(m);
    expect(summary.contributionBCents).toBe(133_500);
    expect(summary.householdContributionCents).toBe(221_500);
    expectSameContributions(legacyMonth(220_000, 367_500));
  });

  it('taux et bases différents par personne : contributions identiques', () => {
    const a = person('a', 250_000, 3500, 2500);
    const b = person('b', 320_000, 4500, 1500);
    for (const [sa, sb] of [[260_000, 310_000], [100, 999_999], [250_001, 320_001], [0, 0]] as const) {
      expectSameContributions(legacyMonth(sa, sb, a, b));
    }
  });

  it('cas d’arrondi au demi-centime (tranches arrondies séparément)', () => {
    const a = person('a', 101, 5000, 5000);
    const b = person('b', 3, 3333, 6667);
    expectSameContributions(legacyMonth(202, 7, a, b));
    expectSameContributions(legacyMonth(101, 3, a, b));
  });

  it('balayage déterministe : contributions toujours identiques', () => {
    let seed = 42;
    const next = (max: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % (max + 1);
    };
    for (let i = 0; i < 2000; i += 1) {
      const a = person('a', next(1_000_000), next(10_000), next(10_000));
      const b = person('b', next(1_000_000), next(10_000), next(10_000));
      expectSameContributions(legacyMonth(next(1_500_000), next(1_500_000), a, b));
    }
  });

  it('mois déjà normalisé : renvoyé tel quel (même référence, idempotent)', () => {
    const month = createMonthRecord('2026-10', defaultSettings());
    expect(normalizeMonthIncome(month)).toBe(month);
    const once = normalizeMonthIncome(legacyMonth(220_000, 367_500));
    expect(normalizeMonthIncome(once)).toBe(once);
  });

  it('un mois normalisé avec un salaire au-dessus du salaire habituel n’est pas re-découpé', () => {
    const month = { ...createMonthRecord('2026-10', defaultSettings()), salaryBCents: 400_000 };
    expect(normalizeMonthIncome(month).salaryBCents).toBe(400_000);
    expect(normalizeMonthIncome(month).bonusBCents).toBe(0);
  });

  it('forme partielle : chaque personne est normalisée indépendamment', () => {
    const m = normalizeMonthIncome({ ...legacyMonth(260_000, 367_500), bonusACents: 5_000 });
    expect([m.salaryACents, m.bonusACents]).toEqual([260_000, 5_000]);
    expect([m.salaryBCents, m.bonusBCents]).toEqual([300_000, 67_500]);
  });

  it('pure : ne mute jamais l’entrée', () => {
    const input = legacyMonth(220_000, 367_500);
    const before = structuredClone(input);
    normalizeMonthIncome(input);
    expect(input).toEqual(before);
  });
});

describe('normalisation au chargement et à l’import (fixtures V1)', () => {
  for (const { name, state } of V1_FIXTURES) {
    it(`${name} : validatePersistedState normalise sans changer une contribution`, () => {
      const result = validatePersistedState(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.settings).toEqual(state.settings);
      expect(result.state.months).toHaveLength(state.months.length);
      state.months.forEach((original, i) => {
        const month = result.state.months[i]!;
        expect(month).toEqual(normalizeMonthIncome(original));
        expect(month.salaryACents + month.bonusACents).toBe(original.salaryACents);
        expect(month.salaryBCents + month.bonusBCents).toBe(original.salaryBCents);
        const summary = computeMonthSummary(month);
        expect(summary.contributionACents).toBe(legacyContribution(original.salaryACents, original.personA));
        expect(summary.contributionBCents).toBe(legacyContribution(original.salaryBCents, original.personB));
      });
    });

    it(`${name} : migrateState (V1) puis rechargement V2 → stable`, () => {
      const first = migrateState(structuredClone(state));
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const reloaded = migrateState(JSON.parse(JSON.stringify(first.state)));
      expect(reloaded.ok).toBe(true);
      if (reloaded.ok) expect(reloaded.state).toEqual(first.state);
    });
  }

  it('V2 à l’ancien format (mois sans compléments) : accepté et normalisé', () => {
    const v1 = V1_FIXTURES.find((f) => f.name === 'v1History')!.state;
    const migrated = migrateState(structuredClone(v1));
    if (!migrated.ok) throw new Error(migrated.reason);
    const legacyV2 = structuredClone(migrated.state) as unknown as {
      budget: { months: Record<string, unknown>[] };
    };
    legacyV2.budget.months = v1.months.map((m) => structuredClone(m) as unknown as Record<string, unknown>);
    const result = validateAppState(legacyV2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(migrated.state);
  });

  it('compléments invalides → raison stable', () => {
    const month = { ...createMonthRecord('2026-10', defaultSettings()) } as Record<string, unknown>;
    const base = { schemaVersion: 1, settings: defaultSettings(), selectedMonth: '2026-10' };
    for (const [field, value, reason] of [
      ['bonusACents', -1, 'month-invalid-bonus-a'],
      ['bonusACents', 1.5, 'month-invalid-bonus-a'],
      ['bonusBCents', '10', 'month-invalid-bonus-b'],
      ['bonusBCents', Number.NaN, 'month-invalid-bonus-b'],
    ] as const) {
      const result = validatePersistedState({ ...base, months: [{ ...month, [field]: value }] });
      expect(result).toEqual({ ok: false, reason });
    }
  });
});

describe('taux communs du couple', () => {
  it('sharedRates lit la personne A (fait foi si les taux diffèrent)', () => {
    const settings = defaultSettings();
    settings.personB = { ...settings.personB, baseRateBps: 4500, variableRateBps: 1500 };
    expect(sharedRates(settings)).toEqual({ baseRateBps: 4000, variableRateBps: 2000 });
    expect(hasSharedRates(settings)).toBe(false);
    expect(hasSharedRates(defaultSettings())).toBe(true);
  });

  it('setSharedRates écrit les deux personnes, sans toucher au reste', () => {
    const settings = defaultSettings();
    const before = structuredClone(settings);
    const next = setSharedRates(settings, 3500, 2500);
    expect(settings).toEqual(before);
    expect(next.personA).toEqual({ ...before.personA, baseRateBps: 3500, variableRateBps: 2500 });
    expect(next.personB).toEqual({ ...before.personB, baseRateBps: 3500, variableRateBps: 2500 });
    expect(next.recurringExpenses).toBe(settings.recurringExpenses);
    expect(sharedRates(next)).toEqual({ baseRateBps: 3500, variableRateBps: 2500 });
  });

  it('fonctionne aussi sur les règles d’un mois', () => {
    const month = createMonthRecord('2026-10', defaultSettings());
    const next = setSharedRates(month, 5000, 1000);
    expect(next.personB.baseRateBps).toBe(5000);
    expect(next.salaryACents).toBe(month.salaryACents);
    expect(computeMonthSummary(next).contributionACents).toBe(110_000);
  });

  it('taux invalides → RangeError', () => {
    const settings = defaultSettings();
    expect(() => setSharedRates(settings, -1, 2000)).toThrow(RangeError);
    expect(() => setSharedRates(settings, 4000, 10_001)).toThrow(RangeError);
    expect(() => setSharedRates(settings, 40.5, 2000)).toThrow(RangeError);
  });
});

describe('monthIncomeCents', () => {
  it('salaire + compléments (et ancien format)', () => {
    const month = { ...createMonthRecord('2026-10', defaultSettings()), bonusBCents: 67_500 };
    expect(monthIncomeCents(month, 'A')).toBe(220_000);
    expect(monthIncomeCents(month, 'B')).toBe(367_500);
    expect(monthIncomeCents(legacyMonth(220_000, 367_500), 'B')).toBe(367_500);
  });
});
