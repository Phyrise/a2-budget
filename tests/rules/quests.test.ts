/** V5.1 — quêtes communes : création par un membre, chacun sa main, une fois. */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ALEXIA, ARTHUR, HH, STRANGER, db, google, stamp, startEnv } from './setup';

let env: RulesTestEnvironment;
const DAY = '2026-10-08';
const ID = `${DAY}-rocher`;
const T = '2026-10-08T09:00:00.000Z';

function quest(by: { uid: string; role: string }, extra: Record<string, unknown> = {}) {
  return { id: ID, kind: 'rocher', day: DAY, tab: 'budget', spot: 1, createdBy: by.role, helpers: {}, order: 0, updatedAt: T, ...stamp(by.uid), ...extra };
}

beforeAll(async () => {
  env = await startEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const al = () => db(google(env, ARTHUR));
const ac = () => db(google(env, ALEXIA));

describe('quêtes communes', () => {
  it('un membre crée la quête (son rôle, au plus sa propre aide) ; un intrus non', async () => {
    await assertSucceeds(setDoc(doc(al(), `${HH}/quests/${ID}`), quest(ARTHUR)));
    await assertSucceeds(getDoc(doc(ac(), `${HH}/quests/${ID}`)));
    await assertFails(getDoc(doc(db(google(env, STRANGER)), `${HH}/quests/${ID}`)));
    const other = `${DAY}-pousse`;
    await assertFails(setDoc(doc(al(), `${HH}/quests/${other}`), quest(ARTHUR, { id: other, kind: 'pousse', tab: 'calendar', createdBy: 'b' })));
    await assertFails(setDoc(doc(al(), `${HH}/quests/${other}`), quest(ARTHUR, { id: other, kind: 'pousse', tab: 'calendar', helpers: { b: T } })));
    await assertSucceeds(setDoc(doc(al(), `${HH}/quests/${other}`), quest(ARTHUR, { id: other, kind: 'pousse', tab: 'calendar', helpers: { a: T } })));
  });

  it('forme : id = jour-type (ou -dXXXX), type et onglet accordés, pas de doneAt', async () => {
    await assertFails(setDoc(doc(al(), `${HH}/quests/${DAY}-tresor`), quest(ARTHUR, { kind: 'tresor' })));
    await assertFails(setDoc(doc(al(), `${HH}/quests/n-importe`), quest(ARTHUR)));
    await assertFails(setDoc(doc(al(), `${HH}/quests/${ID}`), quest(ARTHUR, { doneAt: T })));
    await assertFails(setDoc(doc(al(), `${HH}/quests/${ID}`), quest(ARTHUR, { spot: 7 })));
    await assertSucceeds(setDoc(doc(al(), `${HH}/quests/${ID}-dqa1`), quest(ARTHUR)));
  });

  it('chacun n’écrit que sa propre aide, une fois ; doneAt avec les deux ; jamais supprimée', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(db(ctx), `${HH}/quests/${ID}`), quest(ARTHUR));
    });
    const refAl = doc(al(), `${HH}/quests/${ID}`);
    const refAc = doc(ac(), `${HH}/quests/${ID}`);
    await assertFails(updateDoc(refAl, { 'helpers.b': T, ...stamp(ARTHUR.uid) }));
    await assertFails(updateDoc(refAl, { 'helpers.a': T, doneAt: T, ...stamp(ARTHUR.uid) }));
    await assertSucceeds(updateDoc(refAl, { 'helpers.a': T, updatedAt: T, ...stamp(ARTHUR.uid) }));
    await assertFails(updateDoc(refAl, { 'helpers.a': '2026-10-08T10:00:00.000Z', ...stamp(ARTHUR.uid) }));
    await assertFails(updateDoc(refAc, { kind: 'pousse', 'helpers.b': T, ...stamp(ALEXIA.uid) }));
    // Recréer par-dessus (création simultanée de l'autre) : refusé, l'aide d'AL reste.
    await assertFails(setDoc(refAc, quest(ALEXIA)));
    await assertSucceeds(updateDoc(refAc, { 'helpers.b': T, doneAt: T, ...stamp(ALEXIA.uid) }));
    await assertFails(updateDoc(refAc, { doneAt: '2026-10-08T11:00:00.000Z', ...stamp(ALEXIA.uid) }));
    await assertFails(deleteDoc(refAl));
    await assertFails(deleteDoc(refAc));
  });
});
