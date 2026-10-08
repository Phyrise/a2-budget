import { describe, expect, it } from 'vitest';
import { HERE_WINDOW_MS, canPoke, dayCost, freshPoke, hereTab, isHere, parsePresence, partnerOf } from './presenceModel';

const NOW = 1_800_000_000_000;

describe('présence de l’autre', () => {
  it('là : visible et signe de moins de 2,5 min', () => {
    const p = parsePresence({ tab: 'budget', visible: true, at: NOW - 30_000 });
    expect(isHere(p, NOW)).toBe(true);
    expect(hereTab(p, NOW)).toBe('budget');
    expect(isHere(p, NOW - 30_000 + HERE_WINDOW_MS + 1)).toBe(false);
  });

  it('absent : caché, trop ancien, ou rien de connu', () => {
    expect(isHere(parsePresence({ tab: 'maison', visible: false, at: NOW }), NOW)).toBe(false);
    expect(isHere(parsePresence({ tab: 'maison', visible: true, at: NOW - 10 * 60_000 }), NOW)).toBe(false);
    expect(isHere(parsePresence({ uid: 'u', joinedAt: 'x' }), NOW)).toBe(false);
    expect(isHere(null, NOW)).toBe(false);
  });

  it('onglet inconnu : là, mais nulle part', () => {
    const p = parsePresence({ tab: 'train', visible: true, at: NOW });
    expect(isHere(p, NOW)).toBe(true);
    expect(hereTab(p, NOW)).toBeNull();
  });

  it('rôles', () => {
    expect(partnerOf('a')).toBe('b');
    expect(partnerOf('b')).toBe('a');
  });
});

describe('coucous', () => {
  it('anti-rafale de 5 s', () => {
    expect(canPoke(null, NOW)).toBe(true);
    expect(canPoke(NOW - 4_000, NOW)).toBe(false);
    expect(canPoke(NOW - 5_000, NOW)).toBe(true);
  });

  it('joué une fois, et seulement s’il est récent', () => {
    expect(freshPoke(0, NOW - 1_000, NOW)).toBe(true);
    expect(freshPoke(NOW - 1_000, NOW - 1_000, NOW)).toBe(false);
    expect(freshPoke(0, NOW - 60_000, NOW)).toBe(false);
    expect(freshPoke(0, null, NOW)).toBe(false);
  });
});

describe('coût Firestore', () => {
  it('une grosse journée à deux reste sous 2 000 lectures + écritures', () => {
    // 3 h d'app visible chacun, 30 ouvertures, 120 changements d'onglet, 20 coucous, 40 gestes.
    const day = { visibleMinutes: 180, openings: 30, tabChanges: 120, pokes: 20, playGestures: 40 };
    const cost = dayCost(day, day);
    expect(cost.writes).toBe(2 * (180 + 60 + 120 + 20 + 40));
    expect(cost.writes + cost.reads).toBeLessThan(2_000);
  });

  it('une journée ordinaire : quelques centaines', () => {
    const day = { visibleMinutes: 60, openings: 15, tabChanges: 40, pokes: 3, playGestures: 10 };
    const { reads, writes } = dayCost(day, day);
    expect(reads + writes).toBeLessThan(700);
  });
});
