/**
 * Manifest des assets du monde — VERSION PROVISOIRE (stub).
 *
 * Le pipeline d'assets (art/pipeline) régénère ce fichier avec les vraies
 * couches (profondeur, masques, LUT, sprites détourés). Ce stub ne sert qu'à
 * développer le moteur et les écrans en parallèle : pas de profondeur, pas de
 * masques, LUT identité, sprites manquants remplacés par des planches.
 */
import type { WorldManifest } from './types';

import master from './assets/stub/01-master-portrait.jpg';
import landscape from './assets/stub/02-master-landscape.jpg';
import g0 from './assets/stub/05-growth-0.jpg';
import g1 from './assets/stub/05-growth-1.jpg';
import g2 from './assets/stub/05-growth-2.jpg';
import g3 from './assets/stub/05-growth-3.jpg';
import g4 from './assets/stub/05-growth-4.jpg';
import g6 from './assets/stub/05-growth-6.jpg';
import night from './assets/stub/04-pause-night.jpg';
import fg from './assets/stub/07-foreground-frame.png';
import guardian from './assets/stub/11-guardian-isolated.png';
import kodamaSheet from './assets/stub/08-kodama-sheet.png';
import placeholder from './assets/stub/placeholder.jpg';

const stage = (color: string) => ({ color, depth: null });

export const manifest: WorldManifest = {
  size: { w: 1024, h: 1536 },
  stages: { 1: stage(g0), 2: stage(g1), 3: stage(g2), 4: stage(g3), 5: stage(g4), 6: stage(master), 7: stage(g6) },
  masks: null,
  foreground: fg,
  luts: { quiet: null, peaceful: null, lively: null, flourishing: null, night: null },
  anchors: [
    { x: 0.18, y: 0.78, depth: 0.8 },
    { x: 0.36, y: 0.7, depth: 0.65 },
    { x: 0.52, y: 0.62, depth: 0.55 },
    { x: 0.66, y: 0.71, depth: 0.66 },
    { x: 0.82, y: 0.8, depth: 0.82 },
    { x: 0.44, y: 0.84, depth: 0.88 },
    { x: 0.6, y: 0.88, depth: 0.92 },
    { x: 0.27, y: 0.9, depth: 0.93 },
  ],
  kodamaSpots: [
    { x: 0.22, y: 0.62, depth: 0.6, scale: 0.05 },
    { x: 0.74, y: 0.66, depth: 0.62, scale: 0.05 },
    { x: 0.5, y: 0.45, depth: 0.45, scale: 0.035 },
  ],
  creatureSpots: {},
  lightSource: { x: 0.62, y: 0.02 },
  guardianSpot: { x: 0.3, y: 0.6, depth: 0.35, scale: 0.42 },
  sprites: { kodama: [kodamaSheet], creatures: {}, guardian },
  companions: {
    a: { idle: '', happy: '', proud: '', sleepy: '', curious: '' },
    b: { idle: '', happy: '', proud: '', sleepy: '', curious: '' },
  },
  fx: null,
  banners: { budget: landscape, courses: night },
  placeholder,
};
