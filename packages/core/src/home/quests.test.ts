import { describe, expect, it } from 'vitest';
import { addDays, localDateKey, parseLocalDateKey } from './dates.js';
import {
  devQuest,
  doneQuests,
  helpQuest,
  questDaysBetween,
  questOfDay,
  questStatus,
  scheduledQuest,
  validateQuests,
  type SharedQuest,
} from './quests.js';
import { emptyAppState } from './appState.js';
import { validateAppState } from './appState.js';

const at = (day: string, h = 10) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`);

describe('calendrier des quêtes (déterministe)', () => {
  it('même date → même quête, sur deux « téléphones »', () => {
    const days = questDaysBetween('2026-01-05', '2026-12-27');
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) expect(scheduledQuest(d)).toEqual(scheduledQuest(d));
  });

  it('≈ 1 à 2 par semaine, jamais deux jours de suite dans la semaine', () => {
    let monday = parseLocalDateKey('2026-01-05');
    let total = 0;
    for (let w = 0; w < 52; w++) {
      const days = questDaysBetween(localDateKey(monday), localDateKey(addDays(monday, 6)));
      expect(days.length).toBeGreaterThanOrEqual(1);
      expect(days.length).toBeLessThanOrEqual(2);
      if (days.length === 2) expect(localDateKey(addDays(parseLocalDateKey(days[0]!), 1))).not.toBe(days[1]);
      total += days.length;
      monday = addDays(monday, 7);
    }
    expect(total / 52).toBeGreaterThan(1.2);
    expect(total / 52).toBeLessThan(1.9);
  });

  it('les trois types apparaissent, chacun dans son onglet', () => {
    const quests = questDaysBetween('2026-01-05', '2026-12-27').map((d) => scheduledQuest(d)!);
    const kinds = new Set(quests.map((q) => q.kind));
    expect(kinds).toEqual(new Set(['rocher', 'tresor', 'pousse']));
    for (const q of quests) {
      expect(q.tab).toBe({ rocher: 'budget', tresor: 'courses', pousse: 'calendar' }[q.kind]);
      expect(q.id).toBe(`${q.day}-${q.kind}`);
    }
  });
});

describe('cycle de vie', () => {
  const day = questDaysBetween('2026-10-05', '2026-10-25')[0]!;
  const virtual = questOfDay([], day, { scheduled: true })!;

  it('pas encore touchée : en attente, rien d’écrit', () => {
    expect(virtual).not.toBeNull();
    expect(questStatus(virtual)).toBe('waiting');
    expect(questOfDay([], day, { scheduled: false })).toBeNull();
  });

  it('AL touche → à moitié ; AC touche le même jour → réglée', () => {
    const one = helpQuest([], virtual, 'a', at(day, 9));
    expect(one).toHaveLength(1);
    expect(one[0]!.createdBy).toBe('a');
    expect(questStatus(one[0]!)).toBe('half');
    expect(helpQuest(one, one[0]!, 'a', at(day, 11))).toBe(one); // une fois
    const two = helpQuest(one, one[0]!, 'b', at(day, 20));
    expect(questStatus(two[0]!)).toBe('done');
    expect(two[0]!.doneAt).toBe(at(day, 20).toISOString());
    expect(doneQuests(two)).toHaveLength(1);
    expect(questOfDay(two, day, { scheduled: true })!.id).toBe(two[0]!.id);
  });

  it('le lendemain : plus touchable, elle s’efface (pas de reproche)', () => {
    const one = helpQuest([], virtual, 'a', at(day, 9));
    const next = localDateKey(addDays(parseLocalDateKey(day), 1));
    expect(helpQuest(one, one[0]!, 'b', at(next, 9))).toBe(one);
    expect(questOfDay(one, next, { scheduled: false })).toBeNull();
    expect(doneQuests(one)).toEqual([]);
  });

  it('jamais plus d’une à la fois : la dernière ouverte du jour', () => {
    const d1 = devQuest('rocher', day, 'a', 'x1');
    const d2 = devQuest('pousse', day, 'b', 'x2');
    expect(questOfDay([d1, d2], day, { scheduled: true })!.id).toBe(d2.id);
    const done: SharedQuest = { ...d2, helpers: { a: at(day).toISOString(), b: at(day).toISOString() } };
    expect(questOfDay([d1, done], day, { scheduled: true })!.id).toBe(d1.id);
  });
});

describe('validation (rétrocompatible)', () => {
  it('AppState sans quêtes reste valide ; avec, relu tel quel', () => {
    const base = emptyAppState();
    expect(validateAppState(base).ok).toBe(true);
    const q = helpQuest([], devQuest('tresor', '2026-10-09', 'a', 'ab'), 'a', at('2026-10-09'));
    const r = validateAppState({ ...base, quests: { items: q } });
    expect(r.ok && r.state.quests?.items).toEqual(q);
  });

  it('refuse un type inconnu, un onglet faux, un rôle inconnu', () => {
    const q = devQuest('tresor', '2026-10-09', 'a', 'ab');
    expect(validateQuests({ items: [q] }).ok).toBe(true);
    expect(validateQuests({ items: [{ ...q, kind: 'dragon' }] }).ok).toBe(false);
    expect(validateQuests({ items: [{ ...q, tab: 'budget' }] }).ok).toBe(false);
    expect(validateQuests({ items: [{ ...q, helpers: { c: '2026-10-09T10:00:00.000Z' } }] }).ok).toBe(false);
    expect(validateQuests({ items: [q, q] }).ok).toBe(false);
  });
});
