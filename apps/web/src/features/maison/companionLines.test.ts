import { COMPANION_IDS } from '@a2/core';
import { describe, expect, it } from 'vitest';
import { COMPANION_LINES, linesFor, pickLine, type BubbleContext } from './companionLines';

const CONTEXTS: readonly BubbleContext[] = ['check', 'chore', 'allDone', 'morning', 'pause', 'claim', 'skip', 'help'];
const vars = { humain: 'AL', autre: 'AC' };

describe('répliques des compagnons (V5.6)', () => {
  it('chaque compagnon a des répliques pour chaque contexte, autant que Jiji', () => {
    for (const id of COMPANION_IDS) {
      for (const ctx of CONTEXTS) {
        const lines = COMPANION_LINES[id][ctx];
        expect(lines.length, `${id}/${ctx}`).toBe(COMPANION_LINES.jiji[ctx].length);
        for (const line of lines) expect(line.trim().length, `${id}/${ctx}`).toBeGreaterThan(0);
      }
    }
  });

  it('aucune réplique partagée entre deux compagnons, pas de kompeitō', () => {
    const seen = new Map<string, string>();
    for (const id of COMPANION_IDS) {
      for (const ctx of CONTEXTS) {
        for (const line of COMPANION_LINES[id][ctx]) {
          expect(seen.get(line), line).toBeUndefined();
          seen.set(line, id);
          expect(line).not.toMatch(/kompe/i);
        }
      }
    }
  });

  it('la voix suit le compagnon choisi, sinon celui du rôle', () => {
    expect(linesFor('hin', 'a')).toBe(COMPANION_LINES.hin);
    expect(linesFor('teto', 'b')).toBe(COMPANION_LINES.teto);
    expect(linesFor(undefined, 'a')).toBe(COMPANION_LINES.jiji);
    expect(linesFor(undefined, 'b')).toBe(COMPANION_LINES.calcifer);
  });

  it('pickLine tire dans les répliques du compagnon choisi', () => {
    const typo = (s: string) => s.replace(/\{humain\}/g, vars.humain).replace(/\{autre\}/g, vars.autre).replace(/\s/g, '');
    for (const id of COMPANION_IDS) {
      const pool = COMPANION_LINES[id].check.map(typo);
      for (let i = 0; i < 6; i++) {
        const line = pickLine('a', 'check', vars, () => i / 6, id);
        expect(pool, `${id}: ${line}`).toContain(line.replace(/\s/g, ''));
      }
    }
  });
});
