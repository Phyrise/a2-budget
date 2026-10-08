import { describe, expect, it } from 'vitest';
import { createTask, removeGroceryItem, updateGroceryItem, updateTask, type AppState, type MonthRecord } from '@a2/core';
import { SyncEngine } from './engine';
import { MemoryServer, MemoryTransport } from './memoryTransport';
import { migrationOps } from './migration';
import { NOW, addGrocery, at, resetTestIds, richState, testId, toggle, togglePause } from './testFixtures';

type Role = 'a' | 'b';

/** Un foyer : le faux serveur, le téléphone d'AL (qui migre) et celui d'AC. */
function household(start?: AppState) {
  resetTestIds();
  const initial = start ?? richState();
  const server = new MemoryServer();
  let clock = NOW;
  const now = () => clock;
  const remote: Record<Role, number> = { a: 0, b: 0 };
  const phone = (role: Role) => {
    const transport = new MemoryTransport(server, role);
    const engine = new SyncEngine(transport, {
      role,
      selectedMonth: '2026-10',
      now,
      newId: () => testId('e'),
      onState: (_s, origin) => { if (origin === 'remote') remote[role] += 1; },
    });
    return {
      transport,
      engine,
      get state(): AppState { return engine.state!; },
      /** Geste local à l'heure `when`. */
      act(fn: (s: AppState) => AppState, when: Date = clock) {
        clock = when;
        engine.commit(fn(engine.state!));
      },
    };
  };
  const a = phone('a');
  a.transport.write(migrationOps(initial, { now: NOW, role: 'a' }));
  const b = phone('b');
  return {
    server,
    a,
    b,
    remote,
    /** Le temps passe (les deux téléphones recalculent la forêt). */
    tick(when: Date) {
      clock = when;
      a.engine.refresh();
      b.engine.refresh();
    },
  };
}

const daily = (id: string) => createTask({ id, title: id, assignee: 'a', recurrence: 'daily' }, '2026-10-08');
const withTasks = (...ids: string[]) => (s: AppState): AppState =>
  ({ ...s, chores: { ...s.chores, tasks: [...s.chores.tasks, ...ids.map(daily)] } });
const task = (s: AppState, id: string) => s.chores.tasks.find((t) => t.id === id)!;
const month = (s: AppState, key: string) => s.budget.months.find((m) => m.monthKey === key)!;
function mapMonth(s: AppState, key: string, fn: (m: MonthRecord) => MonthRecord): AppState {
  return { ...s, budget: { ...s.budget, months: s.budget.months.map((m) => (m.monthKey === key ? fn(m) : m)) } };
}

/** Joue un scénario hors ligne puis reconnecte dans l'ordre donné ; renvoie les deux états. */
function offlineScenario(
  order: Role[],
  setup: (h: ReturnType<typeof household>) => void,
  offline: (h: ReturnType<typeof household>) => void,
) {
  const h = household();
  setup(h);
  h.a.transport.setOnline(false);
  h.b.transport.setOnline(false);
  offline(h);
  for (const role of order) h[role].transport.setOnline(true);
  expect(h.server.rejected).toEqual([]);
  expect(h.a.state).toEqual(h.b.state);
  return h;
}

