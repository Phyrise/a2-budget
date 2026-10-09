/** V5.1 : présence (memberState) et bocal partagé (play/{rôle}). */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { ALEXIA, ARTHUR, HH, STRANGER, db, google, stamp, startEnv } from './setup';

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
    await setDoc(doc(d, `${HH}/play/b`), { given: 4, spent: 1, caught: 2, golden: 0, migrated: true, ...stamp(ALEXIA.uid) });
  });
});

describe('présence', () => {
  it('chacun publie son onglet et ses coucous, lus par l’autre', async () => {
    const al = db(google(env, ARTHUR));
    const ac = db(google(env, ALEXIA));
    await assertSucceeds(setDoc(doc(al, `${HH}/memberState/a`), { tab: 'budget', visible: true, at: serverTimestamp(), ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertSucceeds(setDoc(doc(al, `${HH}/memberState/a`), { pokeAt: serverTimestamp(), ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertSucceeds(getDoc(doc(ac, `${HH}/memberState/a`)));
  });

  it('personne ne publie la présence de l’autre', async () => {
    const al = db(google(env, ARTHUR));
    await assertFails(setDoc(doc(al, `${HH}/memberState/b`), { tab: 'budget', visible: true, at: serverTimestamp(), ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertFails(setDoc(doc(al, `${HH}/memberState/a`), { tab: 'budget', visible: true }, { merge: true }));
    await assertFails(getDoc(doc(db(google(env, STRANGER)), `${HH}/memberState/a`)));
  });
});

describe('compagnon lié au compte (V5.7)', () => {
  it('chacun écrit SON compagnon dans sa fiche (fusion), l’autre le lit ; la présence ne l’efface pas', async () => {
    const al = db(google(env, ARTHUR));
    const ac = db(google(env, ALEXIA));
    await assertSucceeds(setDoc(doc(al, `${HH}/memberState/a`), { uid: ARTHUR.uid, joinedAt: 'x', ...stamp(ARTHUR.uid) }));
    await assertSucceeds(setDoc(doc(al, `${HH}/memberState/a`), { companion: 'teto', ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertSucceeds(setDoc(doc(al, `${HH}/memberState/a`), { tab: 'budget', visible: true, at: serverTimestamp(), ...stamp(ARTHUR.uid) }, { merge: true }));
    const read = await assertSucceeds(getDoc(doc(ac, `${HH}/memberState/a`)));
    expect(read.data()).toMatchObject({ uid: ARTHUR.uid, companion: 'teto', tab: 'budget' });
  });

  it('personne n’écrit le compagnon de l’autre', async () => {
    const ac = db(google(env, ALEXIA));
    await assertFails(setDoc(doc(ac, `${HH}/memberState/a`), { companion: 'hin', ...stamp(ALEXIA.uid) }, { merge: true }));
  });
});

describe('bocal partagé', () => {
  it('chacun incrémente son document ; les deux se lisent', async () => {
    const al = db(google(env, ARTHUR));
    await assertSucceeds(setDoc(doc(al, `${HH}/play/a`), { given: 3, spent: 0, caught: 1, golden: 0, migrated: true, ...stamp(ARTHUR.uid) }));
    await assertSucceeds(setDoc(doc(al, `${HH}/play/a`), { given: increment(1), caught: increment(1), ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertSucceeds(setDoc(doc(al, `${HH}/play/a`), { spent: increment(1), ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertSucceeds(getDoc(doc(al, `${HH}/play/b`)));
  });

  it('premier geste avant la migration : document créé par incrément', async () => {
    const al = db(google(env, ARTHUR));
    await assertSucceeds(setDoc(doc(al, `${HH}/play/a`), { given: increment(1), ...stamp(ARTHUR.uid) }, { merge: true }));
  });

  it('jamais le document de l’autre', async () => {
    const al = db(google(env, ARTHUR));
    await assertFails(setDoc(doc(al, `${HH}/play/b`), { given: increment(1), ...stamp(ARTHUR.uid) }, { merge: true }));
    await assertFails(getDoc(doc(db(google(env, STRANGER)), `${HH}/play/b`)));
  });

  it('compteurs jamais en baisse, entiers, positifs ; marque de migration gardée', async () => {
    const ac = db(google(env, ALEXIA));
    await assertFails(setDoc(doc(ac, `${HH}/play/b`), { given: increment(-1), ...stamp(ALEXIA.uid) }, { merge: true }));
    await assertFails(setDoc(doc(ac, `${HH}/play/b`), { given: 2, ...stamp(ALEXIA.uid) }, { merge: true }));
    await assertFails(setDoc(doc(ac, `${HH}/play/b`), { caught: 2.5, ...stamp(ALEXIA.uid) }, { merge: true }));
    await assertFails(setDoc(doc(ac, `${HH}/play/b`), { migrated: false, ...stamp(ALEXIA.uid) }, { merge: true }));
    await assertFails(setDoc(doc(ac, `${HH}/play/b`), { jar: 99, ...stamp(ALEXIA.uid) }, { merge: true }));
    await assertFails(setDoc(doc(ac, `${HH}/play/b`), { given: increment(1) }, { merge: true }));
    await assertFails(deleteDoc(doc(ac, `${HH}/play/b`)));
  });
});
