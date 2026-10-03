/**
 * Atlas des effets peints (manifest.fx) : toutes les petites textures sur fond
 * noir regroupées dans une seule texture (une liaison, un lot instancié).
 */
import type { WorldManifest } from '../types';
import type { Rect } from './batch';
import { decodeImage, imageSize, releaseImage, type Decoded } from './loader';

export type FxKey = 'fog' | 'rays' | 'drips' | 'needles' | 'motes' | 'halos';

export interface FxPiece {
  rect: Rect;
  /** Rapport largeur / hauteur de la pièce. */
  aspect: number;
}

export type FxAtlasMap = Record<FxKey, FxPiece[]>;

const MAX_DIM: Record<FxKey, number> = { fog: 640, rays: 512, drips: 128, needles: 192, motes: 96, halos: 256 };
const ATLAS_W = 2048;
const PAD = 2;

export async function buildFxAtlas(fx: NonNullable<WorldManifest['fx']>): Promise<{ canvas: HTMLCanvasElement; map: FxAtlasMap } | null> {
  const keys = Object.keys(fx) as FxKey[];
  const jobs: { key: FxKey; img: Decoded; w: number; h: number }[] = [];
  await Promise.all(
    keys.flatMap((key) =>
      (fx[key] ?? []).map(async (url) => {
        try {
          const img = await decodeImage(url, { kind: 'sprite' });
          const s = imageSize(img);
          const k = Math.min(1, MAX_DIM[key] / Math.max(s.w, s.h));
          jobs.push({ key, img, w: Math.max(4, Math.round(s.w * k)), h: Math.max(4, Math.round(s.h * k)) });
        } catch {
          /* pièce manquante : ignorée */
        }
      }),
    ),
  );
  if (jobs.length === 0) return null;
  // Ordre stable (par clé puis taille) pour un rangement reproductible.
  jobs.sort((a, b) => (a.key === b.key ? b.h - a.h : a.key.localeCompare(b.key)));
  const placed: { job: (typeof jobs)[number]; x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let row = 0;
  for (const job of [...jobs].sort((a, b) => b.h - a.h)) {
    if (x + job.w + PAD > ATLAS_W) {
      x = 0;
      y += row + PAD;
      row = 0;
    }
    placed.push({ job, x, y });
    x += job.w + PAD;
    row = Math.max(row, job.h);
  }
  const height = Math.min(4096, 1 << Math.ceil(Math.log2(Math.max(64, y + row))));
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ATLAS_W, height);
  const map: FxAtlasMap = { fog: [], rays: [], drips: [], needles: [], motes: [], halos: [] };
  for (const job of jobs) {
    const p = placed.find((q) => q.job === job)!;
    ctx.drawImage(job.img as CanvasImageSource, p.x, p.y, job.w, job.h);
    // Demi-texel de marge : pas de fuite des voisins au filtrage linéaire.
    map[job.key].push({
      rect: [(p.x + 0.5) / ATLAS_W, (p.y + 0.5) / height, (job.w - 1) / ATLAS_W, (job.h - 1) / height],
      aspect: job.w / job.h,
    });
    releaseImage(job.img);
  }
  return { canvas, map };
}
