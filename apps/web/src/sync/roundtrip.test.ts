import { describe, expect, it } from 'vitest';
import { advanceDay, emptyAppState, validateAppState, type AppState } from '@a2/core';
import { applyBatch } from './apply';
import { docKey, isPlainRecord, type DocData, type DocStore } from './docs';
import { entityDocs } from './entities';
import { migrationDocs, migrationOps } from './migration';
import { projectState } from './project';
import { NOW, canonical, richState } from './testFixtures';

/** Comme Firestore : clés de maps rendues triées, valeurs passées par JSON. */
function firestoreLike(docs: DocStore): Map<string, DocData> {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (!isPlainRecord(v)) return v;
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  };
  return new Map([...docs].map(([k, d]) => [k, sortKeys(JSON.parse(JSON.stringify(d))) as DocData]));
}

function project(docs: DocStore, s: AppState): AppState {
  const r = projectState(docs, { selectedMonth: s.budget.selectedMonth, today: NOW });
  if (!r.ok) throw new Error(r.issues.join(', '));
  expect(r.issues).toEqual([]);
  return r.state;
}

describe('aller-retour AppState → documents → AppState', () => {
  it('un foyer complet ressort identique (y compris après le passage « Firestore »)', () => {
    const s = richState();
    expect(s.chores.completions.length).toBeGreaterThan(4);
    expect(s.forest.pauses.length).toBe(1);
    expect(s.groceries.history?.length).toBe(1);
    expect(Object.keys(s.groceries.categoryMemory ?? {})).toEqual(['lait', 'cafe moulu']);
    const docs = migrationDocs(s, NOW);
    expect(project(docs, s)).toEqual(s);
    expect(project(firestoreLike(docs), s)).toEqual(s);
  });

  it('un état neuf aussi ; les écritures de migration donnent les mêmes documents', () => {
    const fresh = emptyAppState();
    const s = canonical({ ...fresh, forest: advanceDay(fresh.forest, '2026-10-08') });
    expect(project(migrationDocs(s, NOW), s)).toEqual(s);
    const rich = richState();
    const r = applyBatch(new Map(), migrationOps(rich, { now: NOW, role: 'a' }), { rules: true, stamp: { syncedAt: 1 } });
    if (!r.ok) throw new Error(r.reason);
    expect(project(r.docs, rich)).toEqual(rich);
  });

  it('représentation entité par entité : ids existants, rangs, maps, faits marqués importés', () => {
    const s = richState();
    const docs = migrationDocs(s, NOW);
    const task = docs.get(docKey('tasks', 'draps'));
    expect(task).toMatchObject({ id: 'draps', title: 'Changer les draps', flexible: true, order: 1 });
    expect(Object.values(task!).includes(undefined)).toBe(false);
    const completion = docs.get(docKey('completions', s.chores.completions[0]!.id));
    expect(completion).toMatchObject({ taskId: 'plantes', localDay: '2026-10-01', creditKey: 'plantes|2026-10-01', imported: true });
    const month = docs.get(docKey('months', '2026-10'))!;
    expect(month.expenses).toMatchObject({ rent: { label: 'Loyer + charges', order: 0 }, cine: { amountCents: 2_400, order: 6 } });
    expect(month.paid).toEqual({ transferB: true, expenses: { rent: true } });
    expect(docs.get(docKey('balanceCorrections', '2026-09'))).toMatchObject({ id: 'bal-09', balanceCents: 154_000 });
    expect(docs.get(docKey('settings', 'budget'))).toMatchObject({ balanceTracked: true, recurringExpenses: { rent: { amountCents: 130_000 } } });
    expect(docs.get(docKey('checkpoints', '2026-10-08'))).toMatchObject({ day: '2026-10-08', genesis: true });
    expect(docs.get(docKey('meta', 'forestMilestones'))).toMatchObject({ lifetimeCare: s.forest.lifetimeCare });
    // Jamais synchronisé : le mois affiché.
    for (const data of docs.values()) expect(JSON.stringify(data)).not.toContain('selectedMonth');
  });

  it('le mois affiché reste celui du téléphone', () => {
    const s = richState();
    const r = projectState(migrationDocs(s, NOW), { selectedMonth: '2026-04', today: NOW });
    expect(r.ok && r.state.budget.selectedMonth).toBe('2026-04');
  });

  it('les documents d’un état inchangé sont stables (aucune écriture inutile)', () => {
    const s = richState();
    const known = migrationDocs(s, NOW);
    const again = entityDocs(s, known);
    for (const [key, data] of again) {
      expect(data).toEqual(known.get(key));
    }
  });
});

describe('documents invalides : ignorés et signalés, jamais propagés', () => {
  it('un document abîmé est écarté, le reste est projeté', () => {
    const s = richState();
    const docs = new Map(migrationDocs(s, NOW));
    docs.set(docKey('tasks', 'zz-bad'), { id: 'zz-bad', title: '', assignee: 'personne', recurrence: 'daily', createdAt: 'hier', order: 99 });
    docs.set(docKey('groceries', 'zz-bad'), { id: 'zz-bad', label: 42, done: 'oui', order: 99 });
    const r = projectState(docs, { selectedMonth: '2026-10', today: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issues).toEqual(['tasks/zz-bad: task-invalid-title', 'groceries/zz-bad: grocery-invalid-label']);
    expect(r.state).toEqual(s);
    expect(validateAppState(JSON.parse(JSON.stringify(r.state))).ok).toBe(true);
  });

  it('champs inconnus (version plus récente) ignorés ; supprimés écartés', () => {
    const s = richState();
    const docs = new Map(migrationDocs(s, NOW));
    const task = docs.get(docKey('tasks', 'plantes'))!;
    docs.set(docKey('tasks', 'plantes'), { ...task, futureField: { x: 1 }, syncedAt: 12, updatedBy: 'uid' });
    expect(project(docs, s)).toEqual(s);
    docs.set(docKey('tasks', 'plantes'), { ...task, deletedAt: NOW.toISOString() });
    expect(project(docs, s).chores.tasks.map((t) => t.id)).not.toContain('plantes');
  });
});
