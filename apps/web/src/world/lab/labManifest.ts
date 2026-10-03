/**
 * Labo (dev seulement) : variantes du manifest pour tester le moteur.
 * - `stub`  : le manifest courant tel quel (replis : profondeur synthétique…) ;
 * - `labo`  : + profondeur et masques approximatifs (stade 6), effets peints
 *   découpés dans la planche 14, kodama découpés, source de lumière réaliste ;
 * - LUT de test générées à la volée (bande 1089×33, pixel x = r + 33·b, y = g).
 */
import { manifest } from '../manifest';
import type { LutName, WorldManifest } from '../types';
import depth6 from './assets/depth-6.png';
import masks6 from './assets/masks-6.png';
import kod1 from './assets/kodama-1.png';
import kod2 from './assets/kodama-2.png';
import kod3 from './assets/kodama-3.png';

const fxFiles = import.meta.glob('./assets/fx-*.png', { eager: true, import: 'default' }) as Record<string, string>;

function fxList(prefix: string): string[] {
  return Object.keys(fxFiles)
    .filter((k) => k.includes(`/fx-${prefix}-`))
    .sort()
    .map((k) => fxFiles[k]!);
}

export type LabData = 'stub' | 'labo';

type Grade = (r: number, g: number, b: number) => [number, number, number];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const GRADES: Record<LutName, Grade> = {
  quiet: (r, g, b) => {
    const l = luma(r, g, b);
    return [clamp(l + (r - l) * 0.75 - 0.02), clamp(l + (g - l) * 0.8), clamp(l + (b - l) * 0.85 + 0.03)];
  },
  peaceful: (r, g, b) => [r, g, b],
  lively: (r, g, b) => [clamp(r * 1.05 + 0.01), clamp(g * 1.03), clamp(b * 0.96)],
  flourishing: (r, g, b) => {
    const l = luma(r, g, b);
    return [clamp(r * 1.08 + 0.03 * l), clamp(g * 1.04 + 0.01), clamp(b * 0.9)];
  },
  night: (r, g, b) => {
    const l = luma(r, g, b);
    return [clamp(l * 0.32), clamp(l * 0.42 + 0.005), clamp(l * 0.62 + 0.02)];
  },
};

function makeLut(grade: Grade): string {
  const c = document.createElement('canvas');
  c.width = 1089;
  c.height = 33;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(1089, 33);
  for (let g = 0; g < 33; g++) {
    for (let b = 0; b < 33; b++) {
      for (let r = 0; r < 33; r++) {
        const [R, G, B] = grade(r / 32, g / 32, b / 32);
        const i = (g * 1089 + r + 33 * b) * 4;
        img.data[i] = Math.round(R * 255);
        img.data[i + 1] = Math.round(G * 255);
        img.data[i + 2] = Math.round(B * 255);
        img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

let lutCache: Record<LutName, string> | null = null;

export function labManifest(data: LabData, testLuts: boolean): WorldManifest {
  const luts = testLuts
    ? (lutCache ??= Object.fromEntries((Object.keys(GRADES) as LutName[]).map((k) => [k, makeLut(GRADES[k])])) as Record<LutName, string>)
    : manifest.luts;
  if (data === 'stub') return { ...manifest, luts };
  return {
    ...manifest,
    luts,
    stages: { ...manifest.stages, 6: { color: manifest.stages[6].color, depth: depth6 } },
    masks: masks6,
    lightSource: { x: 0.3, y: 0.0 },
    kodamaSpots: [
      { x: 0.2, y: 0.775, depth: 0.82, scale: 0.06 },
      { x: 0.86, y: 0.8, depth: 0.88, scale: 0.065 },
      { x: 0.33, y: 0.645, depth: 0.62, scale: 0.042 },
      { x: 0.72, y: 0.69, depth: 0.66, scale: 0.04 },
    ],
    sprites: { ...manifest.sprites, kodama: [kod1, kod2, kod3], creatures: { 'lab-creature': kod3 } },
    // Créature de test (chemin de code des créatures débloquées).
    creatureSpots: { 'lab-creature': { x: 0.58, y: 0.79, depth: 0.78, scale: 0.035 } },
    fx: {
      fog: fxList('fog'),
      rays: fxList('rays'),
      drips: fxList('drips'),
      needles: fxList('needles'),
      motes: fxList('motes'),
      halos: fxList('halos'),
    },
  };
}
