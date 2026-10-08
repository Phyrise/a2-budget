import { describe, expect, it } from 'vitest';
import {
  CIRCLES_MAX,
  circlePartId,
  circleWriters,
  mergeWeek,
  nextSeenMark,
  saveCirclePart,
  unreadLetter,
  weeklyCircles,
} from './circleParts.js';
import { circleForWeek, saveCircle } from './rituals.js';
import { validateRituals } from './careValidation.js';
import type { RitualsState } from './types.js';

const W = '2026-10-05'; // un lundi
const part = (author: 'a' | 'b', heldAt: string, extra: Partial<Parameters<typeof saveCirclePart>[1]> = {}) => ({
  author,
  weekStart: W,
  heldAt,
  gratitude: [{ from: author, to: author === 'a' ? ('b' as const) : ('a' as const), text: `merci de ${author}` }],
  burdens: [{ who: author, text: `poids de ${author}` }],
  intentions: [],
  ...extra,
});

describe('parts du cercle', () => {
  it('id déterministe, une part par auteur et par semaine', () => {
    let r = saveCirclePart(undefined, part('a', '2026-10-09T10:00:00.000Z'));
    r = saveCirclePart(r, part('b', '2026-10-09T11:00:00.000Z'));
    r = saveCirclePart(r, part('a', '2026-10-09T12:00:00.000Z', { notes: [{ from: 'a', to: 'b', text: ' bisous ' }] }));
    expect(r.circles.map((c) => c.id)).toEqual([circlePartId(W, 'a'), circlePartId(W, 'b')]);
    expect(r.circles[0]!.notes).toEqual([{ from: 'a', to: 'b', text: 'bisous' }]);
    expect(validateRituals(r).ok).toBe(true);
  });

  it("une part ne garde que les mots de son auteur", () => {
    const r = saveCirclePart(undefined, {
      ...part('a', '2026-10-09T10:00:00.000Z'),
      burdens: [{ who: 'b', text: 'pas à moi' }, { who: 'a', text: 'à moi' }],
      intentions: ['une', 'deux'],
    });
    expect(r.circles[0]!.burdens).toEqual([{ who: 'a', text: 'à moi' }]);
    expect(r.circles[0]!.intentions).toEqual(['une']);
  });

  it('fusion : chacun ses mots, le cercle à deux complète sans écraser', () => {
    const legacy = saveCircle(undefined, {
      id: 'old',
      weekStart: W,
      heldAt: '2026-10-08T09:00:00.000Z',
      gratitude: [{ from: 'a', to: 'b', text: 'vieux merci a' }, { from: 'b', to: 'a', text: 'vieux merci b' }],
      burdens: [],
      intentions: ['balade'],
    });
    const r = saveCirclePart(legacy, part('b', '2026-10-09T11:00:00.000Z'));
    expect(r.circles).toHaveLength(2);
    const merged = circleForWeek(r, W)!;
    expect(merged.gratitude.map((g) => g.text)).toEqual(['vieux merci a', 'merci de b']);
    expect(merged.intentions).toEqual(['balade']);
    expect(merged.heldAt).toBe('2026-10-09T11:00:00.000Z');
    expect(circleWriters(r, W)).toEqual(['a', 'b']);
    expect(weeklyCircles(r)).toHaveLength(1);
    expect(validateRituals(r).ok).toBe(true);
  });

  it('un cercle seul est rendu tel quel ; tenir le cercle à deux remplace les parts', () => {
    const r = saveCirclePart(undefined, part('a', '2026-10-09T10:00:00.000Z'));
    expect(circleWriters(r, W)).toEqual(['a']);
    const together = saveCircle(r, { id: 'x', weekStart: W, heldAt: '2026-10-09T13:00:00.000Z', gratitude: [], burdens: [], intentions: [] });
    expect(together.circles).toHaveLength(1);
    expect(mergeWeek(together.circles)).toBe(together.circles[0]);
  });

  it('deux téléphones : les parts écrites chacune de son côté se retrouvent toutes deux', () => {
    const base: RitualsState = { circles: [] };
    const al = saveCirclePart(base, part('a', '2026-10-09T10:00:00.000Z'));
    const ac = saveCirclePart(base, part('b', '2026-10-09T10:00:01.000Z'));
    // Chaque part a son propre document : l'union des deux vues garde tout.
    const union = { circles: [...al.circles, ...ac.circles] };
    expect(validateRituals(union).ok).toBe(true);
    const merged = circleForWeek(union, W)!;
    expect(merged.burdens.map((b) => b.who)).toEqual(['a', 'b']);
  });

  it('au plus CIRCLES_MAX semaines', () => {
    let r: RitualsState | undefined;
    const monday = new Date(2020, 0, 6);
    for (let i = 0; i <= CIRCLES_MAX; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      r = saveCirclePart(r, { ...part('a', '2026-10-09T10:00:00.000Z'), weekStart: key });
      r = saveCirclePart(r, { ...part('b', '2026-10-09T10:00:00.000Z'), weekStart: key });
    }
    expect(weeklyCircles(r)).toHaveLength(CIRCLES_MAX);
    expect(r!.circles).toHaveLength(CIRCLES_MAX * 2);
  });
});

describe('lettre non lue', () => {
  const now = new Date(2026, 9, 9, 18, 0); // vendredi de la semaine W
  const r = saveCirclePart(saveCirclePart(undefined, part('b', '2026-10-09T10:00:00.000Z')), part('a', '2026-10-09T11:00:00.000Z'));

  it("la part de l'autre, pas la sienne", () => {
    expect(unreadLetter(r, 'a', null, now)?.author).toBe('b');
    expect(unreadLetter(r, 'b', null, now)?.author).toBe('a');
  });

  it('lue : plus de lettre, jusqu’à ce que l’autre la complète', () => {
    const letter = unreadLetter(r, 'a', undefined, now)!;
    const seen = nextSeenMark(undefined, letter);
    expect(unreadLetter(r, 'a', seen, now)).toBeNull();
    const again = saveCirclePart(r, part('b', '2026-10-09T15:00:00.000Z', { notes: [{ from: 'b', to: 'a', text: 'coucou' }] }));
    expect(unreadLetter(again, 'a', seen, now)?.notes?.[0]?.text).toBe('coucou');
    expect(nextSeenMark('2026-12-01T00:00:00.000Z', letter)).toBe('2026-12-01T00:00:00.000Z');
  });

  it('les vieilles semaines ne font pas de lettre ; le cercle à deux non plus', () => {
    const later = new Date(2026, 9, 21);
    expect(unreadLetter(r, 'a', null, later)).toBeNull();
    const nextWeek = new Date(2026, 9, 14);
    expect(unreadLetter(r, 'a', null, nextWeek)?.author).toBe('b');
    const together = saveCircle(undefined, { id: 'x', weekStart: W, heldAt: '2026-10-09T13:00:00.000Z', gratitude: [], burdens: [], intentions: [] });
    expect(unreadLetter(together, 'a', null, now)).toBeNull();
  });
});
