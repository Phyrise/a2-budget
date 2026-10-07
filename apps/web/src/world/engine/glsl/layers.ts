/**
 * Couches au-dessus de la peinture : sprites détourés (kodama — dont la tête
 * qui secoue, karakara.ts —, créatures, gardien), cadre de fougères au premier plan, lot de quads additifs
 * (lumières du jour, traînées, effets peints : brume, rayons, aiguilles,
 * gouttes, halos).
 */
import { FRAMING, PRECISION } from './common';

/**
 * Quad pivoté à sa base ; position (0..1, y vers le bas). uPad agrandit le
 * quad (côtés et haut, pied inchangé) pour une tête qui secoue hors de sa
 * case ; vLocal sort alors de 0..1 (transparent).
 */
export const SPRITE_VERT = /* glsl */ `
${PRECISION}
${FRAMING}
attribute vec2 position;
uniform vec2 uAnchor;
uniform vec2 uSize;     // largeur, hauteur en unités de hauteur d'image
uniform float uDepth;
uniform float uRot;
uniform float uAspect;
uniform float uPad;
varying vec2 vLocal;
void main() {
  vec2 pos = vec2(position.x * (1.0 + 2.0 * uPad) - uPad, position.y * (1.0 + uPad) - uPad);
  vec2 local = (pos - vec2(0.5, 1.0)) * uSize;
  float c = cos(uRot);
  float s = sin(uRot);
  local = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  vec2 p = uAnchor + vec2(local.x / uAspect, local.y) + parallaxOf(uDepth);
  vLocal = pos;
  gl_Position = screenToClip(sceneToScreen(p));
}
`;

export const SPRITE_FRAG = /* glsl */ `
${PRECISION}
varying vec2 vLocal;
uniform vec4 uCell;
uniform vec2 uSize;
uniform vec4 uHead;        // kodama « karakara » : cou (x, y), angle, pincement
uniform vec4 uHeadBox;     // tête : centre (x, y), demi-axes
uniform sampler2D uTex;
uniform sampler2D uNoise;
uniform float uAlpha;
uniform float uReveal;     // dissolution : 0 caché → 1 entier
uniform float uEmissive;   // 0 = couleur (alpha prémultiplié), 1 = lueur additive
uniform vec3 uGlow;        // teinte de la lueur / du bord de dissolution
uniform vec3 uFogColor;
uniform float uFogMix;

// La tête tourne autour du cou ; joint doux : le poids s'efface hors de la
// tête, le corps et le socle restent immobiles.
vec2 headWarp(vec2 q) {
  float w = 1.0 - smoothstep(0.9, 1.3, length((q - uHeadBox.xy) / uHeadBox.zw));
  float asp = uSize.x / uSize.y;
  vec2 p = (q - uHead.xy) * vec2(asp, 1.0);
  float a = -uHead.z * w;
  float c = cos(a);
  float s = sin(a);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p.x /= 1.0 - uHead.w * w;
  return uHead.xy + p / vec2(asp, 1.0);
}

void main() {
  vec2 q = uHead.z != 0.0 ? headWarp(vLocal) : vLocal;
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec4 tx = texture2D(uTex, uCell.xy + clamp(q, 0.0, 1.0) * uCell.zw) * inside;
  float mask = 1.0;
  float edge = 0.0;
  if (uReveal < 0.999) {
    float n = texture2D(uNoise, vLocal * vec2(0.9, 1.4)).a * 0.6 + texture2D(uNoise, vLocal * vec2(3.0, 4.5) + 0.31).b * 0.4;
    float field = n * 0.8 + (1.0 - vLocal.y) * 0.2;
    float soft = 0.08;
    float front = uReveal * (1.0 + soft) - soft;
    mask = 1.0 - smoothstep(front, front + soft, field);
    edge = smoothstep(soft * 1.2, 0.0, abs(field - front - soft * 0.5)) * step(0.001, uReveal) * (1.0 - uReveal * uReveal);
  }
  float a = tx.a * mask * uAlpha;
  if (uEmissive > 0.5) {
    gl_FragColor = vec4((tx.rgb * mask + edge * tx.a * 1.6) * uGlow * uAlpha, 0.0);
  } else {
    vec3 rgb = mix(tx.rgb, uFogColor * tx.a, uFogMix) * mask + uGlow * edge * tx.a * 1.2;
    gl_FragColor = vec4(rgb * uAlpha, a);
  }
}
`;

