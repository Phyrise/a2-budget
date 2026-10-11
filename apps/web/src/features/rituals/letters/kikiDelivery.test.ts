import { describe, expect, it } from 'vitest';
import { kikiMayFly, kikiPost, letterArrived, type PostGate } from './kikiDelivery';

const open: PostGate = { calm: false, hidden: false, reading: false };

describe('letterArrived — nouvelle lettre ou déjà connue', () => {
  it('rien au premier calcul (lettre déjà là au chargement)', () => {
    expect(letterArrived(undefined, 'c1|t1')).toBe(false);
  });
  it('une lettre qui arrive, ou se complète', () => {
    expect(letterArrived(null, 'c1|t1')).toBe(true);
    expect(letterArrived('c1|t1', 'c1|t2')).toBe(true);
  });
  it('même lettre, ou plus de lettre : rien', () => {
    expect(letterArrived('c1|t1', 'c1|t1')).toBe(false);
    expect(letterArrived('c1|t1', null)).toBe(false);
  });
});

describe('kikiMayFly — calme, arrière-plan, lecture, déjà en vol', () => {
  it('app ouverte et rien en vol : Kiki part', () => {
    expect(kikiMayFly(open, false)).toBe(true);
  });
  it('calme (mouvement réduit ou « Immobile ») : toast seul', () => {
    expect(kikiMayFly({ ...open, calm: true }, false)).toBe(false);
  });
  it('arrière-plan ou lettre déjà ouverte : non', () => {
    expect(kikiMayFly({ ...open, hidden: true }, false)).toBe(false);
    expect(kikiMayFly({ ...open, reading: true }, false)).toBe(false);
  });
  it('déjà en vol : non', () => {
    expect(kikiMayFly(open, true)).toBe(false);
  });
});

describe('kikiPost — une seule traversée à la fois', () => {
  it('deux lettres rapprochées : un seul envol, puis de nouveau après l’atterrissage', () => {
    expect(kikiPost.deliver('b', open)).toBe(true);
    const first = kikiPost.get();
    expect(first?.from).toBe('b');
    expect(kikiPost.deliver('b', open)).toBe(false);
    expect(kikiPost.get()).toBe(first);
    // Un vieil atterrissage ne coupe pas le vol en cours.
    kikiPost.land((first?.id ?? 0) - 1);
    expect(kikiPost.get()).toBe(first);
    kikiPost.land(first?.id ?? 0);
    expect(kikiPost.get()).toBeNull();
    expect(kikiPost.deliver('a', open)).toBe(true);
    expect(kikiPost.get()?.id).toBe((first?.id ?? 0) + 1);
    kikiPost.land(kikiPost.get()?.id ?? 0);
  });
  it('calme : rien ne décolle', () => {
    expect(kikiPost.deliver('a', { ...open, calm: true })).toBe(false);
    expect(kikiPost.get()).toBeNull();
  });
});
