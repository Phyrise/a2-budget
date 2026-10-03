/**
 * Particules gl.POINTS, mouvement entièrement en vertex shader.
 * uMode 0 : spores (jour) / lucioles (nuit) ; 1 : lucioles du gardien qui
 * montent ; 2 : pluie fine en traits (espace écran).
 */
import { FRAMING, PRECISION } from './common';

export const POINTS_VERT = /* glsl */ `
${PRECISION}
${FRAMING}
attribute vec4 aSeed;
attribute float aIdx;
uniform float uTime;
uniform float uCount;
uniform float uNight;
uniform float uGold;
uniform float uMode;
uniform float uBurst;
uniform vec4 uRect;       // gardien : x, y (pieds), largeur, hauteur (scène)
uniform float uDepth;     // gardien : profondeur
uniform float uSizeK;     // px de point par px CSS (dpr × échelle de vue)
uniform float uIntensity;
varying vec4 vCol;
varying float vKind;

void main() {
  float active = clamp(uCount - aIdx, 0.0, 1.0);
  vec2 p;
  float depth;
  float size;
  float alpha;
  vec3 col;
  vKind = 0.0;
  if (uMode < 0.5) {
    depth = 0.25 + aSeed.z * 0.7;
    float sp = mix(0.012, 0.0045, uNight) * (0.45 + aSeed.w);
    float life = fract(uTime * sp + aSeed.y);
    vec2 home = vec2(0.03 + aSeed.x * 0.94, 0.3 + aSeed.w * 0.62);
    float rise = mix(0.24, 0.06, uNight);
    float tt = uTime * mix(1.0, 0.55, uNight);
    p = home + vec2(
      sin(tt * (0.11 + aSeed.z * 0.17) + aSeed.x * 31.0) * 0.04 + sin(tt * 0.33 + aSeed.y * 13.0) * 0.012,
      -life * rise + cos(tt * (0.09 + aSeed.x * 0.13) + aSeed.w * 21.0) * 0.025
    );
    alpha = smoothstep(0.0, 0.18, life) * smoothstep(1.0, 0.7, life);
    float blink = smoothstep(0.15, 0.85, sin(uTime * (0.5 + aSeed.z * 0.9) + aSeed.x * 40.0) * 0.5 + 0.5);
    alpha *= mix(0.55 + 0.45 * blink, blink, uNight) * active;
    size = mix(6.0, 11.0, aSeed.z) * mix(0.7, 1.35, depth) * mix(1.0, 1.7, uNight);
    vec3 pale = vec3(0.86, 0.93, 0.84);
    vec3 gold = vec3(1.0, 0.8, 0.46);
    vec3 firefly = vec3(0.78, 1.0, 0.46);
    col = mix(mix(pale, gold, uGold * step(aSeed.y, 0.75)), firefly, uNight);
    alpha *= mix(0.55, 0.95, uNight);
  } else if (uMode < 1.5) {
    depth = uDepth;
    float delay = aSeed.w * 0.35;
    float k = clamp((uBurst - delay) / (1.0 - delay), 0.0, 1.0);
    vec2 start = vec2(uRect.x + (aSeed.x - 0.5) * uRect.z * 0.8, uRect.y - aSeed.y * uRect.w * 0.95);
    float ease = 1.0 - pow(1.0 - k, 2.0);
    p = start + vec2(sin(k * 6.0 + aSeed.z * 20.0) * 0.03 * k, -ease * (0.18 + aSeed.z * 0.22));
    alpha = smoothstep(0.0, 0.08, k) * smoothstep(1.0, 0.55, k) * step(0.0001, uBurst);
    size = mix(9.0, 16.0, aSeed.z);
    col = mix(vec3(0.8, 1.0, 0.55), vec3(1.0, 0.92, 0.7), aSeed.x);
  } else {
    // Pluie : espace écran, traits fins légèrement obliques.
    vKind = 1.0;
    depth = PIVOT;
    float fall = fract(aSeed.y + uTime * (0.45 + aSeed.z * 0.35));
    vec2 s = vec2(aSeed.x * 1.1 - 0.05 + fall * 0.06, fall * 1.15 - 0.08);
    gl_Position = screenToClip(s);
    size = mix(20.0, 36.0, aSeed.z);
    alpha = 0.22 * active * smoothstep(0.0, 0.1, fall) * mix(0.5, 1.0, aSeed.w);
    col = vec3(0.82, 0.88, 0.9);
    gl_PointSize = size * uSizeK;
    vCol = vec4(col, alpha * uIntensity);
    return;
  }
  gl_Position = screenToClip(sceneToScreen(p + parallaxOf(depth)));
  gl_PointSize = size * uSizeK;
  vCol = vec4(col, alpha * uIntensity);
}
`;

export const POINTS_FRAG = /* glsl */ `
${PRECISION}
varying vec4 vCol;
varying float vKind;
uniform sampler2D uAtlas;
uniform vec4 uSprite;     // case de l'atlas (spore peinte) ; z = 0 → procédural
void main() {
  vec2 pc = gl_PointCoord;
  float a;
  if (vKind > 0.5) {
    float x = (pc.x - 0.5) - (pc.y - 0.5) * 0.12;
    a = exp(-x * x * 900.0) * smoothstep(0.0, 0.35, pc.y) * smoothstep(1.0, 0.55, pc.y);
    gl_FragColor = vec4(vCol.rgb * a * vCol.a, 0.0);
    return;
  }
  if (uSprite.z > 0.0) {
    vec3 tx = texture2D(uAtlas, uSprite.xy + pc * uSprite.zw).rgb;
    gl_FragColor = vec4(tx * vCol.rgb * vCol.a * 1.4, 0.0);
    return;
  }
  vec2 d = (pc - 0.5) * 2.0;
  float r2 = dot(d, d);
  a = exp(-r2 * 4.5) * 0.5 + exp(-r2 * 30.0) * 0.9;
  a *= 1.0 - smoothstep(0.75, 1.0, r2);
  gl_FragColor = vec4(vCol.rgb * a * vCol.a, 0.0);
}
`;
