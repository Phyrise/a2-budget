import { describe, expect, it } from 'vitest';
import { HOUSEHOLD_NAMES, HOUSEHOLD_SCHEMA, MIN_APP, memberDocUpdate, newHouseholdDoc } from './household';

const NOW = new Date('2026-10-08T09:30:00.000Z');

describe('foyer a2home', () => {
  it('créé par le premier membre : noms des rôles, versions, date', () => {
    expect(newHouseholdDoc('b', NOW)).toEqual({
      names: { a: 'AL', b: 'AC' },
      schema: HOUSEHOLD_SCHEMA,
      minApp: MIN_APP,
      createdAt: '2026-10-08T09:30:00.000Z',
      createdByRole: 'b',
    });
    // Copie : le document ne partage rien avec la constante figée.
    expect(newHouseholdDoc('a', NOW).names).not.toBe(HOUSEHOLD_NAMES);
  });

  it('fiche du membre : écrite à l’arrivée, gardée ensuite, date d’arrivée conservée', () => {
    expect(memberDocUpdate(null, 'u1', NOW)).toEqual({ uid: 'u1', joinedAt: NOW.toISOString() });
    expect(memberDocUpdate({ uid: 'u1', joinedAt: '2026-01-01T00:00:00.000Z' }, 'u1', NOW)).toBeNull();
    expect(memberDocUpdate({ uid: 'ancien', joinedAt: '2026-01-01T00:00:00.000Z' }, 'u2', NOW)).toEqual({
      uid: 'u2',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(memberDocUpdate({ uid: 'u1' }, 'u1', NOW)).toEqual({ uid: 'u1', joinedAt: NOW.toISOString() });
  });
});
