/**
 * Peintures du matsuri dessinées par le code (canvas 2D), pour festival.ts :
 * - le chōchin : ficelle, chapeau laqué cerclé d'or, papier rouge braise à
 *   côtes éclairé de l'intérieur (cœur doré), pied laqué, gland doré ;
 * - la corde qui porte la guirlande, en une seule toile (pas de jointures).
 * Toiles en pixels doubles, envoyées une fois au GPU (Resources.texture).
 */

/** Toile d'un lampion (px) : la ficelle en haut, le gland en bas. */
export const CHOCHIN = { w: 96, h: 154, body: { top: 24, bottom: 124 } } as const;

function lacquer(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = 4;
  g.fillStyle = '#1d1311';
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(214, 164, 82, 0.85)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x + 3, y + h - 2);
  g.lineTo(x + w - 3, y + h - 2);
  g.stroke();
}

/** Un chōchin éclairé de l'intérieur. */
export function drawChochin(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CHOCHIN.w;
  c.height = CHOCHIN.h;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  const cx = CHOCHIN.w / 2;
  const { top, bottom } = CHOCHIN.body;

  // Ficelle.
  g.strokeStyle = '#2e2019';
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, 2);
  g.lineTo(cx, top - 6);
  g.stroke();

  // Corps en tonneau : papier rouge, plus clair au cœur.
  const body = new Path2D();
  body.moveTo(cx - 34, top);
  body.bezierCurveTo(cx - 47, top + 18, cx - 47, bottom - 18, cx - 34, bottom);
  body.lineTo(cx + 34, bottom);
  body.bezierCurveTo(cx + 47, bottom - 18, cx + 47, top + 18, cx + 34, top);
  body.closePath();
  const mid = (top + bottom) / 2;
  const paper = g.createRadialGradient(cx - 4, mid - 6, 4, cx, mid, 52);
  paper.addColorStop(0, '#fff0c4');
  paper.addColorStop(0.22, '#ffc277');
  paper.addColorStop(0.52, '#f2643a');
  paper.addColorStop(0.82, '#c3302a');
  paper.addColorStop(1, '#7a1a17');
  g.fillStyle = paper;
  g.fill(body);

  // Côtes de bambou, bombées, et ombre douce sur les flancs.
  g.save();
  g.clip(body);
  g.strokeStyle = 'rgba(104, 16, 12, 0.36)';
  g.lineWidth = 1.3;
  for (let y = top + 8; y < bottom - 3; y += 8) {
    const bow = ((y - mid) / (bottom - top)) * 10;
    g.beginPath();
    g.moveTo(cx - 48, y - bow);
    g.quadraticCurveTo(cx, y + bow, cx + 48, y - bow);
    g.stroke();
  }
  const side = g.createLinearGradient(cx - 47, 0, cx + 47, 0);
  side.addColorStop(0, 'rgba(60, 8, 8, 0.5)');
  side.addColorStop(0.28, 'rgba(60, 8, 8, 0)');
  side.addColorStop(0.72, 'rgba(60, 8, 8, 0)');
  side.addColorStop(1, 'rgba(60, 8, 8, 0.55)');
  g.fillStyle = side;
  g.fillRect(0, top, CHOCHIN.w, bottom - top);
  g.restore();

  lacquer(g, cx - 23, top - 9, 46, 12);
  lacquer(g, cx - 21, bottom - 3, 42, 11);

  // Gland doré.
  g.strokeStyle = '#e2ad4c';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(cx, bottom + 8);
  g.lineTo(cx, CHOCHIN.h - 3);
  g.stroke();
  g.fillStyle = '#f0c264';
  g.beginPath();
  g.arc(cx, bottom + 10, 3, 0, Math.PI * 2);
  g.fill();
  return c;
}

/**
 * La corde : `y(u)` donne la hauteur (scène) du point u 0..1 ; la toile
 * couvre x 0..1 et [top, top + spanH] (hauteurs d'image), à `pxPerH` px par
 * hauteur d'image.
 */
export function drawRope(y: (u: number) => number, top: number, spanH: number, widthH: number, pxPerH: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(widthH * pxPerH);
  c.height = Math.round(spanH * pxPerH);
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2D indisponible');
  const path = new Path2D();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const px = u * c.width;
    const py = (y(u) - top) * pxPerH;
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(38, 25, 18, 0.92)';
  g.lineWidth = 3;
  g.stroke(path);
  g.translate(0, -0.9);
  g.strokeStyle = 'rgba(176, 124, 70, 0.55)';
  g.lineWidth = 1;
  g.stroke(path);
  return c;
}
