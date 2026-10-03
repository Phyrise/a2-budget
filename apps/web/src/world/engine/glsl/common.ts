/**
 * Morceaux GLSL partagés (GLSL ES 1.00 : compatible WebGL 1 et 2).
 *
 * Espace « scène » = coordonnées normalisées de l'image portrait (0..1,
 * origine en haut à gauche). La vue montre le rectangle centré en uCenter, de
 * taille uView. La parallaxe déplace un point de profondeur d de
 * uPar * (d - PIVOT) : le fond recule, le premier plan avance.
 */

export const PRECISION = /* glsl */ `
precision highp float;
`;

export const FRAMING = /* glsl */ `
uniform vec2 uCenter;
uniform vec2 uView;
uniform vec2 uPar;
const float PIVOT = 0.4;

vec2 parallaxOf(float depth) { return uPar * (depth - PIVOT); }

/** Point de scène (déjà déplacé par la parallaxe) → espace écran 0..1 (y vers le bas). */
vec2 sceneToScreen(vec2 p) { return (p - uCenter) / uView + 0.5; }

vec4 screenToClip(vec2 s) { return vec4(s.x * 2.0 - 1.0, 1.0 - s.y * 2.0, 0.0, 1.0); }
`;

/** Triangle plein écran : vUv écran 0..1 avec y vers le bas. */
export const FULLSCREEN_VERT = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const HASH = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

export const LUMA = /* glsl */ `
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;
