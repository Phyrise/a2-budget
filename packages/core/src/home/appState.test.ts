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
import { grantCredit, pauseForest, tombstoneCredit, updateStreak } from './forest.js';

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
  it('ne partage aucun objet mutable du budget avec son entrée V1', () => {
    const v1 = structuredClone(v1History);
    const before = structuredClone(v1);
    const v2 = migrateV1toV2(v1);
    v2.budget.settings.personA.name = 'Modifié';
    v2.budget.settings.recurringExpenses[0]!.amountCents += 1;
    v2.budget.months[0]!.personB.variableRateBps += 1;
    v2.budget.months[0]!.expenses[0]!.amountCents += 1;
    expect(v1).toEqual(before);
  });
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

  it('rejette les identifiants de complétion dupliqués malgré des occurrences différentes', () => {
    const state = emptyAppState();
    state.chores.completions = ['t1', 't2'].map(taskId => ({
      id: 'duplicate', taskId, taskTitle: 'X', assignee: 'a', dueDate: 'once',
      completedAt: '2026-10-01T10:00:00.000Z',
    }));
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'duplicate-completion-id' });
  });

  it('rejette un horodatage sans fuseau explicite', () => {
    const state = emptyAppState();
    state.chores.completions = [{ id: 'c1', taskId: 't1', taskTitle: 'X', assignee: 'a', dueDate: 'once', completedAt: '2026-10-01' }];
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'completion-invalid-completed-at' });
  });

  it.each([
    { intervals: [{ start: '2026-10-05', end: '2026-10-01' }], reason: 'pause-inverted-interval' },
    { intervals: [{ start: '2026-10-01', end: '2026-10-05' }, { start: '2026-10-05', end: '2026-10-06' }], reason: 'pause-overlapping-intervals' },
    { intervals: [{ start: '2026-10-01', end: null }, { start: '2026-10-06', end: null }], reason: 'pause-overlapping-intervals' },
  ])('rejette les pauses incohérentes : $reason', ({ intervals, reason }) => {
    const state = emptyAppState();
    state.forest.pauses = intervals;
    expect(validateAppState(state)).toEqual({ ok: false, reason });
  });

  it('rejette le drapeau de pause sans intervalle ouvert cohérent', () => {
    const state = emptyAppState();
    state.forest.paused = true;
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'forest-inconsistent-pause' });
    state.forest = pauseForest(emptyAppState().forest, '2026-10-01');
    expect(validateAppState(state).ok).toBe(true);
    state.forest.pausedAt = '2026-10-02';
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'forest-inconsistent-pause' });
  });

  it('compte les tombstones au cap mais conserve les faits sans crédit', () => {
    const state = emptyAppState();
    for (let i = 1; i <= 5; i += 1) state.forest = grantCredit(state.forest, `t${i}|once`, '2026-10-01').forest;
    state.forest = updateStreak(state.forest, '2026-10-01');
    state.forest = tombstoneCredit(state.forest, 't1|once').forest;
    const loaded = validateAppState(JSON.parse(JSON.stringify(state)));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.reason);
    expect(loaded.state.forest.creditLedger['t1|once']!.status).toBe('tombstoned');
    expect(loaded.state.forest.creditLedger['t4|once']!.status).toBe('uncredited');
    expect(loaded.state.forest.lifetimeCare).toBe(3);
    state.forest.creditLedger['extra|once'] = { status: 'active', grantedOn: '2026-10-01' };
    state.forest.lifetimeCare = 4;
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'forest-credit-cap-exceeded' });
  });

  it('rejette les clés de soin non liées à une occurrence', () => {
    const state = emptyAppState();
    state.forest.creditLedger.invalid = { status: 'active', grantedOn: '2026-10-01' };
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'credit-invalid-key' });
    state.forest.creditLedger = { 'future|2026-10-02': { status: 'active', grantedOn: '2026-10-01' } };
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'credit-future-occurrence' });
  });

  it('rejette la croissance qui ne correspond pas au ledger conservé', () => {
    const state = emptyAppState();
    state.forest.lifetimeCare = 1;
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'forest-lifetime-ledger-mismatch' });
  });

  it('rejette une série plus longue que la mémoire longue', () => {
    const state = emptyAppState();
    state.forest = grantCredit(state.forest, 't1|once', '2026-10-01').forest;
    state.forest = updateStreak(state.forest, '2026-10-01');
    state.forest.longestStreak = 0;
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'forest-inconsistent-streak' });
  });

  it('rejette des identités de foyer dupliquées ou différentes du budget', () => {
    const state = emptyAppState();
    state.household.people[1] = { ...state.household.people[0]! };
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'duplicate-person-id' });
    state.household = emptyAppState().household;
    state.household.people[0]!.name = 'Incohérent';
    expect(validateAppState(state)).toEqual({ ok: false, reason: 'household-budget-identity-mismatch' });
  });

  it('ne partage pas les tableaux de déblocages avec un état importé', () => {
    const state = emptyAppState();
    const result = validateAppState(state);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    result.state.forest.unlockedCreatureIds.push('new');
    result.state.forest.unlockedEnvironmentIds.push('new');
    expect(state.forest.unlockedCreatureIds).toEqual([]);
    expect(state.forest.unlockedEnvironmentIds).toEqual([]);
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
