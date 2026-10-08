import { describe, expect, it } from 'vitest';
import type { WriteOp } from './docs';
import { LocalView } from './localView';
import type { DocChange } from './transport';

const rename: WriteOp = { kind: 'update', collection: 'tasks', id: 't1', fields: [[['title'], 'Arroser le ficus']] };

describe('vue d’un téléphone', () => {
  it('un lot écrit est visible tout de suite, et le reste jusqu’à son issue', () => {
    const view = new LocalView();
    const seen: DocChange[][] = [];
    view.subscribe((changes) => seen.push([...changes]));
    view.receive([{ key: 'tasks/t1', data: { id: 't1', title: 'Arroser' } }]);
    const id = view.add([rename]);
    expect(view.docs.get('tasks/t1')).toMatchObject({ title: 'Arroser le ficus' });
    expect(view.pendingCount).toBe(1);

    // L'autre change un champ voisin : les deux restent ; le même champ, le geste en attente l'emporte.
    view.receive([{ key: 'tasks/t1', data: { id: 't1', title: 'Arroser !', effort: 2 } }]);
    expect(view.docs.get('tasks/t1')).toEqual({ id: 't1', title: 'Arroser le ficus', effort: 2 });

    // Refusé (ou confirmé) : la vue redevient ce qui a été reçu.
    view.settle(id);
    expect(view.docs.get('tasks/t1')).toEqual({ id: 't1', title: 'Arroser !', effort: 2 });
    expect(view.received.get('tasks/t1')).toEqual({ id: 't1', title: 'Arroser !', effort: 2 });
    expect(seen.at(-1)).toEqual([{ key: 'tasks/t1', data: { id: 't1', title: 'Arroser !', effort: 2 } }]);
  });

  it('tout relire remplace ce qui a été reçu ; un document disparu est annoncé', () => {
    const view = new LocalView();
    view.receive([{ key: 'tasks/t1', data: { id: 't1' } }, { key: 'tasks/t2', data: { id: 't2' } }]);
    const seen: DocChange[][] = [];
    view.subscribe((changes) => seen.push([...changes]));
    expect(seen[0]).toHaveLength(2); // d'abord tout ce qui est vu
    view.reset(new Map([['tasks/t2', { id: 't2' }]]));
    expect(seen.at(-1)).toEqual([{ key: 'tasks/t1', data: null }]);
  });
});
