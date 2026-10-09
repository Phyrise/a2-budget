/** Mode développeur : remise à zéro du foyer (signal, vidage, lettres). docs/SYNC_DESIGN.md §22. */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, increment, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { ALEXIA, ARTHUR, HH, STRANGER, db, fact, google, stamp, startEnv } from './setup';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await startEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = db(ctx);
    await setDoc(doc(d, HH), { names: { a: 'AL', b: 'AC' }, schema: 1, ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/tasks/t1`), { title: 'Plantes', ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/completions/c1`), fact(ARTHUR));
    await setDoc(doc(d, `${HH}/checkpoints/2026-10-01`), { day: '2026-10-01', genesis: true, ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/meta/forestMilestones`), { growthStage: 2, lifetimeCare: 4, longestStreak: 3, unlockedCreatureIds: [], unlockedEnvironmentIds: [], ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/quests/2026-10-08-rocher`), { id: '2026-10-08-rocher', kind: 'rocher', ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/play/b`), { given: 4, spent: 1, caught: 2, golden: 0, migrated: true, ...stamp(ALEXIA.uid) });
    await setDoc(doc(d, `${HH}/memberState/b`), { uid: ALEXIA.uid, circleSeen: '2026-10-08T10:00:00.000Z', ...stamp(ALEXIA.uid) });
  });
});

const signal = (who: { uid: string }) => ({
  resetEpoch: increment(1),
  resetAt: serverTimestamp(),
  resetBy: who.uid,
  resetting: true,
  ...stamp(who.uid),
});

const PATHS = ['tasks/t1', 'completions/c1', 'checkpoints/2026-10-01', 'meta/forestMilestones', 'quests/2026-10-08-rocher', 'play/b'];

describe('remise à zéro', () => {
  it('le signal, le vidage par son auteur, puis la fin du vidage', async () => {
    const al = db(google(env, ARTHUR));
    await assertSucceeds(updateDoc(doc(al, HH), signal(ARTHUR)));
    const batch = writeBatch(al);
    for (const p of PATHS) batch.delete(doc(al, `${HH}/${p}`));
    await assertSucceeds(batch.commit());
    await assertSucceeds(updateDoc(doc(al, HH), { resetting: false, ...stamp(ARTHUR.uid) }));
    // Fini : plus de suppression permise.
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(db(ctx), `${HH}/play/a`), { given: 1, ...stamp(ARTHUR.uid) }));
    await assertFails(deleteDoc(doc(al, `${HH}/play/a`)));
  });

  it('sans signal, ou par l’autre, on ne supprime rien', async () => {
    const al = db(google(env, ARTHUR));
    const ac = db(google(env, ALEXIA));
    for (const p of PATHS.slice(2)) await assertFails(deleteDoc(doc(al, `${HH}/${p}`)));
    await assertFails(deleteDoc(doc(al, `${HH}/tasks/t1`)));
    await assertSucceeds(updateDoc(doc(al, HH), signal(ARTHUR)));
    await assertFails(deleteDoc(doc(ac, `${HH}/tasks/t1`)));
    await assertFails(deleteDoc(doc(db(google(env, STRANGER)), `${HH}/tasks/t1`)));
  });

  it('jamais les fiches des membres (appartenance), même pendant le vidage', async () => {
    const al = db(google(env, ARTHUR));
    await assertSucceeds(updateDoc(doc(al, HH), signal(ARTHUR)));
    await assertFails(deleteDoc(doc(al, `${HH}/memberState/b`)));
    await assertFails(deleteDoc(doc(al, HH)));
  });

  it('vidage trop vieux (10 min) : refusé', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(db(ctx), HH), { resetEpoch: 1, resetBy: ARTHUR.uid, resetting: true, resetAt: Timestamp.fromMillis(Date.now() - 11 * 60_000) }),
    );
    await assertFails(deleteDoc(doc(db(google(env, ARTHUR)), `${HH}/tasks/t1`)));
  });

  it('le signal est bien formé : + 1, heure du serveur, son UID', async () => {
    const al = db(google(env, ARTHUR));
    await assertFails(updateDoc(doc(al, HH), { ...signal(ARTHUR), resetEpoch: 5 }));
    await assertFails(updateDoc(doc(al, HH), { ...signal(ARTHUR), resetBy: ALEXIA.uid }));
    await assertFails(updateDoc(doc(al, HH), { ...signal(ARTHUR), resetAt: Timestamp.fromMillis(0) }));
    await assertFails(updateDoc(doc(al, HH), { ...signal(ARTHUR), resetting: false }));
    await assertFails(updateDoc(doc(al, HH), { resetting: true, ...stamp(ARTHUR.uid) }));
    await assertFails(updateDoc(doc(al, HH), { resetAt: serverTimestamp(), ...stamp(ARTHUR.uid) }));
    // Les autres champs du foyer restent modifiables comme avant.
    await assertSucceeds(updateDoc(doc(al, HH), { names: { a: 'AL', b: 'AC' }, ...stamp(ARTHUR.uid) }));
  });

  it('lettres effacées : lettersEpoch + 1 seulement', async () => {
    const ac = db(google(env, ALEXIA));
    await assertSucceeds(updateDoc(doc(ac, HH), { lettersEpoch: increment(1), ...stamp(ALEXIA.uid) }));
    await assertSucceeds(updateDoc(doc(ac, HH), { lettersEpoch: increment(1), ...stamp(ALEXIA.uid) }));
    await assertFails(updateDoc(doc(ac, HH), { lettersEpoch: 7, ...stamp(ALEXIA.uid) }));
    await assertFails(updateDoc(doc(ac, HH), { lettersEpoch: increment(1) }));
  });
});
