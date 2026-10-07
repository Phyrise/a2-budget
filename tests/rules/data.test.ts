/** Ce que les membres peuvent écrire : faits, objets, jalons, points de reprise. */
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { ALEXIA, ARTHUR, HH, db, fact, google, stamp, startEnv, undo } from './setup';

let env: RulesTestEnvironment;
const DAY_MS = 86_400_000;
const MILESTONES = {
  growthStage: 3,
  lifetimeCare: 40,
  longestStreak: 6,
  unlockedCreatureIds: ['kodama'],
  unlockedEnvironmentIds: ['ruisseau'],
};

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
    await setDoc(doc(d, `${HH}/completions/al`), fact(ARTHUR));
    await setDoc(doc(d, `${HH}/completions/ac`), fact(ALEXIA));
    await setDoc(doc(d, `${HH}/groceryHistory/h1`), fact(ALEXIA, { label: 'riz' }));
    await setDoc(doc(d, `${HH}/activity/n1`), fact(ALEXIA, { kind: 'thanks' }));
    await setDoc(doc(d, `${HH}/groceries/fresh`), { label: 'lait', ...stamp(ALEXIA.uid) });
    await setDoc(doc(d, `${HH}/groceries/old`), {
      label: 'pain',
      deletedAt: Timestamp.fromMillis(Date.now() - 31 * DAY_MS),
      ...stamp(ALEXIA.uid),
    });
    await setDoc(doc(d, `${HH}/groceries/recent`), {
      label: 'œufs',
      deletedAt: Timestamp.fromMillis(Date.now() - 2 * DAY_MS),
      ...stamp(ALEXIA.uid),
    });
    await setDoc(doc(d, `${HH}/meta/forestMilestones`), { ...MILESTONES, ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/checkpoints/2026-07-31`), { day: '2026-07-31', ...stamp(ARTHUR.uid) });
    await setDoc(doc(d, `${HH}/checkpoints/2026-06-01`), {
      day: '2026-06-01',
      genesis: true,
      ...stamp(ARTHUR.uid),
    });
  });
});

const al = () => db(google(env, ARTHUR));
const ac = () => db(google(env, ALEXIA));

describe('faits : ajout seulement, annulation douce', () => {
  it('création par son auteur', async () => {
    await assertSucceeds(setDoc(doc(al(), `${HH}/completions/new`), fact(ARTHUR)));
    await assertSucceeds(setDoc(doc(ac(), `${HH}/skips/s1`), fact(ALEXIA)));
    await assertSucceeds(setDoc(doc(al(), `${HH}/focusSessions/f1`), fact(ARTHUR, { minutes: 15 })));
  });

  it('fait réécrit refusé (même id, autre contenu ou même contenu)', async () => {
    await assertFails(setDoc(doc(al(), `${HH}/completions/al`), fact(ARTHUR, { localDay: '2026-10-01' })));
    await assertFails(setDoc(doc(al(), `${HH}/completions/al`), fact(ARTHUR)));
    await assertFails(updateDoc(doc(al(), `${HH}/completions/al`), { localDay: '2026-10-01', ...stamp(ARTHUR.uid) }));
  });

  it('fait déjà annulé à la création, ou signé par un autre : refusé', async () => {
    await assertFails(setDoc(doc(al(), `${HH}/completions/x`), fact(ARTHUR, undo(ARTHUR.uid))));
    await assertFails(setDoc(doc(al(), `${HH}/completions/y`), fact(ARTHUR, { createdBy: ALEXIA.uid })));
  });

  it('un fait ne se supprime pas (sauf historique des courses et nouvelles)', async () => {
    await assertFails(deleteDoc(doc(al(), `${HH}/completions/al`)));
    await assertSucceeds(deleteDoc(doc(al(), `${HH}/groceryHistory/h1`)));
    await assertSucceeds(deleteDoc(doc(al(), `${HH}/activity/n1`)));
  });

  it('annulation douce : une fois, par son auteur', async () => {
    const ref = doc(al(), `${HH}/completions/al`);
    await assertSucceeds(updateDoc(ref, undo(ARTHUR.uid)));
    await assertFails(updateDoc(ref, undo(ARTHUR.uid, { undoneDay: '2026-10-09' })));
    await assertFails(updateDoc(ref, { undoneAt: deleteField(), undoneDay: deleteField(), ...stamp(ARTHUR.uid) }));
  });

  it('annulation mal formée refusée', async () => {
    const ref = doc(al(), `${HH}/completions/al`);
    await assertFails(updateDoc(ref, undo(ARTHUR.uid, { undoneDay: '8 octobre' })));
    await assertFails(updateDoc(ref, undo(ARTHUR.uid, { undoneBy: ALEXIA.uid })));
    await assertFails(updateDoc(ref, undo(ARTHUR.uid, { localDay: '2026-10-01' })));
  });

  it('annuler le geste de l’autre exige la trace du mode développeur', async () => {
    const ref = doc(al(), `${HH}/completions/ac`);
    await assertFails(updateDoc(ref, undo(ARTHUR.uid)));
    await assertSucceeds(updateDoc(ref, undo(ARTHUR.uid, { devOverride: true })));
  });
});

describe('objets : dernier qui écrit gagne, suppression douce', () => {
  it('modification champ par champ par l’un ou l’autre', async () => {
    await assertSucceeds(updateDoc(doc(al(), `${HH}/groceries/fresh`), { label: 'lait d’avoine', ...stamp(ARTHUR.uid) }));
    await assertSucceeds(updateDoc(doc(ac(), `${HH}/groceries/fresh`), { aisle: 'frais', ...stamp(ALEXIA.uid) }));
  });

  it('suppression douce à l’heure du serveur, jamais falsifiée', async () => {
    const ref = doc(al(), `${HH}/groceries/fresh`);
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.fromMillis(Date.now() - 40 * DAY_MS), ...stamp(ARTHUR.uid) }));
    await assertSucceeds(updateDoc(ref, { deletedAt: serverTimestamp(), ...stamp(ARTHUR.uid) }));
    await assertSucceeds(updateDoc(ref, { deletedAt: deleteField(), ...stamp(ARTHUR.uid) }));
  });

  it('création déjà supprimée refusée', async () => {
    await assertFails(setDoc(doc(al(), `${HH}/tasks/t9`), { title: 'x', deletedAt: serverTimestamp(), ...stamp(ARTHUR.uid) }));
  });

  it('purge définitive seulement 30 jours après la suppression douce', async () => {
    await assertFails(deleteDoc(doc(al(), `${HH}/groceries/fresh`)));
    await assertFails(deleteDoc(doc(al(), `${HH}/groceries/recent`)));
    await assertSucceeds(deleteDoc(doc(al(), `${HH}/groceries/old`)));
  });
});

describe('jalons de la forêt : jamais en baisse', () => {
  const ref = () => doc(al(), `${HH}/meta/forestMilestones`);

  it('hausse acceptée', async () => {
    await assertSucceeds(setDoc(ref(), {
      ...MILESTONES,
      growthStage: 4,
      lifetimeCare: 55,
      unlockedCreatureIds: ['kodama', 'susuwatari'],
      ...stamp(ARTHUR.uid),
    }));
  });

  it('jalons en baisse refusés', async () => {
    await assertFails(setDoc(ref(), { ...MILESTONES, growthStage: 2, ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(ref(), { ...MILESTONES, lifetimeCare: 39, ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(ref(), { ...MILESTONES, longestStreak: 1, ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(ref(), { ...MILESTONES, unlockedCreatureIds: [], ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(ref(), { ...MILESTONES, unlockedEnvironmentIds: [], ...stamp(ARTHUR.uid) }));
  });

  it('forme incomplète ou suppression refusées', async () => {
    const { growthStage: _omis, ...partial } = MILESTONES;
    await assertFails(setDoc(ref(), { ...partial, ...stamp(ARTHUR.uid) }));
    await assertFails(deleteDoc(ref()));
  });
});

describe('points de reprise', () => {
  it('le jour du document est son id', async () => {
    await assertSucceeds(setDoc(doc(al(), `${HH}/checkpoints/2026-08-31`), { day: '2026-08-31', ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(doc(al(), `${HH}/checkpoints/2026-09-30`), { day: '2026-09-29', ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(doc(al(), `${HH}/checkpoints/demain`), { day: 'demain', ...stamp(ARTHUR.uid) }));
  });

  it('la genèse reste la genèse et ne se supprime pas', async () => {
    const genesis = doc(al(), `${HH}/checkpoints/2026-06-01`);
    await assertFails(setDoc(genesis, { day: '2026-06-01', ...stamp(ARTHUR.uid) }));
    await assertFails(deleteDoc(genesis));
    await assertSucceeds(deleteDoc(doc(al(), `${HH}/checkpoints/2026-07-31`)));
  });
});

describe('par personne (clé = rôle)', () => {
  it('chacun écrit le sien, lit celui de l’autre', async () => {
    await assertSucceeds(setDoc(doc(al(), `${HH}/memberState/a`), { activitySeenAt: 'x', ...stamp(ARTHUR.uid) }));
    await assertFails(setDoc(doc(al(), `${HH}/memberState/b`), { activitySeenAt: 'x', ...stamp(ARTHUR.uid) }));
    await assertSucceeds(setDoc(doc(ac(), `${HH}/push/b`), { endpoint: 'https://push', ...stamp(ALEXIA.uid) }));
    await assertFails(setDoc(doc(ac(), `${HH}/push/a`), { endpoint: 'https://push', ...stamp(ALEXIA.uid) }));
    await assertSucceeds(getDoc(doc(al(), `${HH}/push/b`)));
  });
});
