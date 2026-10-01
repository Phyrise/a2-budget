import { describe, expect, it } from 'vitest';
import {
  applySettingsToMonth,
  createMonthRecord,
  currentMonthKey,
  defaultSettings,
  emptyState,
  ensureMonth,
  MAX_AMOUNT_CENTS,
  validatePersistedState,
} from './index.js';
import type { MonthRecord, PersistedState, Settings } from './types.js';

describe('defaultSettings', () => {
  it('valeurs initiales de la SPEC', () => {
    const s = defaultSettings();
    expect(s.personA).toEqual({
      id: 'a',
      name: 'A',
      baseSalaryCents: 220_000,
      baseRateBps: 4000,
      variableRateBps: 2000,
    });
    expect(s.personB).toEqual({
      id: 'b',
      name: 'B',
      baseSalaryCents: 300_000,
      baseRateBps: 4000,
      variableRateBps: 2000,
    });
    expect(s.recurringExpenses).toEqual([
      { id: 'rent', label: 'Loyer + charges', amountCents: 130_000 },
      { id: 'electricity', label: 'Électricité', amountCents: 10_000 },
      { id: 'groceries', label: 'Courses', amountCents: 40_000 },
      { id: 'internet', label: 'Internet', amountCents: 3_000 },
      { id: 'insurance', label: 'Assurance', amountCents: 1_500 },
      { id: 'other', label: 'Autres', amountCents: 0 },
    ]);
    expect(s.defaultReserveTargetCents).toBe(0);
  });

  it('retourne une copie fraîche à chaque appel', () => {
    const a = defaultSettings();
    a.recurringExpenses[0]!.amountCents = 1;
    expect(defaultSettings().recurringExpenses[0]!.amountCents).toBe(130_000);
  });
});

describe('createMonthRecord', () => {
  it('salaires préremplis avec les bases, dépenses copiées (mêmes ids), réserve par défaut', () => {
    const settings = defaultSettings();
    const record = createMonthRecord('2026-10', settings);
    expect(record.monthKey).toBe('2026-10');
    expect(record.personA).toEqual(settings.personA);
    expect(record.personB).toEqual(settings.personB);
    expect(record.salaryACents).toBe(220_000);
    expect(record.salaryBCents).toBe(300_000);
    expect(record.expenses).toEqual(settings.recurringExpenses);
    expect(record.reserveTargetCents).toBe(0);
    // Copies, pas de référence partagée.
    expect(record.personA).not.toBe(settings.personA);
    expect(record.expenses).not.toBe(settings.recurringExpenses);
    expect(record.expenses[0]).not.toBe(settings.recurringExpenses[0]);
  });

  it('clé de mois invalide → erreur', () => {
    expect(() => createMonthRecord('2026-13', defaultSettings())).toThrow(RangeError);
  });
});

describe('emptyState', () => {
  it('réglages par défaut, aucun mois, mois sélectionné = mois courant local', () => {
    const state = emptyState();
    expect(state.schemaVersion).toBe(1);
    expect(state.settings).toEqual(defaultSettings());
    expect(state.months).toEqual([]);
    expect(state.selectedMonth).toBe(currentMonthKey());
  });
});

