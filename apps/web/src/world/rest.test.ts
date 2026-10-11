import { describe, expect, it } from 'vitest';
import { REST_DELAYS, forestRest } from './rest';

const phone = { desktop: false, forestShown: true, pageVisible: true };

describe('forestRest', () => {
  it('téléphone, Maison visible : la forêt dessine et garde sa mémoire', () => {
    expect(forestRest(phone)).toEqual({ draw: true, releaseMs: null });
  });

  it('téléphone, autre onglet : plus aucune image, libérée après ≈ 60 s', () => {
    expect(forestRest({ ...phone, forestShown: false })).toEqual({ draw: false, releaseMs: 60_000 });
  });

  it('téléphone, arrière-plan (Maison ou autre onglet) : libérée après ≈ 30 s', () => {
    expect(forestRest({ ...phone, pageVisible: false })).toEqual({ draw: false, releaseMs: 30_000 });
    expect(forestRest({ ...phone, forestShown: false, pageVisible: false })).toEqual({ draw: false, releaseMs: 30_000 });
  });

  it('ordinateur : inchangé, quels que soient onglet et visibilité', () => {
    for (const forestShown of [true, false])
      for (const pageVisible of [true, false]) expect(forestRest({ desktop: true, forestShown, pageVisible })).toEqual({ draw: true, releaseMs: null });
  });

  it('délais injectables (build e2e)', () => {
    const d = { covered: 1500, background: 800 };
    expect(forestRest({ ...phone, forestShown: false }, d).releaseMs).toBe(1500);
    expect(forestRest({ ...phone, pageVisible: false }, d).releaseMs).toBe(800);
    expect(REST_DELAYS).toEqual({ covered: 60_000, background: 30_000 });
  });
});
