/**
 * La Noiraude dorée : ses images de corps sont celles des autres, teintées
 * d'or une fois (reflet chaud en haut à gauche, bord cuivré), gardées tant
 * que l'image d'origine vit (WeakMap : un sprite reconstruit en refait une).
 */
const tinted = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

export function golden(src: HTMLCanvasElement): HTMLCanvasElement {
  const known = tinted.get(src);
  if (known && known.width === src.width && known.height === src.height) return known;
  const c = known ?? document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  if (ctx === null || src.width === 0) return src;
  const w = src.width;
  const h = src.height;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0);
  // L'or ne se pose que là où la suie est (source-atop) ; la fourrure reste lisible.
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createRadialGradient(w * 0.38, h * 0.32, 0, w * 0.5, h * 0.5, w * 0.56);
  g.addColorStop(0, 'rgba(255, 240, 176, 0.96)');
  g.addColorStop(0.45, 'rgba(232, 184, 78, 0.92)');
  g.addColorStop(1, 'rgba(140, 92, 30, 0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  tinted.set(src, c);
  return c;
}
