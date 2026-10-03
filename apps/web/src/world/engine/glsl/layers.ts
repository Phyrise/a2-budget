/**
 * Couches au-dessus de la peinture : sprites détourés (kodama, créatures,
 * gardien), cadre de fougères au premier plan, lot de quads additifs
 * (lumières du jour, traînées, effets peints : brume, rayons, aiguilles,
 * gouttes, halos).
 */
import { FRAMING, PRECISION } from './common';

/** Quad pivoté à sa base ; position (0..1, y vers le bas). */
export const SPRITE_VERT = /* glsl */ `
${PRECISION}
${FRAMING}
attribute vec2 position;
uniform vec2 uAnchor;
uniform vec2 uSize;     // largeur, hauteur en unités de hauteur d'image
uniform float uDepth;
uniform float uRot;
uniform float uAspect;
uniform vec4 uCell;
varying vec2 vUv;
varying vec2 vLocal;
void main() {
  vec2 local = (position - vec2(0.5, 1.0)) * uSize;
  float c = cos(uRot);
  float s = sin(uRot);
  local = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  vec2 p = uAnchor + vec2(local.x / uAspect, local.y) + parallaxOf(uDepth);
  vUv = uCell.xy + position * uCell.zw;
  vLocal = position;
  gl_Position = screenToClip(sceneToScreen(p));
}
`;

export const SPRITE_FRAG = /* glsl */ `
${PRECISION}
varying vec2 vUv;
varying vec2 vLocal;
uniform sampler2D uTex;
uniform sampler2D uNoise;
uniform float uAlpha;
uniform float uReveal;     // dissolution : 0 caché → 1 entier
uniform float uEmissive;   // 0 = couleur (alpha prémultiplié), 1 = lueur additive
uniform vec3 uGlow;        // teinte de la lueur / du bord de dissolution
uniform vec3 uFogColor;
uniform float uFogMix;
void main() {
  vec4 tx = texture2D(uTex, vUv);
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

/** Cadre de fougères : parallaxe plus forte, balancement doux depuis les bords. */
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
  vec4 tx = texture2D(uFg, f + sway * w * uSway * uTexel * 7.0);
  vec3 rgb = mix(tx.rgb, uFogColor * tx.a, uFogMix);
  gl_FragColor = vec4(rgb, tx.a);
}
`;

/**
 * Lot instancié de quads additifs. aRect.z > 0 : case de l'atlas peint ;
 * sinon mode procédural -aRect.z : 0 = orbe douce, 1 = trait (traînée, goutte),
 * 2 = rayon (coin lumineux partant du haut).
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
  } else {
    vec2 d = vec2((vQuad.x - 0.5) * 2.0, vQuad.y);
    float spread = mix(0.25, 1.0, vQuad.y);
    float a = exp(-pow(d.x / spread, 2.0) * 3.0) * smoothstep(0.0, 0.18, vQuad.y) * smoothstep(1.0, 0.45, vQuad.y);
    rgb = vec3(a);
  }
  gl_FragColor = vec4(rgb * vColor.rgb * vColor.a, 0.0);
}
`;
