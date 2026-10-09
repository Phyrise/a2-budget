import { describe, expect, it } from 'vitest';
import {
  COMPANION_IDS,
  applySettingsToMonth,
  companionOf,
  companionsOf,
  createMonthRecord,
  defaultCompanion,
  defaultSettings,
  emptyAppState,
  emptyState,
  ensureMonth,
  isCompanionId,
  migrateState,
  validatePersistedState,
} from './index.js';
import type { CompanionId, Settings } from './index.js';

function withCompanions(a?: unknown, b?: unknown): Settings {
  const s = defaultSettings();
  if (a !== undefined) (s.personA as unknown as Record<string, unknown>).companion = a;
  if (b !== undefined) (s.personB as unknown as Record<string, unknown>).companion = b;
  return s;
}

describe('compagnons (V5.6)', () => {
  it('quatre compagnons, dans l’ordre du sélecteur', () => {
    expect(COMPANION_IDS).toEqual(['jiji', 'calcifer', 'teto', 'hin']);
    expect(isCompanionId('teto')).toBe(true);
    expect(isCompanionId('ponyo')).toBe(false);
    expect(isCompanionId(undefined)).toBe(false);
  });

  it('défaut du rôle quand rien n’est choisi : A → Jiji, B → Calcifer', () => {
    expect(defaultCompanion('a')).toBe('jiji');
    expect(defaultCompanion('b')).toBe('calcifer');
    expect(companionsOf(defaultSettings())).toEqual({ a: 'jiji', b: 'calcifer' });
    expect(companionsOf(null)).toEqual({ a: 'jiji', b: 'calcifer' });
  });

  it('lit le choix de chacun', () => {
    const s = withCompanions('teto', 'hin');
    expect(companionOf(s, 'a')).toBe('teto');
    expect(companionOf(s, 'b')).toBe('hin');
    // Échange des compagnons par défaut : permis.
    expect(companionsOf(withCompanions('calcifer', 'jiji'))).toEqual({ a: 'calcifer', b: 'jiji' });
  });

  it('lecture tolérante : inconnu → défaut du rôle', () => {
    expect(companionsOf(withCompanions('ponyo', 42))).toEqual({ a: 'jiji', b: 'calcifer' });
  });

  it('anti-doublon : A garde le sien, B reprend son défaut s’il est libre', () => {
    expect(companionsOf(withCompanions('teto', 'teto'))).toEqual({ a: 'teto', b: 'calcifer' });
    expect(companionsOf(withCompanions('hin', 'hin'))).toEqual({ a: 'hin', b: 'calcifer' });
  });

  it('anti-doublon : sinon le premier libre', () => {
    // A a pris Calcifer, B aussi : défaut de B pris → premier libre (Jiji).
    expect(companionsOf(withCompanions('calcifer', 'calcifer'))).toEqual({ a: 'calcifer', b: 'jiji' });
    // A a pris Calcifer, B sans choix → même cas.
    expect(companionsOf(withCompanions('calcifer'))).toEqual({ a: 'calcifer', b: 'jiji' });
    // B a choisi Jiji, A sans choix (Jiji par défaut) → B reprend Calcifer.
    expect(companionsOf(withCompanions(undefined, 'jiji'))).toEqual({ a: 'jiji', b: 'calcifer' });
  });

  it('jamais le même compagnon, quelles que soient les données', () => {
    const vals: (CompanionId | undefined)[] = [undefined, ...COMPANION_IDS];
    for (const a of vals) {
      for (const b of vals) {
        const r = companionsOf(withCompanions(a, b));
        expect(r.a).not.toBe(r.b);
        expect(r.a).toBe(a ?? 'jiji');
      }
    }
  });

  it('validation : le choix est conservé, l’inconnu est retiré sans rendre l’état illisible', () => {
    const state = emptyState();
    state.settings = withCompanions('hin', 'ponyo');
    const r = validatePersistedState(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.settings.personA.companion).toBe('hin');
    expect('companion' in r.state.settings.personB).toBe(false);
  });

  it('les anciens états sans compagnon restent valides', () => {
    const app = emptyAppState();
    const r = migrateState(JSON.parse(JSON.stringify(app)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.budget.settings.personA.companion).toBeUndefined();
    expect(companionsOf(r.state.budget.settings)).toEqual({ a: 'jiji', b: 'calcifer' });
  });

  it('état V2 : le choix survit à la validation (export / import)', () => {
    const app = emptyAppState();
    app.budget.settings.personA.companion = 'teto';
    app.budget.settings.personB.companion = 'hin';
    const r = migrateState(JSON.parse(JSON.stringify(app)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toEqual(app);
  });

  it('les copies par mois ne portent pas le compagnon', () => {
    const s = withCompanions('teto', 'hin');
    const m = createMonthRecord('2026-10', s);
    expect('companion' in m.personA).toBe(false);
    expect('companion' in m.personB).toBe(false);
    let state = ensureMonth({ ...emptyState(), settings: s }, '2026-10');
    state = applySettingsToMonth(state, '2026-10');
    expect('companion' in state.months[0]!.personA).toBe(false);
  });
});
