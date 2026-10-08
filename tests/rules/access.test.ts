/** Qui entre : liste blanche, e-mail vérifié, foyer unique, tampon serveur. */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
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
    await setDoc(doc(d, `${HH}/tasks/t1`), { title: 'Arroser', ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/completions/c1`), fact(ARTHUR));
  });
});

describe('inconnus', () => {
  it('sans connexion : rien', async () => {
    const d = db(env.unauthenticatedContext());
    await assertFails(getDoc(doc(d, HH)));
    await assertFails(getDoc(doc(d, `${HH}/tasks/t1`)));
    await assertFails(setDoc(doc(d, `${HH}/tasks/t2`), { title: 'x' }));
  });

  it('un compte Google non invité ne lit ni n’écrit rien', async () => {
    const d = db(google(env, STRANGER));
    await assertFails(getDoc(doc(d, HH)));
    await assertFails(getDoc(doc(d, `${HH}/tasks/t1`)));
    await assertFails(getDocs(collection(d, `${HH}/completions`)));
    await assertFails(setDoc(doc(d, `${HH}/tasks/t2`), { title: 'x', ...stamp(STRANGER.uid) }));
    await assertFails(setDoc(doc(d, `${HH}/completions/c2`), fact(STRANGER)));
    await assertFails(updateDoc(doc(d, HH), { schema: 2, ...stamp(STRANGER.uid) }));
  });

  it('un e-mail de la liste mais non vérifié est refusé', async () => {
    const d = db(google(env, { uid: 'uid-usurpateur', email: ARTHUR.email }, false));
    await assertFails(getDoc(doc(d, HH)));
    await assertFails(setDoc(doc(d, `${HH}/tasks/t2`), { title: 'x', ...stamp('uid-usurpateur') }));
  });

  it('un compte sans e-mail (anonyme) est refusé', async () => {
    const d = db(env.authenticatedContext('uid-anonyme', { firebase: { sign_in_provider: 'anonymous' } }));
    await assertFails(getDoc(doc(d, HH)));
  });
});

describe('membres', () => {
  it('Arthur et Alexia lisent et écrivent le foyer', async () => {
    const al = db(google(env, ARTHUR));
    const ac = db(google(env, ALEXIA));
    await assertSucceeds(getDoc(doc(al, HH)));
    await assertSucceeds(getDoc(doc(ac, `${HH}/completions/c1`)));
    await assertSucceeds(updateDoc(doc(ac, HH), { names: { a: 'AL', b: 'AC' }, ...stamp(ALEXIA.uid) }));
    await assertSucceeds(setDoc(doc(ac, `${HH}/tasks/t2`), { title: 'Courses', ...stamp(ALEXIA.uid) }));
    await assertSucceeds(getDoc(doc(al, `${HH}/tasks/t2`)));
    await assertSucceeds(setDoc(doc(ac, `${HH}/completions/c2`), fact(ALEXIA)));
  });

  it('l’e-mail est comparé en minuscules', async () => {
    const d = db(google(env, { uid: ALEXIA.uid, email: 'BlablaDodo24@GMAIL.COM' }));
    await assertSucceeds(getDoc(doc(d, HH)));
    await assertSucceeds(setDoc(doc(d, `${HH}/completions/c3`), fact(ALEXIA)));
  });

  it('le rôle vient de l’e-mail : Arthur ne signe pas un fait « b »', async () => {
    const al = db(google(env, ARTHUR));
    await assertFails(setDoc(doc(al, `${HH}/completions/c4`), fact({ uid: ARTHUR.uid, role: 'b' })));
    await assertFails(setDoc(doc(al, `${HH}/completions/c5`), fact({ uid: ALEXIA.uid, role: 'a' })));
  });

  it('les requêtes « delta » par syncedAt passent', async () => {
    const d = db(google(env, ARTHUR));
    const since = Timestamp.fromMillis(Date.now() - 3_600_000);
    await assertSucceeds(getDocs(query(collection(d, `${HH}/completions`), where('syncedAt', '>', since))));
    await assertSucceeds(getDocs(query(collection(d, `${HH}/tasks`), where('syncedAt', '>', since))));
  });

  it('un autre foyer, la liste des foyers et les chemins inconnus sont refusés', async () => {
    const d = db(google(env, ARTHUR));
    await assertFails(setDoc(doc(d, 'households/autre'), { ...stamp(ARTHUR.uid) }));
    await assertFails(getDoc(doc(d, 'households/autre/tasks/t1')));
    await assertFails(getDocs(collection(d, 'households')));
    await assertFails(setDoc(doc(d, `users/${ARTHUR.uid}`), { hid: 'a2home' }));
    await assertFails(setDoc(doc(d, 'invites/KQ7M2XPD'), { hid: 'a2home', role: 'b' }));
    await assertFails(setDoc(doc(d, `${HH}/secrets/x`), { ...stamp(ARTHUR.uid) }));
    await assertFails(getDoc(doc(d, `${HH}/secrets/x`)));
  });

  it('le foyer ne se supprime pas', async () => {
    await assertFails(deleteDoc(doc(db(google(env, ARTHUR)), HH)));
  });
});

describe('tampon de chaque écriture', () => {
  it('syncedAt falsifié refusé', async () => {
    const d = db(google(env, ARTHUR));
    const forged = { updatedBy: ARTHUR.uid, syncedAt: Timestamp.fromMillis(Date.now() + 86_400_000) };
    await assertFails(setDoc(doc(d, `${HH}/tasks/t2`), { title: 'x', ...forged }));
    await assertFails(setDoc(doc(d, `${HH}/completions/c2`), { ...fact(ARTHUR), ...forged }));
    await assertFails(updateDoc(doc(d, HH), { schema: 2, ...forged }));
  });

  it('auteur usurpé ou tampon absent refusé', async () => {
    const d = db(google(env, ARTHUR));
    await assertFails(setDoc(doc(d, `${HH}/tasks/t2`), { title: 'x', ...stamp(ALEXIA.uid) }));
    await assertFails(setDoc(doc(d, `${HH}/tasks/t3`), { title: 'x' }));
    await assertFails(updateDoc(doc(d, `${HH}/tasks/t1`), { title: 'y' }));
  });
});
