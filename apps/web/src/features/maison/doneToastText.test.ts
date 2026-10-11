import { describe, expect, it } from 'vitest';
import { doneMessage, otherChoices } from './doneToastText';

const names = { a: 'AL', b: 'AC' };

describe('toast « Fait par toi »', () => {
  it('message : toi, l’autre, ensemble ; Courses', () => {
    expect(doneMessage('a', 'a', names)).toBe('Fait par toi');
    expect(doneMessage('b', 'a', names)).toBe('Fait par AC');
    expect(doneMessage('both', 'b', names)).toBe('Fait ensemble');
    expect(doneMessage('b', 'b', names, 'groceries')).toBe('Courses faites par toi');
    expect(doneMessage('both', 'a', names, 'groceries')).toBe('Courses faites ensemble');
  });

  it('invité : les prénoms', () => {
    expect(doneMessage('a', null, names)).toBe('Fait par AL');
    expect(otherChoices('a', null, names).map((c) => c.label)).toEqual(['C’était AC', 'Ensemble']);
  });

  it('choix : les autres, soi d’abord', () => {
    expect(otherChoices('a', 'a', names).map((c) => c.label)).toEqual(['C’était AC', 'Ensemble']);
    expect(otherChoices('a', 'b', names).map((c) => c.label)).toEqual(['C’était moi', 'Ensemble']);
    expect(otherChoices('both', 'b', names).map((c) => [c.who, c.label])).toEqual([
      ['b', 'C’était moi'],
      ['a', 'C’était AL'],
    ]);
  });
});
