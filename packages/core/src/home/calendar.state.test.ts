import { describe, expect, it } from 'vitest';
import { emptyAppState, migrateState, validateAppState } from './appState.js';
import { addEvent } from './calendar.js';
import type { AppState } from './types.js';

const AT = '2026-10-05T08:00:00.000Z';

describe('AppState.calendar (rétrocompatible, schemaVersion 2)', () => {
  it('un état sans calendrier se recharge à l’identique (pas de champ inventé)', () => {
    const state = emptyAppState();
    const r = validateAppState(JSON.parse(JSON.stringify(state)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state).toEqual(state);
      expect('calendar' in r.state).toBe(false);
    }
  });

  it('un calendrier valide survit à un aller-retour JSON', () => {
    const base = emptyAppState();
    const first = addEvent([], { id: 'e1', createdAt: AT, title: 'Dîner', date: '2026-10-10', time: '20:00', kind: 'repas' });
    if (!first.ok) throw new Error(first.reason);
    const second = addEvent(first.events, { id: 'e2', createdAt: AT, title: 'Anniversaire d’AC', date: '1994-02-28', kind: 'anniversaire', who: 'b' });
    if (!second.ok) throw new Error(second.reason);
    const state: AppState = { ...base, calendar: { events: second.events } };
    const raw = JSON.parse(JSON.stringify(state));
    const r = migrateState(raw);
    expect(r).toEqual({ ok: true, state });
  });

  it('calendar: null est toléré et omis ; un calendrier invalide est refusé avec une raison stable', () => {
    const base = emptyAppState();
    const nullCal = validateAppState({ ...JSON.parse(JSON.stringify(base)), calendar: null });
    expect(nullCal).toEqual({ ok: true, state: base });
    const bad = validateAppState({ ...JSON.parse(JSON.stringify(base)), calendar: { events: [{ id: 'x' }] } });
    expect(bad).toEqual({ ok: false, reason: 'calendar-event-invalid-title' });
  });
});