describe('ensureMonth', () => {
  it('crée le mois depuis les réglages et le sélectionne', () => {
    const state = emptyState();
    const next = ensureMonth(state, '2026-10');
    expect(next.selectedMonth).toBe('2026-10');
    expect(next.months).toHaveLength(1);
    expect(next.months[0]).toEqual(createMonthRecord('2026-10', state.settings));
  });

  it('mois existant : ne fait que le sélectionner', () => {
    const state = ensureMonth(emptyState(), '2026-10');
    const next = ensureMonth(state, '2026-10');
    expect(next.months).toHaveLength(1);
    expect(next.selectedMonth).toBe('2026-10');
  });

  it('pur : ne mute jamais l’entrée', () => {
    const state = emptyState();
    const before = JSON.stringify(state);
    ensureMonth(state, '2026-10');
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('applySettingsToMonth', () => {
  function editedState(): { state: PersistedState; settings: Settings } {
    let state = ensureMonth(emptyState(), '2026-10');
    // L'utilisateur ajuste le salaire A et une dépense du mois.
    const month = state.months[0]!;
    state = {
      ...state,
      months: [
        {
          ...month,
          salaryACents: 180_000,
          expenses: month.expenses.map((e) =>
            e.id === 'rent' ? { ...e, amountCents: 140_000 } : e,
          ),
        },
      ],
    };
    // Les réglages changent ensuite.
    const settings: Settings = {
      ...state.settings,
      personA: { ...state.settings.personA, baseSalaryCents: 250_000 },
      recurringExpenses: state.settings.recurringExpenses.map((e) => ({ ...e })),
      defaultReserveTargetCents: 50_000,
    };
    state = { ...state, settings };
    return { state, settings };
  }

  it('changer les réglages ne modifie JAMAIS les mois existants (inaction silencieuse)', () => {
    const { state } = editedState();
    const month = state.months[0]!;
    expect(month.salaryACents).toBe(180_000);
    expect(month.personA.baseSalaryCents).toBe(220_000); // copie d'origine
    expect(month.reserveTargetCents).toBe(0);
    const rent = month.expenses.find((e) => e.id === 'rent')!;
    expect(rent.amountCents).toBe(140_000); // modification du mois conservée
  });

  it('action explicite : remplace personnes, dépenses et réserve ; conserve les salaires saisis', () => {
    const { state, settings } = editedState();
    const next = applySettingsToMonth(state, '2026-10');
    const month = next.months[0]!;
    expect(month.salaryACents).toBe(180_000); // conservé
    expect(month.salaryBCents).toBe(300_000); // conservé
    expect(month.personA).toEqual(settings.personA);
    expect(month.personB).toEqual(settings.personB);
    expect(month.expenses).toEqual(settings.recurringExpenses);
    expect(month.reserveTargetCents).toBe(50_000);
  });

  it('sans effet si le mois n’existe pas', () => {
    const { state } = editedState();
    const next = applySettingsToMonth(state, '2026-11');
    expect(next).toBe(state);
  });

  it('pur : ne mute jamais l’entrée', () => {
    const { state } = editedState();
    const before = JSON.stringify(state);
    applySettingsToMonth(state, '2026-10');
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('validatePersistedState', () => {
  function validMonth(overrides: Partial<MonthRecord> = {}): MonthRecord {
    return { ...createMonthRecord('2026-10', defaultSettings()), ...overrides };
  }

  it('accepte un état valide', () => {
    const state = ensureMonth(emptyState(), '2026-10');
    const r = validatePersistedState(state);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(state);
  });

  it('accepte un état sans aucun mois', () => {
    const r = validatePersistedState(emptyState());
    expect(r.ok).toBe(true);
  });

  it('rejette les valeurs corrompues avec une raison stable', () => {
    expect(validatePersistedState(null)).toEqual({ ok: false, reason: 'not-an-object' });
    expect(validatePersistedState('{"schemaVersion":1}')).toEqual({
      ok: false,
      reason: 'not-an-object',
    });
    expect(validatePersistedState(42)).toEqual({ ok: false, reason: 'not-an-object' });
    expect(validatePersistedState([])).toEqual({ ok: false, reason: 'not-an-object' });
  });

  it('rejette une version de schéma inconnue', () => {
    const state = { ...emptyState(), schemaVersion: 2 };
    expect(validatePersistedState(state)).toEqual({
      ok: false,
      reason: 'unknown-schema-version',
    });
  });

  it('rejette les champs invalides avec des raisons stables', () => {
    const base = emptyState();
    const withMonth = (m: MonthRecord): PersistedState => ({
      ...base,
      months: [m],
      selectedMonth: '2026-10',
    });

    expect(validatePersistedState(withMonth(validMonth({ salaryACents: -1 }))))
      .toEqual({ ok: false, reason: 'month-invalid-salary-a' });
    expect(validatePersistedState(withMonth(validMonth({ salaryBCents: 1.5 }))))
      .toEqual({ ok: false, reason: 'month-invalid-salary-b' });
    expect(
      validatePersistedState(
        withMonth(validMonth({ salaryACents: MAX_AMOUNT_CENTS + 1 })),
      ),
    ).toEqual({ ok: false, reason: 'month-invalid-salary-a' });
    expect(
      validatePersistedState(
        withMonth(validMonth({ personA: { ...validMonth().personA, baseRateBps: 10_001 } })),
      ),
    ).toEqual({ ok: false, reason: 'person-invalid-base-rate' });
    expect(
      validatePersistedState(
        withMonth(validMonth({ personB: { ...validMonth().personB, baseSalaryCents: -5 } })),
      ),
    ).toEqual({ ok: false, reason: 'person-invalid-base-salary' });
    expect(validatePersistedState(withMonth(validMonth({ monthKey: '2026-13' }))))
      .toEqual({ ok: false, reason: 'month-invalid-key' });
    expect(
      validatePersistedState(
        withMonth(validMonth({ reserveTargetCents: Number.NaN })),
      ),
    ).toEqual({ ok: false, reason: 'month-invalid-reserve' });
    expect(
      validatePersistedState(
        withMonth(
          validMonth({
            expenses: [
              { id: 'x', label: 'X', amountCents: 0 },
              { id: 'x', label: 'Y', amountCents: 0 },
            ],
          }),
        ),
      ),
    ).toEqual({ ok: false, reason: 'month-duplicate-expense-id' });
    expect(
      validatePersistedState(
        withMonth(
          validMonth({
            expenses: [{ id: 'x', label: 'X', amountCents: Number.POSITIVE_INFINITY }],
          }),
        ),
      ),
    ).toEqual({ ok: false, reason: 'expense-invalid-amount' });
  });

  it('rejette les identifiants de dépense dupliqués dans les réglages', () => {
    const settings = defaultSettings();
    settings.recurringExpenses = [
      { id: 'x', label: 'X', amountCents: 0 },
      { id: 'x', label: 'Y', amountCents: 0 },
    ];
    expect(validatePersistedState({ ...emptyState(), settings })).toEqual({
      ok: false,
      reason: 'settings-duplicate-expense-id',
    });
  });

  it('rejette les clés de mois dupliquées', () => {
    const m = validMonth();
    const state: PersistedState = {
      ...emptyState(),
      months: [m, { ...m }],
      selectedMonth: '2026-10',
    };
    expect(validatePersistedState(state)).toEqual({
      ok: false,
      reason: 'duplicate-month-key',
    });
  });

  it('rejette un mois sélectionné invalide', () => {
    expect(validatePersistedState({ ...emptyState(), selectedMonth: '2026-13' })).toEqual({
      ok: false,
      reason: 'invalid-selected-month',
    });
    expect(validatePersistedState({ ...emptyState(), selectedMonth: 12 })).toEqual({
      ok: false,
      reason: 'invalid-selected-month',
    });
  });

  it('rejette des structures manquantes ou de mauvais type', () => {
    expect(validatePersistedState({ schemaVersion: 1 })).toEqual({
      ok: false,
      reason: 'settings-not-object',
    });
    expect(
      validatePersistedState({ ...emptyState(), months: 'non' } as unknown as PersistedState),
    ).toEqual({ ok: false, reason: 'months-not-array' });
    expect(
      validatePersistedState({
        ...emptyState(),
        months: ['non'],
      } as unknown as PersistedState),
    ).toEqual({ ok: false, reason: 'month-not-object' });
  });

  it('ne lève jamais d’exception', () => {
    const weird: unknown[] = [
      undefined,
      () => undefined,
      { schemaVersion: 1, settings: {}, months: {}, selectedMonth: {} },
      { schemaVersion: 1, settings: null, months: [null], selectedMonth: null },
    ];
    for (const w of weird) {
      expect(() => validatePersistedState(w)).not.toThrow();
      const r = validatePersistedState(w);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(typeof r.reason).toBe('string');
    }
  });
});
