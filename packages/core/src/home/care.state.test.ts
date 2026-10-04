import { describe, expect, it } from 'vitest';
import { emptyAppState, migrateState, validateAppState } from './appState.js';
import { toggleTaskToday } from './choreActions.js';
import { addFocusSession } from './focus.js';
import { saveCircle } from './rituals.js';
import { skipOccurrence } from './skips.js';
import { createTask } from './tasks.js';
import type { AppState } from './types.js';

const THU = new Date(2026, 9, 15, 10, 0, 0);

function roundTrip(state: unknown): ReturnType<typeof validateAppState> {
  return validateAppState(JSON.parse(JSON.stringify(state)));
}

/** État V3 complet et cohérent, construit uniquement via l'API du domaine. */
function careState(): AppState {
  let s = emptyAppState();
  s.chores.tasks = [
    createTask({ id: 'flex', title: 'Lessive', assignee: 'a', recurrence: 'weekly', weeklyDay: 6, flexible: true, effort: 2 }, '2026-10-01'),
    createTask({ id: 'turn', title: 'Vaisselle', assignee: 'b', recurrence: 'daily', rotation: true }, '2026-10-01'),
    createTask({ id: 'fixed', title: 'Poubelles', assignee: 'a', recurrence: 'weekly', weeklyDay: 4, effort: 3 }, '2026-10-01'),
  ];
  s = toggleTaskToday(s, 'flex', THU, 'c1', { doneBy: 'both' }).state;
  s = toggleTaskToday(s, 'turn', THU, 'c2', { doneBy: 'a' }).state;
  s.chores.skips = skipOccurrence(s.chores.skips, { id: 's1', taskId: 'fixed', dueDate: '2026-10-15', at: THU.toISOString(), by: 'a' }).skips;
  s.rituals = saveCircle(s.rituals, {
    id: 'k1', weekStart: '2026-10-12', heldAt: THU.toISOString(),
    gratitude: [{ from: 'a', to: 'b', text: 'Merci pour la vaisselle' }],
    burdens: [{ who: 'b', text: 'Le linge' }],
    intentions: ['Lessive ensemble samedi'],
  });
  s.focus = addFocusSession(s.focus, { id: 'f1', startedAt: THU.toISOString(), minutes: 10, who: 'a', label: 'Rangement' }).focus;
  return s;
}

describe('validateAppState — champs V3', () => {
  it('un état V3 complet se recharge à l’identique', () => {
    const s = careState();
    const r = roundTrip(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.state)).toBe(JSON.stringify(s));
  });

  it('un JSON V2 sans champs V3 ressort sans champs inventés', () => {
    const s = emptyAppState();
    s.chores.tasks = [createTask({ id: 't', title: 'X', assignee: 'a', recurrence: 'daily' }, '2026-10-01')];
    const r = migrateState(JSON.parse(JSON.stringify(s)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('rituals' in r.state).toBe(false);
    expect('focus' in r.state).toBe(false);
    expect('skips' in r.state.chores).toBe(false);
    expect(JSON.stringify(r.state)).toBe(JSON.stringify(s));
  });

  it('les booléens à false présents sont conservés tels quels', () => {
    const s = JSON.parse(JSON.stringify(emptyAppState()));
    s.chores.tasks = [{ id: 't', title: 'X', assignee: 'both', recurrence: 'daily', createdAt: '2026-10-01', rotation: false, flexible: false }];
    const r = validateAppState(s);
    expect(r.ok && r.state.chores.tasks[0]).toMatchObject({ rotation: false, flexible: false });
  });

  it.each([
    ['task-invalid-effort', (s: any) => { s.chores.tasks[0].effort = 5; }],
    ['task-rotation-requires-person', (s: any) => { s.chores.tasks[1].assignee = 'both'; }],
    ['task-invalid-rotation', (s: any) => { s.chores.tasks[1].rotation = 'oui'; }],
    ['task-flexible-requires-weekly', (s: any) => { s.chores.tasks[0].recurrence = 'daily'; delete s.chores.tasks[0].weeklyDay; }],
    ['completion-invalid-done-by', (s: any) => { s.chores.completions[0].doneBy = 'unassigned'; }],
    ['skips-not-array', (s: any) => { s.chores.skips = {}; }],
    ['duplicate-skip-occurrence', (s: any) => { s.chores.skips.push({ ...s.chores.skips[0], id: 's2' }); }],
    ['skip-invalid-by', (s: any) => { s.chores.skips[0].by = 'both'; }],
    ['skip-invalid-at', (s: any) => { s.chores.skips[0].at = 'hier'; }],
    ['rituals-circles-not-array', (s: any) => { s.rituals = {}; }],
    ['circle-invalid-week-start', (s: any) => { s.rituals.circles[0].weekStart = '2026-10-13'; }],
    ['circle-invalid-gratitude', (s: any) => { s.rituals.circles[0].gratitude[0].to = 'c'; }],
    ['duplicate-circle-week', (s: any) => { s.rituals.circles.push({ ...s.rituals.circles[0], id: 'k2' }); }],
    ['focus-invalid-minutes', (s: any) => { s.focus.sessions[0].minutes = 0; }],
    ['focus-invalid-who', (s: any) => { s.focus.sessions[0].who = 'unassigned'; }],
    ['duplicate-focus-id', (s: any) => { s.focus.sessions.push({ ...s.focus.sessions[0] }); }],
  ])('%s', (reason, mutate) => {
    const s = JSON.parse(JSON.stringify(careState()));
    mutate(s);
    expect(validateAppState(s)).toEqual({ ok: false, reason });
  });

  it('null pour un bloc optionnel = absent', () => {
    const s = JSON.parse(JSON.stringify(careState()));
    s.rituals = null;
    s.focus = null;
    s.chores.skips = null;
    const r = validateAppState(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect('rituals' in r.state || 'focus' in r.state || 'skips' in r.state.chores).toBe(false);
  });
});
