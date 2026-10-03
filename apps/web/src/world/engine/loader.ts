/**
 * Chargement des images hors fil principal (createImageBitmap) avec repli
 * <img>.decode(). Les données (profondeur, masques, LUT) sont décodées sans
 * prémultiplication ni conversion colorimétrique ; les sprites sont
 * prémultipliés (filtrage correct des bords détourés).
 */

export type Decoded = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export type DecodeKind = 'color' | 'data' | 'sprite';

export interface DecodeOptions {
  kind: DecodeKind;
  /** Redimensionne au décodage (économie de mémoire GPU). */
  maxWidth?: number;
}

const cache = new Map<string, Promise<Blob>>();

function fetchBlob(url: string): Promise<Blob> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return r.blob();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

function loadImgElement(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img);
}

export function imageSize(img: Decoded): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: img.width, h: img.height };
}

export async function decodeImage(url: string, opts: DecodeOptions): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const blob = await fetchBlob(url);
      const base: ImageBitmapOptions = {
        imageOrientation: 'none',
        premultiplyAlpha: opts.kind === 'sprite' ? 'premultiply' : 'none',
        colorSpaceConversion: opts.kind === 'data' ? 'none' : 'default',
      };
      if (opts.maxWidth) {
        // Taille native d'abord (rapide : en-tête), puis redimensionnement si utile.
        const probe = await createImageBitmap(blob, base);
        if (probe.width <= opts.maxWidth) return probe;
        const h = Math.round((probe.height * opts.maxWidth) / probe.width);
        probe.close();
        return await createImageBitmap(blob, { ...base, resizeWidth: opts.maxWidth, resizeHeight: h, resizeQuality: 'high' });
      }
      return await createImageBitmap(blob, base);
    } catch {
      /* repli <img> ci-dessous */
    }
  }
  return loadImgElement(url);
}

/** Libère une image décodée (ImageBitmap) une fois envoyée au GPU. */
export function releaseImage(img: Decoded | null | undefined) {
  if (img && typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
}

/**
 * Détection d'une planche non découpée (stub) : image nettement plus large
 * que haute → grille 4×2 ; on n'utilise qu'une case.
 */
export function spriteCell(img: Decoded, index: number): [number, number, number, number] {
  const { w, h } = imageSize(img);
  if (w > h * 1.25) {
    const cols = 4;
    const rows = 2;
    // Cases « kodama seul debout » en priorité : 7, 0, 5, 1.
    const order = [7, 0, 5, 1, 4, 3, 6, 2];
    const c = order[index % order.length]!;
    const cx = c % cols;
    const cy = Math.floor(c / cols);
    return [cx / cols, cy / rows, 1 / cols, 1 / rows];
  }
  return [0, 0, 1, 1];
}

/** Rectangle (u, v, w, h) de la partie non transparente d'un sprite. */
export function opaqueBounds(img: Decoded, cell: [number, number, number, number]): [number, number, number, number] {
  const { w, h } = imageSize(img);
  const sw = 96;
  const sh = Math.max(8, Math.round((sw * cell[3] * h) / (cell[2] * w)));
  const cv = document.createElement('canvas');
  cv.width = sw;
  cv.height = sh;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return cell;
  ctx.drawImage(img as CanvasImageSource, cell[0] * w, cell[1] * h, cell[2] * w, cell[3] * h, 0, 0, sw, sh);
  const d = ctx.getImageData(0, 0, sw, sh).data;
  let x0 = sw;
  let y0 = sh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (d[(y * sw + x) * 4 + 3]! > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return cell;
  return [
    cell[0] + (x0 / sw) * cell[2],
    cell[1] + (y0 / sh) * cell[3],
    ((x1 - x0 + 1) / sw) * cell[2],
    ((y1 - y0 + 1) / sh) * cell[3],
  ];
}