/**
 * Cadre de fougères : parallaxe plus forte, balancement doux depuis les bords.
 * La couche est celle de la base (verte) : uFgSeason l'accorde à la peinture
 * de saison — x : roux d'automne (par plaques, quelques frondes restent
 * vertes), y : givre et neige posée sur le haut des frondes, z : vert tendre.
 */
export const FOREGROUND_FRAG = /* glsl */ `
${PRECISION}
${FRAMING}
varying vec2 vUv;
uniform sampler2D uFg;
uniform float uTime;
uniform float uSway;
uniform float uTexel;
uniform float uFgDepth;
uniform vec3 uFogColor;
uniform float uFogMix;
uniform vec3 uFgSeason;

vec3 seasonal(vec3 c, vec2 p, float a, vec2 above) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (uFgSeason.x > 0.001) {
    float pt = 0.5 + 0.5 * sin(p.x * 11.0 + sin(p.y * 9.0) * 2.2) * sin(p.y * 7.0 + p.x * 3.0);
    vec3 rust = mix(vec3(0.2, 0.06, 0.02), vec3(0.95, 0.46, 0.13), smoothstep(0.01, 0.32, l));
    c = mix(c, rust, uFgSeason.x * mix(0.55, 1.0, smoothstep(0.25, 0.6, pt)));
  }
  if (uFgSeason.y > 0.001) {
    vec3 frost = vec3(l * 1.2 + 0.035) * vec3(0.86, 0.94, 1.08);
    c = mix(c, frost, uFgSeason.y * 0.72);
    // Neige posée : coussinet sur le haut des frondes (vide au-dessus), irrégulier, ombré dessous.
    float cap = smoothstep(0.25, 0.85, a - mix(above.x, above.y, 0.6));
    float lumps = 0.55 + 0.45 * sin(p.x * 150.0 + sin(p.y * 95.0 + p.x * 40.0) * 2.5);
    vec3 snow = mix(vec3(0.6, 0.66, 0.76), vec3(0.88, 0.92, 0.97), smoothstep(0.0, 0.6, a - above.x));
    c = mix(c, snow, uFgSeason.y * cap * lumps * 0.8);
  }
  if (uFgSeason.z > 0.001) c = mix(c, c * vec3(1.06, 1.16, 0.9) + vec3(0.012, 0.025, 0.0), uFgSeason.z);
  return c;
}

void main() {
  vec2 uv = uCenter + (vUv - 0.5) * uView;
  vec2 f = uv - parallaxOf(uFgDepth);
  // Les pointes (loin des bords d'attache) bougent plus que la base.
  float fromEdge = min(min(f.x, 1.0 - f.x) * 1.6, 1.0 - f.y);
  float w = smoothstep(0.0, 0.45, fromEdge);
  float t = uTime;
  vec2 sway = vec2(
    sin(t * 0.55 + f.y * 4.0) * 0.65 + sin(t * 1.27 + f.x * 7.0 + f.y * 3.0) * 0.3,
    sin(t * 0.42 + f.x * 3.0) * 0.35
  );
  vec2 sp = f + sway * w * uSway * uTexel * 7.0;
  vec4 tx = texture2D(uFg, sp);
  if (uFgSeason.x + uFgSeason.y + uFgSeason.z > 0.001 && tx.a > 0.002) {
    vec2 above = vec2(texture2D(uFg, sp - vec2(0.0, uTexel * 4.0)).a, texture2D(uFg, sp - vec2(0.0, uTexel * 11.0)).a);
    tx.rgb = seasonal(tx.rgb / tx.a, sp, tx.a, above) * tx.a;
  }
  tx *= smoothstep(0.0, 0.03, min(f.x, 1.0 - f.x));
  vec3 rgb = mix(tx.rgb, uFogColor * tx.a, uFogMix);
  gl_FragColor = vec4(rgb, tx.a);
}
`;

