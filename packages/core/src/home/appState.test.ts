import { describe, expect, it } from 'vitest';
import { validatePersistedState } from '../state.js';
import {
  emptyAppState,
  migrateState,
  migrateV1toV2,
  validateAppState,
} from './appState.js';
import { V1_FIXTURES, v1Basic, v1Custom, v1Empty, v1History } from './fixtures/v1.js';
import type { AppState } from './types.js';

/** Vérifie que le budget migré est profondément identique à la V1 d'origine. */
function expectBudgetDeeplyIdentical(v2: AppState, v1: (typeof V1_FIXTURES)[number]['state']): void {
  expect(v2.budget.settings).toEqual(v1.settings);
  expect(v2.budget.months).toEqual(v1.months);
  expect(v2.budget.selectedMonth).toBe(v1.selectedMonth);
  // Réserve comprise (cachée mais conservée) :
  for (const month of v1.months) {
    const migrated = v2.budget.months.find((m) => m.monthKey === month.monthKey)!;
    expect(migrated.reserveTargetCents).toBe(month.reserveTargetCents);
  }
}

describe('migration V1 → V2 (fixtures)', () => {
  for (const { name, state: v1 } of V1_FIXTURES) {
    it(`${name} : le budget est profondément identique`, () => {
      // La fixture est bien un état V1 valide.
      expect(validatePersistedState(v1).ok).toBe(true);
      const v2 = migrateV1toV2(v1);
      expect(v2.schemaVersion).toBe(2);
      expectBudgetDeeplyIdentical(v2, v1);
    });

    it(`${name} : les personnes du foyer sont dérivées des réglages`, () => {
      const v2 = migrateV1toV2(v1);
      expect(v2.household.people).toEqual([
        { id: v1.settings.personA.id, name: v1.settings.personA.name },
        { id: v1.settings.personB.id, name: v1.settings.personB.name },
      ]);
    });

    it(`${name} : les domaines Maison/Forêt/Courses sont initialisés à vide`, () => {
      const v2 = migrateV1toV2(v1);
      expect(v2.chores.tasks).toEqual([]);
      expect(v2.chores.completions).toEqual([]);
      expect(v2.forest.lifetimeCare).toBe(0);
      expect(v2.forest.vitality).toBe(0);
      expect(v2.forest.creditLedger).toEqual({});
      expect(v2.groceries.items).toEqual([]);
    });

    it(`${name} : l'état migré est valide en V2`, () => {
      const v2 = migrateV1toV2(v1);
      expect(validateAppState(v2).ok).toBe(true);
    });
  }
});

describe('migrateState (dispatch de versions)', () => {
  it('V1 valide → état V2', () => {
    const result = migrateState(v1Basic);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.schemaVersion).toBe(2);
      expectBudgetDeeplyIdentical(result.state, v1Basic);
    }
  });

  it('V2 valide → état V2 (inchangé)', () => {
    const v2 = migrateV1toV2(v1Custom);
    const result = migrateState(v2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual(v2);
    }
  });

  it('version inconnue (3) → échec stable (pas d’écrasement)', () => {
    const future = { schemaVersion: 3, whatever: true };
    const result = migrateState(future);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown-schema-version');
  });

  it('V1 corrompue → échec stable (contenu brut conservé par le store)', () => {
    const corrupted = { schemaVersion: 1, settings: { personA: 'oops' }, months: null, selectedMonth: 'x' };
    const result = migrateState(corrupted);
    expect(result.ok).toBe(false);
  });

  it('non-objet → échec stable', () => {
    expect(migrateState(null).ok).toBe(false);
    expect(migrateState('string').ok).toBe(false);
    expect(migrateState(42).ok).toBe(false);
    expect(migrateState([]).ok).toBe(false);
  });

  it('V2 corrompue → échec stable', () => {
    const bad = { schemaVersion: 2, household: null, budget: null, chores: null, forest: null, groceries: null };
    const result = migrateState(bad);
    expect(result.ok).toBe(false);
  });
});

describe('validateAppState (V2)', () => {
  it('accepte un état V2 valide', () => {
    const v2 = migrateV1toV2(v1History);
    expect(validateAppState(v2).ok).toBe(true);
  });

  it('rejette un budget invalide (montant hors plage)', () => {
    const v2 = migrateV1toV2(v1Basic);
    const broken = structuredClone(v2);
    broken.budget.months[0]!.salaryACents = -5;
    const result = validateAppState(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('budget-');
  });

  it('rejette une tâche incohérente (weekly sans jour)', () => {
    const v2 = migrateV1toV2(v1Basic);
    const broken = structuredClone(v2);
    broken.chores.tasks.push({
      id: 't1',
      title: 'X',
      assignee: 'a',
      recurrence: 'weekly',
      createdAt: '2026-10-01',
    });
    const result = validateAppState(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('task-invalid-weekly-day');
  });

  it('rejette un doublon d’occurrence de complétion', () => {
    const v2 = migrateV1toV2(v1Basic);
    const broken = structuredClone(v2);
    const occ = {
      id: 'c1',
      taskId: 't1',
      taskTitle: 'X',
      assignee: 'a' as const,
      dueDate: '2026-10-01',
      completedAt: new Date().toISOString(),
    };
    broken.chores.completions.push(occ, { ...occ, id: 'c2' });
    const result = validateAppState(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duplicate-completion-occurrence');
  });

  it('rejette une vitalité hors plage', () => {
    const v2 = migrateV1toV2(v1Basic);
    const broken = structuredClone(v2);
    broken.forest.vitality = 101;
    const result = validateAppState(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('forest-invalid-vitality');
  });
});

describe('emptyAppState', () => {
  it('est un état V2 valide et neuf', () => {
    const state = emptyAppState();
    expect(state.schemaVersion).toBe(2);
    expect(state.budget.months).toEqual([]);
    expect(state.chores.tasks).toEqual([]);
    expect(state.forest.lifetimeCare).toBe(0);
    expect(validateAppState(state).ok).toBe(true);
  });
});