describe('deux téléphones, un foyer', () => {
  it('AL migre, AC arrive : les deux voient exactement le foyer d’AL', () => {
    const initial = richState();
    const h = household(initial);
    expect(h.a.state).toEqual(initial);
    expect(h.b.state).toEqual(initial);
  });

  it('un geste de l’un arrive chez l’autre, sans écho ni écriture en retour', () => {
    const h = household();
    const commits = h.server.commits;
    h.a.act((s) => ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'plantes', { title: 'Arroser le ficus' }) } }));
    expect(task(h.b.state, 'plantes').title).toBe('Arroser le ficus');
    expect(h.remote.b).toBeGreaterThan(0);
    expect(h.server.commits).toBe(commits + 1);
    h.b.act((s) => addGrocery(s, 'Riz', at(8, 20, 30), 'b'));
    expect(h.server.commits).toBe(commits + 2);
    expect(h.a.state).toEqual(h.b.state);
  });

  it('le mois affiché ne voyage pas', () => {
    const h = household();
    h.a.act((s) => ({ ...s, budget: { ...s.budget, selectedMonth: '2026-09' } }));
    expect(h.a.state.budget.selectedMonth).toBe('2026-09');
    expect(h.b.state.budget.selectedMonth).toBe('2026-10');
    h.b.act((s) => mapMonth(s, '2026-10', (m) => ({ ...m, salaryBCents: 310_000 })));
    expect(h.a.state.budget.selectedMonth).toBe('2026-09');
    expect(month(h.a.state, '2026-10').salaryBCents).toBe(310_000);
  });

  it('hors ligne : champs différents d’une même tâche → les deux restent, quel que soit l’ordre', () => {
    const results = (['ab', 'ba'] as const).map((order) => offlineScenario([...order] as Role[], () => {}, (h) => {
      h.a.act((s) => ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'factures', { title: 'Papiers' }) } }));
      h.b.act((s) => ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'factures', { effort: 2, assignee: 'b' }) } }));
    }));
    for (const h of results) expect(task(h.a.state, 'factures')).toMatchObject({ title: 'Papiers', effort: 2, assignee: 'b' });
    expect(results[0]!.a.state).toEqual(results[1]!.a.state);
  });

  it('hors ligne : même champ → la dernière écriture arrivée gagne', () => {
    const run = (order: Role[]) => offlineScenario(order, () => {}, (h) => {
      h.a.act((s) => ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'factures', { title: 'Version AL' }) } }));
      h.b.act((s) => ({ ...s, chores: { ...s.chores, tasks: updateTask(s.chores.tasks, 'factures', { title: 'Version AC' }) } }));
    });
    expect(task(run(['a', 'b']).a.state, 'factures').title).toBe('Version AC');
    expect(task(run(['b', 'a']).b.state, 'factures').title).toBe('Version AL');
  });

  it('hors ligne : chacun coche deux tâches le même jour → 3 crédits, même forêt, quel que soit l’ordre', () => {
    const run = (order: Role[]) => offlineScenario(order, (h) => {
      h.a.act(withTasks('t1', 't2', 't3', 't4'));
      h.tick(at(9, 8));
    }, (h) => {
      h.a.act((s) => toggle(s, 't1', at(9, 10)), at(9, 10));
      h.b.act((s) => toggle(s, 't3', at(9, 9), 'b'), at(9, 9));
      h.a.act((s) => toggle(s, 't2', at(9, 10, 5)), at(9, 10, 5));
      h.b.act((s) => toggle(s, 't4', at(9, 11), 'b'), at(9, 11));
      expect(h.b.state.forest.creditLedger['t4|2026-10-09']?.status).toBe('active'); // seul, AC le croyait crédité
    });
    const ab = run(['a', 'b']);
    const ba = run(['b', 'a']);
    const ledger = ab.a.state.forest.creditLedger;
    expect(['t1', 't2', 't3', 't4'].map((t) => ledger[`${t}|2026-10-09`]?.status)).toEqual(['active', 'active', 'active', 'uncredited']);
    expect(ab.a.state.chores.completions.filter((c) => c.dueDate === '2026-10-09')).toHaveLength(4);
    expect(ab.a.state.forest).toEqual(ba.b.state.forest);
    expect(ab.a.state.chores).toEqual(ba.b.state.chores);
  });

  it('la même tâche cochée des deux côtés → une complétion « fait ensemble », un crédit ; chacun ne décoche que son geste', () => {
    const h = offlineScenario(['b', 'a'], (x) => {
      x.a.act(withTasks('t1'));
      x.tick(at(9, 8));
    }, (x) => {
      x.a.act((s) => toggle(s, 't1', at(9, 10)), at(9, 10));
      x.b.act((s) => toggle(s, 't1', at(9, 10, 30), 'b'), at(9, 10, 30));
    });
    const done = h.a.state.chores.completions.filter((c) => c.taskId === 't1');
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ assignee: 'a', doneBy: 'both', completedAt: at(9, 10).toISOString() });
    expect(h.a.state.forest.creditLedger['t1|2026-10-09']?.status).toBe('active');
    // AC décoche : son geste seulement ; la tâche reste faite par AL.
    h.b.act((s) => toggle(s, 't1', at(9, 12)), at(9, 12));
    expect(h.server.rejected).toEqual([]);
    const left = h.b.state.chores.completions.filter((c) => c.taskId === 't1');
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ assignee: 'a', completedAt: at(9, 10).toISOString() });
    expect(left[0]?.doneBy).toBeUndefined();
    expect(h.b.state.forest.creditLedger['t1|2026-10-09']?.status).toBe('active');
    // AL décoche à son tour : plus rien, le crédit est tombstoné.
    h.a.act((s) => toggle(s, 't1', at(9, 12, 5)), at(9, 12, 5));
    expect(h.a.state.chores.completions.filter((c) => c.taskId === 't1')).toEqual([]);
    expect(h.a.state.forest.creditLedger['t1|2026-10-09']?.status).toBe('tombstoned');
    expect(h.a.state).toEqual(h.b.state);
  });

  it('pause posée par AL pendant qu’AC coche hors ligne : même forêt, la croissance ne recule pas', () => {
    const run = (order: Role[]) => offlineScenario(order, (h) => {
      h.a.act(withTasks('t1', 't2', 't3'));
      h.tick(at(9, 7));
    }, (h) => {
      h.a.act((s) => togglePause(s, at(9, 8)), at(9, 8));
      h.b.act((s) => toggle(s, 't1', at(9, 9)), at(9, 9));
      h.b.act((s) => toggle(s, 't2', at(9, 9, 5)), at(9, 9, 5));
      h.b.act((s) => toggle(s, 't3', at(9, 9, 10)), at(9, 9, 10));
      expect(h.b.state.forest.growthStage).toBe(2); // AC a vu la forêt grandir
    });
    for (const h of [run(['a', 'b']), run(['b', 'a'])]) {
      const forest = h.a.state.forest;
      expect(forest.paused).toBe(true);
      expect(forest.lifetimeCare).toBe(7); // les soins pendant la pause ne comptent pas…
      expect(forest.growthStage).toBe(2); // … mais le stade vu ne redescend pas
      expect(forest.unlockedCreatureIds).toContain('seed-spirit');
    }
    expect(run(['a', 'b']).a.state.forest).toEqual(run(['b', 'a']).a.state.forest);
  });

  it('suppression contre modification : la suppression douce gagne, dans les deux ordres', () => {
    for (const order of [['a', 'b'], ['b', 'a']] as Role[][]) {
      let id = '';
      const h = offlineScenario(order, (x) => {
        x.a.act((s) => addGrocery(s, 'Farine', NOW, 'a'));
        id = x.a.state.groceries.items.find((g) => g.label === 'Farine')!.id;
      }, (x) => {
        x.a.act((s) => ({ ...s, groceries: { ...s.groceries, items: removeGroceryItem(s.groceries.items, id) } }));
        x.b.act((s) => ({ ...s, groceries: { ...s.groceries, items: updateGroceryItem(s.groceries.items, id, { quantity: '1 kg' }) } }));
        expect(x.b.state.groceries.items.find((g) => g.id === id)?.quantity).toMatch(/^1\skg$/u); // espace insécable
      });
      expect(h.a.state.groceries.items.some((g) => g.id === id)).toBe(false);
    }
  });

  it('budget : AL change le loyer pendant qu’AC ajoute une dépense et coche son virement', () => {
    const results = (['ab', 'ba'] as const).map((order) => offlineScenario([...order] as Role[], () => {}, (h) => {
      h.a.act((s) => mapMonth(s, '2026-10', (m) => ({ ...m, expenses: m.expenses.map((e) => (e.id === 'rent' ? { ...e, amountCents: 132_000 } : e)) })));
      h.b.act((s) => mapMonth(s, '2026-10', (m) => ({ ...m, expenses: [...m.expenses, { id: 'gaz', label: 'Gaz', amountCents: 4_500 }] })));
      h.b.act((s) => mapMonth(s, '2026-10', (m) => ({ ...m, paid: { ...m.paid, transferA: true } })));
    }));
    for (const h of results) {
      const m = month(h.a.state, '2026-10');
      expect(m.expenses.find((e) => e.id === 'rent')?.amountCents).toBe(132_000);
      expect(m.expenses.at(-1)).toEqual({ id: 'gaz', label: 'Gaz', amountCents: 4_500 });
      expect(m.paid).toEqual({ transferA: true, transferB: true, expenses: { rent: true } });
    }
    expect(results[0]!.a.state).toEqual(results[1]!.b.state);
  });

  it('courses : les deux ajoutent hors ligne → tout est là, dans le même ordre partout', () => {
    const results = (['ab', 'ba'] as const).map((order) => offlineScenario([...order] as Role[], () => {}, (h) => {
      h.a.act((s) => addGrocery(s, 'Tomates', at(8, 21), 'a'), at(8, 21));
      h.b.act((s) => addGrocery(s, 'Riz', at(8, 21), 'b'), at(8, 21));
      h.b.act((s) => addGrocery(s, 'Œufs', at(8, 21, 1), 'b'), at(8, 21, 1));
    }));
    const labels = results.map((h) => h.a.state.groceries.items.map((g) => g.label));
    expect(labels[0]).toEqual(labels[1]);
    expect(labels[0]).toEqual(expect.arrayContaining(['Tomates', 'Riz', 'Œufs']));
  });
});