/**
 * Lot instancié de quads additifs. aRect.z > 0 : case de l'atlas peint ;
 * sinon mode procédural -aRect.z : 0 = orbe douce, 1 = trait (traînée, goutte),
 * 2 = rayon (coin lumineux partant du haut), 3 = lanterne de papier.
 */
export const BILLBOARD_VERT = /* glsl */ `
${PRECISION}
${FRAMING}
attribute vec2 position;
attribute vec3 aPos;
attribute vec2 aSize;
attribute float aRot;
attribute vec4 aColor;
attribute vec4 aRect;
uniform float uAspect;
varying vec2 vUv;
varying vec2 vQuad;
varying vec4 vColor;
varying float vMode;
void main() {
  vec2 q = position * aSize;
  float c = cos(aRot);
  float s = sin(aRot);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vec2 p = aPos.xy + vec2(q.x / uAspect, q.y) + parallaxOf(aPos.z);
  vQuad = position + 0.5;
  vUv = aRect.xy + vQuad * aRect.zw;
  vColor = aColor;
  vMode = aRect.z > 0.0 ? -1.0 : -aRect.z;
  gl_Position = screenToClip(sceneToScreen(p));
}
`;

export const BILLBOARD_FRAG = /* glsl */ `
${PRECISION}
varying vec2 vUv;
varying vec2 vQuad;
varying vec4 vColor;
varying float vMode;
uniform sampler2D uAtlas;
void main() {
  vec3 rgb;
  if (vMode < -0.5) {
    rgb = texture2D(uAtlas, vUv).rgb;
  } else if (vMode < 0.5) {
    vec2 d = (vQuad - 0.5) * 2.0;
    float r2 = dot(d, d);
    float a = exp(-r2 * 3.2) * 0.55 + exp(-r2 * 26.0) * 0.9;
    rgb = vec3(a * (1.0 - smoothstep(0.7, 1.0, r2)));
  } else if (vMode < 1.5) {
    vec2 d = (vQuad - 0.5) * 2.0;
    float a = exp(-d.x * d.x * 9.0) * smoothstep(1.0, 0.2, abs(d.y));
    rgb = vec3(a);
  } else if (vMode > 2.5) {
    // Lanterne de papier : corps ovale net, côtes, chapeau et pied (vides), cœur chaud.
    vec2 d = (vQuad - 0.5) * 2.0;
    float r = length(d * vec2(1.0, 1.1));
    float body = 1.0 - smoothstep(0.86, 0.96, r);
    float ribs = 0.72 + 0.28 * pow(abs(cos(d.y * 13.0)), 0.6);
    float caps = smoothstep(0.84, 0.76, abs(d.y + 0.01));
    float ring = exp(-pow((abs(d.y) - 0.8) / 0.035, 2.0)) * step(abs(d.x), 0.42) * 0.55;
    float core = exp(-dot(d - vec2(0.0, -0.12), d - vec2(0.0, -0.12)) * 2.6);
    float a = body * ribs * caps * (0.35 + 0.85 * core) * (1.0 - smoothstep(0.6, 0.95, r) * 0.45) + ring;
    rgb = vec3(a) * mix(vec3(1.0, 0.86, 0.66), vec3(1.0, 0.95, 0.82), core);
  } else {
    vec2 d = vec2((vQuad.x - 0.5) * 2.0, vQuad.y);
    float spread = mix(0.25, 1.0, vQuad.y);
    float a = exp(-pow(d.x / spread, 2.0) * 3.0) * smoothstep(0.0, 0.18, vQuad.y) * smoothstep(1.0, 0.45, vQuad.y);
    rgb = vec3(a);
  }
  gl_FragColor = vec4(rgb * vColor.rgb * vColor.a, 0.0);
}
`;
