import { describe, expect, it } from 'vitest';
import { manifest } from '../world/manifest';
import type { CompanionMood } from '../world/types';
import { COMPANIONS, COMPANION_IDS, companionProfile } from './companions';

const POSES: readonly CompanionMood[] = ['idle', 'happy', 'proud', 'sleepy', 'curious'];

describe('registre des compagnons (V5.6)', () => {
  it('un profil complet pour chacun des quatre', () => {
    expect(Object.keys(COMPANIONS).sort()).toEqual([...COMPANION_IDS].sort());
    for (const id of COMPANION_IDS) {
      const p = companionProfile(id);
      expect(p.id).toBe(id);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.touchLabel).toContain(p.name);
      expect(POSES).toContain(p.pokeMoods.poke);
      expect(POSES).toContain(p.pokeMoods.upset);
      expect(POSES).toContain(p.caressMood);
      expect(['trot', 'float', 'scurry', 'waddle']).toContain(p.gait);
    }
  });

  it('cinq poses peintes chacun, un fichier propre à chaque compagnon', () => {
    for (const id of COMPANION_IDS) {
      const set = manifest.companions[id];
      for (const mood of POSES) {
        expect(set[mood], `${id}-${mood}`).toMatch(new RegExp(`${id}-${mood}`));
      }
    }
  });

  it('Jiji et Calcifer gardent leurs réactions et leurs sons', () => {
    expect(COMPANIONS.jiji).toMatchObject({ touchLabel: 'Caresser Jiji', pokeMoods: { poke: 'curious', upset: 'idle' }, gait: 'trot' });
    expect(COMPANIONS.jiji.sounds).toEqual({ caress: 'purr' });
    expect(COMPANIONS.calcifer).toMatchObject({ touchLabel: 'Taquiner Calcifer', pokeMoods: { poke: 'happy', upset: 'proud' }, gait: 'float' });
    expect(COMPANIONS.calcifer.sounds).toEqual({ poke: 'crackle', upset: 'grumble', caress: 'crackle' });
  });

  it('Teto file, Hin se dandine ; leurs sons restent à écrire', () => {
    expect(COMPANIONS.teto).toMatchObject({ name: 'Teto', touchLabel: 'Caresser Teto', pokeMoods: { poke: 'curious', upset: 'idle' }, gait: 'scurry' });
    expect(COMPANIONS.hin).toMatchObject({ name: 'Hin', touchLabel: 'Caresser Hin', pokeMoods: { poke: 'happy', upset: 'sleepy' }, gait: 'waddle' });
  });
});
