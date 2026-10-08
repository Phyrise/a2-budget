/**
 * V5.2 — le lien Courses ↔ Maison (`HouseholdTask.groceries`) voyage par la
 * synchro objet par champ : pose et retrait = un seul champ écrit, et la
 * projection redonne l'état local.
 */
import { describe, expect, it } from 'vitest';
import { advanceDay, localDateKey, updateTask, type AppState } from '@a2/core';
import { applyBatch } from './apply';
import { DELETE_FIELD } from './docs';
import { diffToOps } from './diff';
import { migrationOps } from './migration';
import { projectState } from './project';
import { NOW, canonical, richState, testId } from './testFixtures';

function act(docs: Parameters<typeof applyBatch>[0], prev: AppState, next: AppState) {
  const ops = diffToOps(prev, next, { docs, role: 'a', now: NOW, newId: () => testId('e') });
  const applied = applyBatch(docs, ops, { rules: true });
  if (!applied.ok) throw new Error(applied.reason);
  const projected = projectState(applied.docs, { selectedMonth: next.budget.selectedMonth, today: NOW });
  if (!projected.ok) throw new Error(projected.issues.join(', '));
  expect(projected.state).toEqual(canonical({ ...next, forest: advanceDay(next.forest, localDateKey(NOW)) }));
  return { ops, docs: applied.docs, state: projected.state };
}

const withTasks = (s: AppState, tasks: AppState['chores']['tasks']): AppState => ({ ...s, chores: { ...s.chores, tasks } });

describe('synchro : tâche liée aux courses', () => {
  it('lier puis délier : un champ, et rien d’autre', () => {
    const start = richState();
    const r0 = applyBatch(new Map(), migrationOps(start, { now: NOW, role: 'a' }), { rules: true });
    if (!r0.ok) throw new Error(r0.reason);
    const iso = NOW.toISOString();
    const linked = act(r0.docs, start, withTasks(start, updateTask(start.chores.tasks, 'vaisselle', { groceries: true })));
    expect(linked.ops).toEqual([{ kind: 'update', collection: 'tasks', id: 'vaisselle', fields: [[['groceries'], true], [['updatedAt'], iso]] }]);
    expect(linked.state.chores.tasks.find((t) => t.id === 'vaisselle')?.groceries).toBe(true);
    const unlinked = act(linked.docs, linked.state, withTasks(linked.state, updateTask(linked.state.chores.tasks, 'vaisselle', { groceries: false })));
    expect(unlinked.ops).toEqual([{ kind: 'update', collection: 'tasks', id: 'vaisselle', fields: [[['groceries'], DELETE_FIELD], [['updatedAt'], iso]] }]);
  });
});
