import { describe, expect, it } from 'vitest';
import { emptyMilestones } from '@a2/core';
import type { DocData, WriteOp } from './docs';
import { BATCH_LIMIT, CREATION_FIELD, planWrites } from './writePlan';

let n = 0;
const plan = (ops: WriteOp[], view: Record<string, DocData> = {}) =>
  planWrites(ops, { view: new Map(Object.entries(view)), newId: () => `tok-${(n += 1)}` });

const create = (collection: WriteOp['collection'], id: string, data: DocData = { id }): WriteOp =>
  ({ kind: 'create', collection, id, data } as WriteOp);
const undo: WriteOp = { kind: 'update', collection: 'completions', id: 'c1', fields: [[['undoneAt'], 'x'], [['undoneDay'], '2026-10-08'], [['undoneBy'], 'a']] };

describe('plan d’envoi', () => {
  it('créer si absent : un document connu n’est pas recréé ; un objet créé porte un jeton', () => {
    const batches = plan([create('tasks', 't1'), create('tasks', 't2'), create('completions', 'c9')], { 'tasks/t1': { id: 't1' } });
    expect(batches).toHaveLength(1);
    const [task, fact] = batches[0]!;
    expect(task).toMatchObject({ kind: 'create', id: 't2', data: { id: 't2', [CREATION_FIELD]: expect.stringMatching(/^tok-/) } });
    expect(fact).toEqual(create('completions', 'c9')); // un fait n'a pas de jeton (ids uniques, règles : création seulement)
  });

  it('le mois (clé naturelle) part seul, avant ses modifications ; le recalage du solde n’a pas de jeton', () => {
    const month = create('months', '2026-11', { monthKey: '2026-11', salaryACents: 0 });
    const paid: WriteOp = { kind: 'update', collection: 'months', id: '2026-11', fields: [[['paid', 'transferA'], true]] };
    const batches = plan([create('tasks', 't1'), month, paid, create('balanceCorrections', '2026-10', { balanceCents: 1 })]);
    expect(batches.map((b) => b.map((op) => `${op.kind}:${op.collection}`))).toEqual([
      ['create:tasks'],
      ['create:months'],
      ['update:months', 'create:balanceCorrections'],
    ]);
    expect(batches[1]![0]).toMatchObject({ data: { [CREATION_FIELD]: expect.any(String) } });
    expect(batches[2]![1]).toEqual(create('balanceCorrections', '2026-10', { balanceCents: 1 }));
  });

  it('restauration : le jeton connu est gardé (les règles refuseraient sinon)', () => {
    const set: WriteOp = { kind: 'set', collection: 'groceries', id: 'g1', data: { id: 'g1', label: 'Lait' } };
    const [[op]] = plan([set], { 'groceries/g1': { id: 'g1', label: 'Lait', deletedAt: 'x', [CREATION_FIELD]: 'tok-al' } }) as [[WriteOp]];
    expect(op).toEqual({ ...set, data: { id: 'g1', label: 'Lait', [CREATION_FIELD]: 'tok-al' } });
  });

  it('annulation d’un fait : seule dans son lot ; inutile si inconnue ou déjà posée', () => {
    expect(plan([create('tasks', 't1'), undo], { 'completions/c1': { id: 'c1', role: 'a' } })).toEqual([
      [expect.objectContaining({ id: 't1' })],
      [undo],
    ]);
    expect(plan([undo], { 'completions/c1': { id: 'c1', undoneAt: 'y' } })).toEqual([]);
    expect(plan([undo])).toEqual([]);
  });

  it('mise à jour d’un objet inconnu : à part (un refus n’emporte rien d’autre)', () => {
    const update: WriteOp = { kind: 'update', collection: 'tasks', id: 'ghost', fields: [[['title'], 'x']] };
    const merge: WriteOp = { kind: 'merge', collection: 'settings', id: 'focus', fields: [[['selectedLantern'], 'yukimi']] };
    expect(plan([merge, update, merge])).toEqual([[merge], [update], [merge]]);
  });

  it('jalons : jamais plus bas que ce qui est connu, seuls, et rien s’ils n’apportent rien', () => {
    const stored = { ...emptyMilestones(), growthStage: 3, lifetimeCare: 40, unlockedCreatureIds: ['kodama'] };
    const raise: WriteOp = { kind: 'raise', collection: 'meta', id: 'forestMilestones', data: { ...emptyMilestones(), lifetimeCare: 41 } };
    const [[op]] = plan([raise], { 'meta/forestMilestones': stored }) as [[WriteOp]];
    expect(op).toMatchObject({ kind: 'raise', data: { growthStage: 3, lifetimeCare: 41, unlockedCreatureIds: ['kodama'] } });
    expect(plan([{ ...raise, data: { ...emptyMilestones(), lifetimeCare: 12 } }], { 'meta/forestMilestones': stored })).toEqual([]);
  });

  it('par lots de 450 au plus, dans l’ordre', () => {
    const ops = Array.from({ length: 1000 }, (_, i) => create('completions', `c${String(i).padStart(4, '0')}`));
    const batches = plan(ops);
    expect(batches.map((b) => b.length)).toEqual([BATCH_LIMIT, BATCH_LIMIT, 100]);
    expect(batches.flat().map((op) => op.id)).toEqual(ops.map((op) => op.id));
  });
});
