import { afterEach, describe, expect, it } from 'vitest';
import type { LiveChannel, PlayCounts, PlayDocs } from '../../presence/liveTypes';
import { gestureDelta, migrationCounts, needsMigration, sharedPlayBackend, sharedPlayState } from './shared';
import { getPlay, playCatch, playGive, playSpend, resetPlayForTests, setPlayBackend } from './store';

/** Faux serveur : deux documents play/{rôle}, deux téléphones branchés dessus. */
function fakeServer() {
  const docs: PlayDocs = {};
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const channel = (role: 'a' | 'b'): LiveChannel & { adds: Partial<PlayCounts>[] } => {
    const adds: Partial<PlayCounts>[] = [];
    return {
      role,
      adds,
      publish: () => undefined,
      poke: () => undefined,
      watchPartner: () => () => undefined,
      watchPlay(listener) {
        const l = () => listener({ ...docs }, true);
        listeners.add(l);
        l();
        return () => listeners.delete(l);
      },
      addPlay(delta) {
        adds.push(delta);
        const d = docs[role] ?? { given: 0, spent: 0, caught: 0, golden: 0, migrated: false };
        docs[role] = { ...d, given: d.given + (delta.given ?? 0), spent: d.spent + (delta.spent ?? 0), caught: d.caught + (delta.caught ?? 0), golden: d.golden + (delta.golden ?? 0) };
        emit();
      },
      migratePlay(local) {
        const d = docs[role];
        if (d?.migrated) return Promise.resolve();
        const base = d ?? { given: 0, spent: 0, caught: 0, golden: 0 };
        docs[role] = { given: base.given + local.given, spent: base.spent + local.spent, caught: base.caught + local.caught, golden: base.golden + local.golden, migrated: true };
        emit();
        return Promise.resolve();
      },
      dispose: () => undefined,
    };
  };
  return { docs, channel };
}

afterEach(() => resetPlayForTests());

describe('bocal partagé (pur)', () => {
  it('bocal = 20 + dons − dépenses des deux ; Noiraudes = somme', () => {
    const s = sharedPlayState({
      a: { given: 5, spent: 2, caught: 3, golden: 1, migrated: true },
      b: { given: 4, spent: 1, caught: 2, golden: 0, migrated: true },
    });
    expect(s).toEqual({ jar: 26, caught: 5, golden: 1 });
    expect(sharedPlayState({ a: { given: 0, spent: 40, caught: 0, golden: 0, migrated: true } }).jar).toBe(0);
  });

  it('un geste devient des incréments', () => {
    expect(gestureDelta({ kind: 'give', n: 1, cause: 'soin' })).toEqual({ given: 1 });
    expect(gestureDelta({ kind: 'spend', n: 1 })).toEqual({ spent: 1 });
    expect(gestureDelta({ kind: 'catch', golden: true })).toEqual({ given: 5, caught: 1, golden: 1 });
  });

  it('migration : au-dessus de 20 donnés, en dessous dépensés', () => {
    expect(migrationCounts({ jar: 27, caught: 4, golden: 1 })).toEqual({ given: 7, spent: 0, caught: 4, golden: 1 });
    expect(migrationCounts({ jar: 15, caught: 0, golden: 0 })).toEqual({ given: 0, spent: 5, caught: 0, golden: 0 });
    expect(needsMigration({}, 'a', false)).toBe(false);
    expect(needsMigration({}, 'a', true)).toBe(true);
  });
});

describe('deux téléphones', () => {
  it('un geste vu arriver de l’autre n’est jamais recompté', () => {
    const server = fakeServer();
    const al = server.channel('a');
    const ac = server.channel('b');
    // AC branché « à côté » : il reçoit l'état, sans geste.
    const seenByAc: number[] = [];
    sharedPlayBackend(ac, null).subscribe?.((s) => seenByAc.push(s.jar));
    setPlayBackend(sharedPlayBackend(al, { jar: 23, caught: 1, golden: 0 }));
    expect(server.docs.a).toMatchObject({ given: 3, migrated: true });
    expect(getPlay()).toEqual({ jar: 23, caught: 1, golden: 0 });
    playGive(1, 'virement');
    playCatch(false);
    expect(playSpend()).toBe(true);
    expect(getPlay()).toEqual({ jar: 24, caught: 2, golden: 0 });
    expect(ac.adds).toEqual([]);
    expect(server.docs.b).toMatchObject({ given: 0, migrated: true });
    expect(seenByAc.at(-1)).toBe(24);
  });

  it('les gestes faits avant la migration sont gardés', () => {
    const server = fakeServer();
    const al = server.channel('a');
    server.docs.a = { given: 2, spent: 0, caught: 0, golden: 0, migrated: false };
    setPlayBackend(sharedPlayBackend(al, { jar: 25, caught: 0, golden: 0 }));
    expect(getPlay().jar).toBe(27);
  });
});
