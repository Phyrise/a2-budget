import { describe, expect, it } from 'vitest';
import type { Member, SessionEvent } from '../sync/firebase/types';
import { accountReducer, initialAccount, needsFirebase, showsWelcome, type AccountEvent, type AccountState } from './accountModel';

const AL: Member = { uid: 'u-al', email: 'arthur.longuefosse@gmail.com', role: 'a' };
const AC: Member = { uid: 'u-ac', email: 'alexia.chaval@free.fr', role: 'b' };

const session = (event: SessionEvent): AccountEvent => ({ type: 'session', event });
const run = (state: AccountState, ...events: AccountEvent[]) => events.reduce(accountReducer, state);

describe('accueil et invité', () => {
  it('premier lancement : l’accueil, sans Firebase', () => {
    const start = initialAccount(null);
    expect(showsWelcome(start)).toBe(true);
    expect(needsFirebase(start)).toBe(false);
  });

  it('« Continuer en invité » : l’app, et jamais Firebase', () => {
    const guest = run(initialAccount(null), { type: 'guest' });
    expect(guest).toMatchObject({ entry: 'guest', phase: 'idle', member: null });
    expect(showsWelcome(guest)).toBe(false);
    expect(needsFirebase(guest)).toBe(false);
    // Choix mémorisé : à la réouverture non plus.
    expect(needsFirebase(initialAccount('guest'))).toBe(false);
  });

  it('un événement de session égaré n’entre pas en invité', () => {
    const guest = initialAccount('guest');
    expect(run(guest, session({ kind: 'member', member: AL }))).toEqual(guest);
    expect(run(guest, session({ kind: 'refused', reason: 'not-invited' }))).toEqual(guest);
  });
});

describe('connexion Google', () => {
  it('accueil → fenêtre → membre (l’état « personne » initial est ignoré)', () => {
    const state = run(
      initialAccount(null),
      { type: 'connect' },
      session({ kind: 'signed-out' }),
      session({ kind: 'member', member: AL }),
      { type: 'outcome', outcome: { kind: 'done' } },
    );
    expect(state).toMatchObject({ entry: 'google', phase: 'member', member: AL, household: 'pending', notice: null });
    expect(showsWelcome(state)).toBe(false);
    expect(needsFirebase(state)).toBe(true);
  });

  it('compte non invité : retour à l’accueil avec un mot doux', () => {
    const state = run(initialAccount(null), { type: 'connect' }, session({ kind: 'refused', reason: 'not-invited' }));
    expect(state).toMatchObject({ entry: null, phase: 'idle', member: null, notice: 'not-invited' });
    // La déconnexion qui suit ne l'efface pas.
    expect(run(state, session({ kind: 'signed-out' }), { type: 'outcome', outcome: { kind: 'done' } }).notice).toBe(
      'not-invited',
    );
  });

  it('refus depuis les Réglages (invité) : l’accueil aussi', () => {
    const state = run(initialAccount('guest'), { type: 'connect' }, session({ kind: 'refused', reason: 'unverified' }));
    expect(state).toMatchObject({ entry: null, notice: 'unverified' });
    expect(showsWelcome(state)).toBe(true);
  });

  it('fenêtre fermée : rien ne change ; bloquée ou hors ligne : un mot', () => {
    const start = initialAccount(null);
    expect(run(start, { type: 'connect' }, { type: 'outcome', outcome: { kind: 'cancelled' } })).toEqual(start);
    expect(
      run(initialAccount('guest'), { type: 'connect' }, { type: 'outcome', outcome: { kind: 'failed', notice: 'popup-blocked' } }),
    ).toMatchObject({ entry: 'guest', phase: 'idle', notice: 'popup-blocked' });
    expect(run(start, { type: 'connect' }, { type: 'load-failed' })).toMatchObject({ phase: 'idle', notice: 'offline' });
  });

  it('nouvelle tentative : le mot précédent s’efface', () => {
    const refused = run(initialAccount(null), { type: 'connect' }, session({ kind: 'refused', reason: 'not-invited' }));
    expect(run(refused, { type: 'connect' }).notice).toBeNull();
  });
});

describe('réouverture et déconnexion', () => {
  it('session relue : l’app tout de suite, le membre ensuite', () => {
    const start = initialAccount('google');
    expect(start.phase).toBe('restoring');
    expect(showsWelcome(start)).toBe(false);
    expect(needsFirebase(start)).toBe(true);
    expect(run(start, session({ kind: 'member', member: AC }))).toMatchObject({ phase: 'member', member: AC });
  });

  it('session perdue (ou retour de redirection sans compte) : l’accueil', () => {
    expect(run(initialAccount('google'), session({ kind: 'signed-out' }))).toMatchObject({ entry: null, phase: 'idle' });
    expect(run(initialAccount('google'), session({ kind: 'failed', notice: 'failed' }))).toMatchObject({
      entry: null,
      notice: 'failed',
    });
  });

  it('compte retiré de la liste : déconnecté et ramené à l’accueil', () => {
    const member = run(initialAccount('google'), session({ kind: 'member', member: AL }));
    expect(run(member, session({ kind: 'refused', reason: 'not-invited' }))).toMatchObject({
      entry: null,
      member: null,
      notice: 'not-invited',
    });
  });

  it('« Se déconnecter » : invité, l’app reste', () => {
    const member = run(initialAccount('google'), session({ kind: 'member', member: AL }));
    const guest = run(member, { type: 'guest' }, session({ kind: 'signed-out' }));
    expect(guest).toMatchObject({ entry: 'guest', phase: 'idle', member: null });
    expect(showsWelcome(guest)).toBe(false);
    expect(needsFirebase(guest)).toBe(false);
  });

  it('foyer : suivi pour le membre, gardé si la session est relue', () => {
    const member = run(initialAccount('google'), session({ kind: 'member', member: AL }), { type: 'household', status: 'ready' });
    expect(member.household).toBe('ready');
    expect(run(member, session({ kind: 'member', member: AL })).household).toBe('ready');
    expect(run(member, session({ kind: 'member', member: { ...AL, uid: 'autre' } })).household).toBe('pending');
    expect(run(initialAccount('guest'), { type: 'household', status: 'ready' }).household).toBe('pending');
  });
});
