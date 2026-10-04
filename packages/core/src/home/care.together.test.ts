import { describe, expect, it } from 'vitest';
import { rebalanceSuggestions, weeklyBalance } from './balance.js';
import { addFocusSession, FOCUS_SESSIONS_MAX } from './focus.js';
import { circleForWeek, gratitudeSuggestions, pastParticiplePhrase, saveCircle } from './rituals.js';
import { createTask } from './tasks.js';
import type { ChoreCompletion, Circle, FocusSession, HouseholdTask, TaskAssignee } from './types.js';

const THU = new Date(2026, 9, 15, 10, 0, 0); // semaine du 12 au 18 octobre 2026
const NB = ' ';

function task(input: Parameters<typeof createTask>[0]): HouseholdTask {
  return createTask(input, '2026-10-01');
}
let seq = 0;
function done(t: HouseholdTask, day: number, assignee: TaskAssignee, doneBy?: 'a' | 'b' | 'both'): ChoreCompletion {
  seq += 1;
  const c: ChoreCompletion = {
    id: `c${seq}`,
    taskId: t.id,
    taskTitle: t.title,
    assignee,
    dueDate: `2026-10-${String(day).padStart(2, '0')}`,
    completedAt: new Date(2026, 9, day, 12, seq % 60).toISOString(),
  };
  if (doneBy) c.doneBy = doneBy;
  return c;
}

