import { LANTERNS, addFocusSession, emptyAppState, type AppState } from '@a2/core';
import { describe, expect, it } from 'vitest';
import { applyPreview, lanternModelOf, toWorldState } from './worldState';

const NOW = new Date('2026-10-06T10:00:00');

function withSessions(n: number): AppState {
  const s = emptyAppState();
  let focus = s.focus;
  for (let i = 0; i < n; i++) {
    focus = addFocusSession(focus, { id: `f${i}`, startedAt: '2026-10-05T09:00:00.000Z', minutes: 10, who: 'a' }).focus;
  }
  return { ...s, focus };
}

describe('worldState — modèle de lanterne de pierre', () => {
  it('par défaut, la lanterne de base (kasuga-moss)', () => {
    const s = emptyAppState();
    expect(lanternModelOf(s)).toBe('kasuga-moss');
    expect(toWorldState(s, NOW).lantern?.id).toBe('kasuga-moss');
  });

  it('le modèle choisi et débloqué est posé dans la forêt', () => {
    const second = LANTERNS[1]!;
    const s = withSessions(second.unlockAt);
    const chosen: AppState = { ...s, focus: { sessions: s.focus?.sessions ?? [], selectedLantern: second.id } };
    expect(toWorldState(chosen, NOW).lantern?.id).toBe(second.id);
  });

  it('un choix encore verrouillé retombe sur la lanterne de base', () => {
    const last = LANTERNS[LANTERNS.length - 1]!;
    const s = withSessions(1);
    const chosen: AppState = { ...s, focus: { sessions: s.focus?.sessions ?? [], selectedLantern: last.id } };
    expect(toWorldState(chosen, NOW).lantern?.id).toBe('kasuga-moss');
  });

  it("l'aperçu du mode développeur montre un autre modèle connu, ignore un id inconnu", () => {
    const base = toWorldState(emptyAppState(), NOW);
    const last = LANTERNS[LANTERNS.length - 1]!;
    expect(applyPreview(base, { lanternModel: last.id }).lantern?.id).toBe(last.id);
    expect(applyPreview(base, { lanternModel: 'lanterne-inconnue' }).lantern?.id).toBe('kasuga-moss');
    expect(applyPreview(base, null)).toBe(base);
  });
});
