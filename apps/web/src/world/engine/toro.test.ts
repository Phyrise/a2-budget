import { describe, expect, it } from 'vitest';
import { LANTERNS } from '@a2/core';
import { LANTERN_ART } from '../../themes/lanterns';
import { computeFraming } from './framing';
import { DEFAULT_LANTERN, LANTERN_GROUND, LANTERN_HEIGHT, VISIT, clearOfLantern, lanternGeometry, visitFrame } from './toro';

const ASPECT = 1024 / 1536;

describe('lanternGeometry', () => {
  it('pose le pied de la toile au sol, le foyer et le toit dans la pierre', () => {
    const art = LANTERN_ART['kasuga-moss'];
    const g = lanternGeometry(art, ASPECT);
    expect(g.h).toBeCloseTo(LANTERN_HEIGHT * art.scale, 6);
    expect(g.ground).toEqual(LANTERN_GROUND);
    expect(g.fire.y).toBeCloseTo(LANTERN_GROUND.y - (1 - art.fire.y) * g.h, 6);
    expect(g.roof.y).toBeLessThan(g.fire.y);
    expect(g.roof.x).toBeGreaterThan(LANTERN_GROUND.x);
  });

  it('garde les tailles relatives des modèles (même échelle de planche)', () => {
    const small = lanternGeometry(LANTERN_ART.yukimi, ASPECT);
    const big = lanternGeometry(LANTERN_ART['spirit-light'], ASPECT);
    expect(big.h).toBeCloseTo(LANTERN_HEIGHT, 6);
    expect(small.h).toBeLessThan(big.h);
  });

  it('chaque modèle du catalogue a ses peintures ; la lanterne par défaut est celle du domaine', () => {
    for (const l of LANTERNS) expect(LANTERN_ART[l.id as keyof typeof LANTERN_ART]).toBeDefined();
    expect(LANTERNS.find((l) => l.unlockAt === 0)?.id).toBe(DEFAULT_LANTERN);
  });

  it('390×844 : la plus haute lanterne tient entière au-dessus de la feuille', () => {
    // Héros mobile : canvas 528 px (54svh + 72), feuille à 456 px.
    const f = computeFraming(390, 528, 1024, 1536);
    const toY = (y: number) => ((y - f.cy) / f.vh + 0.5) * 528;
    for (const id of Object.keys(LANTERN_ART) as (keyof typeof LANTERN_ART)[]) {
      const g = lanternGeometry(LANTERN_ART[id], ASPECT);
      expect(toY(g.ground.y)).toBeLessThan(456 - 20);
      expect(toY(g.ground.y - g.h)).toBeGreaterThan(150);
    }
  });
});

describe('visitFrame (kodama sur le toit)', () => {
  it('arrive en fondu avec un petit bond, reste, repart en fondu', () => {
    expect(visitFrame(10, 30, 9).vis).toBe(0);
    const mid = visitFrame(10, 30, 10 + VISIT.fade / 2);
    expect(mid.vis).toBeGreaterThan(0.3);
    expect(mid.hop).toBeGreaterThan(0);
    expect(visitFrame(10, 30, 20)).toEqual({ vis: 1, hop: 0 });
    const leaving = visitFrame(10, 30, 30 + VISIT.fade / 2);
    expect(leaving.vis).toBeLessThan(1);
    expect(leaving.hop).toBeLessThan(0);
    expect(visitFrame(10, 30, 30 + VISIT.fade + 0.01).vis).toBe(0);
  });
});

describe('clearOfLantern', () => {
  it('écarte un kodama posé dans la pierre, laisse les autres en place', () => {
    const inStone = { x: LANTERN_GROUND.x - 0.01, y: LANTERN_GROUND.y - 0.03, depth: 0.2, scale: 0.048 };
    const away = { x: 0.2, y: 0.5, depth: 0.1, scale: 0.05 };
    const [moved, kept] = clearOfLantern([inStone, away], ASPECT);
    expect(kept).toBe(away);
    expect(moved!.x).toBeLessThan(inStone.x);
    expect(moved!.y).toBe(inStone.y);
    // Une fois écarté, il ne chevauche plus : un second passage ne le bouge plus.
    expect(clearOfLantern([moved!], ASPECT)[0]).toBe(moved);
  });
});