const trash = task({ id: 'trash', title: 'Sortir les poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: 1, effort: 3 });
const dishes = task({ id: 'dishes', title: 'Vaisselle', assignee: 'a', recurrence: 'daily', effort: 2 });
const plants = task({ id: 'plants', title: 'Arroser les plantes', assignee: 'a', recurrence: 'daily' });
const mail = task({ id: 'mail', title: 'Relever le courrier', assignee: 'b', recurrence: 'daily' });
const tasks = [plants, dishes, trash, mail];

describe('weeklyBalance', () => {
  it('calme sous 3 points d’effort', () => {
    expect(weeklyBalance(tasks, [done(plants, 12, 'a'), done(mail, 13, 'b')], THU)).toEqual({ a: 1, b: 1, total: 2, verdict: 'quiet' });
  });

  it('pondère par l’effort, doneBy prioritaire, ensemble = moitié, non attribuée ignorée', () => {
    const cs = [
      done(trash, 12, 'a'), // a +3
      done(dishes, 13, 'a', 'b'), // b +2
      done(dishes, 14, 'a', 'both'), // +1 / +1
      done(plants, 14, 'unassigned'), // ignoré
      done(mail, 1, 'b'), // hors semaine
    ];
    expect(weeklyBalance(tasks, cs, THU)).toEqual({ a: 4, b: 3, total: 7, verdict: 'balanced' });
  });

  it('verdict : la personne qui a porté le plus', () => {
    const cs = [done(trash, 12, 'a'), done(dishes, 13, 'a'), done(dishes, 14, 'a'), done(mail, 14, 'b')];
    expect(weeklyBalance(tasks, cs, THU).verdict).toBe('a-carried');
    const flipped = cs.map((c) => ({ ...c, doneBy: c.assignee === 'a' ? ('b' as const) : ('a' as const) }));
    expect(weeklyBalance(tasks, flipped, THU).verdict).toBe('b-carried');
  });
});

describe('rebalanceSuggestions', () => {
  it('vide si équilibré ou calme', () => {
    expect(rebalanceSuggestions(tasks, [], THU)).toEqual([]);
    expect(rebalanceSuggestions(tasks, [done(trash, 12, 'a'), done(mail, 13, 'b'), done(mail, 14, 'b'), done(mail, 15, 'b')], THU)).toEqual([]);
  });

  it('les plus lourdes d’abord : tour à tour pour les corvées, confier les petites', () => {
    const cs = [done(trash, 12, 'a'), done(dishes, 13, 'a'), done(dishes, 14, 'a'), done(plants, 14, 'a'), done(mail, 14, 'b')];
    const s = rebalanceSuggestions(tasks, cs, THU);
    expect(s.map((x) => [x.taskId, x.kind, x.to])).toEqual([
      ['trash', 'rotate', undefined],
      ['dishes', 'rotate', undefined],
      ['plants', 'reassign', 'b'],
    ]);
    expect(s[0]!.reason).toBe(`Et si «${NB}Sortir les poubelles${NB}» passait en tour à tour${NB}? Chacun son tour, sans avoir à y penser.`);
    expect(rebalanceSuggestions(tasks, cs, THU, 1)).toHaveLength(1);
    const named = rebalanceSuggestions(tasks, cs, THU, 3, { a: 'AL', b: 'AC' });
    expect(named[2]!.reason).toContain('AC pourrait prendre');
    expect(named[2]!.reason).toContain('AL');
  });

  it('ignore les tâches déjà en tour à tour et les ponctuelles', () => {
    const turning = { ...trash, rotation: true };
    const one = task({ id: 'one', title: 'Rideaux', assignee: 'a', recurrence: 'none', effort: 3 });
    const cs = [done(turning, 12, 'a'), done(one, 13, 'a'), done(dishes, 13, 'a')];
    const ids = rebalanceSuggestions([turning, one, dishes], cs, THU).map((x) => x.taskId);
    expect(ids).toEqual(['dishes']);
  });
});

describe('cercle de la semaine', () => {
  const circle = (over: Partial<Circle> = {}): Circle => ({
    id: 'k1',
    weekStart: '2026-10-12',
    heldAt: THU.toISOString(),
    gratitude: [{ from: 'a', to: 'b', text: '  Merci   pour le dîner ' }, { from: 'b', to: 'a', text: '   ' }],
    burdens: [{ who: 'b', text: 'Le linge' }],
    intentions: ['Tour à tour pour les poubelles', ''],
    ...over,
  });

  it('nettoie, remplace la même semaine, trie, retrouve par date', () => {
    const r1 = saveCircle(undefined, circle());
    expect(r1.circles[0]!.gratitude).toEqual([{ from: 'a', to: 'b', text: 'Merci pour le dîner' }]);
    expect(r1.circles[0]!.intentions).toEqual(['Tour à tour pour les poubelles']);
    const r2 = saveCircle(r1, circle({ id: 'k0', weekStart: '2026-10-05' }));
    const r3 = saveCircle(r2, circle({ id: 'k2', intentions: ['Autre'] }));
    expect(r3.circles.map((c) => c.id)).toEqual(['k0', 'k2']);
    expect(circleForWeek(r3, THU)?.id).toBe('k2');
    expect(circleForWeek(r3, '2026-10-18')?.id).toBe('k2');
    expect(circleForWeek(r3, '2026-10-19')).toBeNull();
    expect(circleForWeek(undefined, THU)).toBeNull();
  });

  it('rejette une semaine qui ne commence pas un lundi', () => {
    expect(() => saveCircle(undefined, circle({ weekStart: '2026-10-13' }))).toThrow(RangeError);
    expect(() => saveCircle(undefined, circle({ heldAt: 'hier' }))).toThrow(RangeError);
  });
});

describe('gratitudeSuggestions', () => {
  it('participes passés courants, sinon formule neutre', () => {
    expect(pastParticiplePhrase('Sortir les poubelles')).toBe('sorti les poubelles');
    expect(pastParticiplePhrase('Passer l’aspirateur')).toBe('passé l’aspirateur');
    expect(pastParticiplePhrase('Faire les courses')).toBe('fait les courses');
    expect(pastParticiplePhrase('Vaisselle')).toBeNull();
    expect(pastParticiplePhrase('S’occuper du chat')).toBeNull();
  });

  it('tirées des faits de l’autre (et ensemble), les plus lourdes d’abord', () => {
    const cs = [
      done(trash, 12, 'a', 'b'), done(trash, 13, 'a', 'b'), done(trash, 14, 'a', 'b'),
      done(dishes, 14, 'b'),
      done(plants, 15, 'a', 'both'),
      done(mail, 15, 'a'), // fait par A lui-même : pas de merci de A
    ];
    expect(gratitudeSuggestions(tasks, cs, THU, 'a')).toEqual([
      `Merci d'avoir sorti les poubelles 3${NB}fois cette semaine`,
      `Merci pour «${NB}Vaisselle${NB}» cette semaine`,
      `Merci d'avoir arrosé les plantes avec moi`,
    ]);
    // À poids égal, le plus récent d'abord.
    expect(gratitudeSuggestions(tasks, cs, THU, 'b')).toEqual([
      `Merci d'avoir relevé le courrier cette semaine`,
      `Merci d'avoir arrosé les plantes avec moi`,
    ]);
    expect(gratitudeSuggestions(tasks, [], THU, 'a')).toEqual([]);
  });
});

describe('lanternes', () => {
  const session = (id: string, over: Partial<FocusSession> = {}): FocusSession => ({
    id, startedAt: THU.toISOString(), minutes: 10, who: 'both', ...over,
  });

  it('ajout idempotent, libellé nettoyé, validation', () => {
    const r = addFocusSession(undefined, session('f1', { label: '  Rangement  ', taskId: 'dishes' }));
    expect(r.focus.sessions).toEqual([{ id: 'f1', startedAt: THU.toISOString(), minutes: 10, who: 'both', label: 'Rangement', taskId: 'dishes' }]);
    const again = addFocusSession(r.focus, session('f1'));
    expect(again).toEqual({ focus: r.focus, added: false });
    expect(Object.keys(addFocusSession(undefined, session('f2', { label: '  ' })).focus.sessions[0]!)).not.toContain('label');
    expect(() => addFocusSession(undefined, session('x', { minutes: 0 }))).toThrow(RangeError);
    expect(() => addFocusSession(undefined, session('x', { minutes: 121 }))).toThrow(RangeError);
    expect(() => addFocusSession(undefined, session('x', { who: 'c' as 'a' }))).toThrow(RangeError);
  });

  it('garde les 500 plus récentes', () => {
    let focus = { sessions: [] as FocusSession[] };
    for (let i = 0; i <= FOCUS_SESSIONS_MAX; i += 1) focus = addFocusSession(focus, session(`f${i}`)).focus;
    expect(focus.sessions).toHaveLength(FOCUS_SESSIONS_MAX);
    expect(focus.sessions[0]!.id).toBe('f1');
  });
});
