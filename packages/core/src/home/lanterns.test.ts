import { describe, expect, it } from 'vitest';
import { addFocusSession } from './focus.js';
import {
  activeLantern,
  DEFAULT_LANTERN_ID,
  isLanternId,
  isLanternUnlocked,
  LANTERNS,
  nextLantern,
  selectLantern,
  unlockedLanterns,
} from './lanterns.js';
import { validateFocus } from './careValidation.js';
import type { FocusState } from './types.js';

function withSessions(n: number): FocusState {
  let focus: FocusState | undefined;
  for (let i = 0; i < n; i++) {
    focus = addFocusSession(focus, { id: `f${i}`, startedAt: '2026-10-05T08:00:00.000Z', minutes: 10, who: 'a' }).focus;
  }
  return focus ?? { sessions: [] };
}

describe('catalogue des lanternes de pierre', () => {
  it('7 modèles, seuils croissants, la base à 0', () => {
    expect(LANTERNS.map((l) => [l.id, l.unlockAt])).toEqual([
      ['kasuga-moss', 0],
      ['yukimi', 3],
      ['oribe', 8],
      ['kotoji', 15],
      ['tachi-carved', 25],
      ['ancient-shrine', 40],
      ['spirit-light', 60],
    ]);
    expect(DEFAULT_LANTERN_ID).toBe('kasuga-moss');
    expect(isLanternId('oribe')).toBe(true);
    expect(isLanternId('pagode')).toBe(false);
  });

  it('déblocage selon le nombre de sessions terminées', () => {
    expect(unlockedLanterns(undefined).map((l) => l.id)).toEqual(['kasuga-moss']);
    expect(unlockedLanterns(withSessions(2)).map((l) => l.id)).toEqual(['kasuga-moss']);
    expect(unlockedLanterns(withSessions(3)).map((l) => l.id)).toEqual(['kasuga-moss', 'yukimi']);
    expect(unlockedLanterns(withSessions(8).sessions)).toHaveLength(3);
    expect(unlockedLanterns(withSessions(60))).toHaveLength(7);
    expect(nextLantern(withSessions(3))).toEqual({ id: 'oribe', unlockAt: 8 });
    expect(nextLantern(withSessions(60))).toBeNull();
  });
});

describe('choix de la lanterne posée dans la forêt', () => {
  it('par défaut : la lanterne de base', () => {
    expect(activeLantern(undefined)).toBe('kasuga-moss');
    expect(activeLantern({ sessions: [] })).toBe('kasuga-moss');
  });

  it('choisir une lanterne débloquée', () => {
    const focus = withSessions(3);
    const r = selectLantern(focus, 'yukimi');
    expect(r.changed).toBe(true);
    expect(r.focus!.selectedLantern).toBe('yukimi');
    expect(r.focus!.sessions).toBe(focus.sessions);
    expect(activeLantern(r.focus)).toBe('yukimi');
    expect(selectLantern(r.focus, 'yukimi')).toEqual({ focus: r.focus, changed: false });
  });

  it('verrouillée ou inconnue → refusée, même référence', () => {
    const focus = withSessions(3);
    expect(selectLantern(focus, 'oribe')).toEqual({ focus, changed: false });
    expect(selectLantern(focus, 'pagode')).toEqual({ focus, changed: false });
    expect(isLanternUnlocked(focus, 'oribe')).toBe(false);
  });

  it('sans aucune session, la base peut être choisie explicitement', () => {
    const r = selectLantern(undefined, 'kasuga-moss');
    expect(r).toEqual({ focus: { sessions: [], selectedLantern: 'kasuga-moss' }, changed: true });
  });

  it('une nouvelle session garde le choix', () => {
    const chosen = selectLantern(withSessions(3), 'yukimi').focus;
    const next = addFocusSession(chosen, { id: 'n', startedAt: '2026-10-05T09:00:00.000Z', minutes: 5, who: 'b' }).focus;
    expect(next.selectedLantern).toBe('yukimi');
    expect(next.sessions).toHaveLength(4);
  });
});

describe('validation de selectedLantern', () => {
  it('débloquée → gardée ; absente → omise', () => {
    const focus = { ...withSessions(8), selectedLantern: 'oribe' };
    expect(validateFocus(JSON.parse(JSON.stringify(focus)))).toEqual({ ok: true, state: focus });
    const r = validateFocus({ sessions: [] });
    expect(r.ok && 'selectedLantern' in r.state).toBe(false);
  });

  it('verrouillée ou inconnue → ignorée (jamais illisible)', () => {
    const locked = validateFocus({ ...withSessions(2), selectedLantern: 'yukimi' });
    expect(locked.ok && 'selectedLantern' in locked.state).toBe(false);
    const unknown = validateFocus({ sessions: [], selectedLantern: 'pagode' });
    expect(unknown.ok && 'selectedLantern' in unknown.state).toBe(false);
  });

  it('mauvais type → raison stable', () => {
    expect(validateFocus({ sessions: [], selectedLantern: 3 })).toEqual({ ok: false, reason: 'focus-invalid-selected-lantern' });
  });
});
