/**
 * Bruits précalculés (CPU, une fois) et petits hachages déterministes.
 * La texture de bruit est périodique (REPEAT) : 4 canaux indépendants.
 *   R = fbm basse fréquence (nappes de brume larges)
 *   G = fbm moyenne fréquence (brume fine, vent)
 *   B = bruit de valeur haute fréquence (poussières, scintillements, dissolution)
 *   A = fbm « cellulaire » adouci (dissolution organique, rayons)
 */

/** FNV-1a 32 bits : identifiant → entier stable. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(period: number, rand: () => number): Float32Array {
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return g;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Bruit de valeur périodique échantillonné sur une grille size×size. */
function valueLayer(size: number, period: number, rand: () => number, out: Float32Array, weight: number) {
  const g = lattice(period, rand);
  const step = period / size;
  for (let y = 0; y < size; y++) {
    const fy = y * step;
    const y0 = Math.floor(fy) % period;
    const y1 = (y0 + 1) % period;
    const ty = fade(fy - Math.floor(fy));
    for (let x = 0; x < size; x++) {
      const fx = x * step;
      const x0 = Math.floor(fx) % period;
      const x1 = (x0 + 1) % period;
      const tx = fade(fx - Math.floor(fx));
      const a = g[y0 * period + x0]!;
      const b = g[y0 * period + x1]!;
      const c = g[y1 * period + x0]!;
      const d = g[y1 * period + x1]!;
      const top = a + (b - a) * tx;
      const bot = c + (d - c) * tx;
      out[y * size + x]! += (top + (bot - top) * ty) * weight;
    }
  }
}

function fbm(size: number, basePeriod: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  const rand = rng(seed);
  let w = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const p = Math.min(size, basePeriod << o);
    valueLayer(size, p, rand, out, w);
    total += w;
    w *= 0.5;
  }
  // Normalise sur 0..1 avec un léger étirement de contraste.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < out.length; i++) {
    const v = out[i]! / total;
    out[i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const k = 1 / Math.max(1e-6, hi - lo);
  for (let i = 0; i < out.length; i++) out[i] = (out[i]! - lo) * k;
  return out;
}

/** Texture de bruit RGBA 8 bits, périodique. */
export function makeNoiseData(size = 256): Uint8Array {
  const r = fbm(size, 4, 5, 11);
  const g = fbm(size, 8, 4, 23);
  const b = fbm(size, 64, 2, 37);
  const a = fbm(size, 6, 5, 51);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round(r[i]! * 255);
    data[i * 4 + 1] = Math.round(g[i]! * 255);
    data[i * 4 + 2] = Math.round(b[i]! * 255);
    // Crêtes adoucies : dissolution « organique » (filaments, pas de pixels).
    const av = 1 - Math.abs(a[i]! * 2 - 1);
    data[i * 4 + 3] = Math.round(Math.pow(av, 0.8) * 255);
  }
  return data;
}
