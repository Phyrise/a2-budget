/**
 * Particules saisonnières (gl.POINTS, mouvement entièrement en vertex shader),
 * dessinées DANS la scène (avant l'étalonnage : la LUT et la nuit les
 * teintent comme la peinture), en alpha prémultiplié.
 *
 * uSeason : 0 = pétales de cerisier sauvage, 1 = feuilles (érable / cèdre),
 * 2 = neige fine (plus dense et plus grosse au premier plan).
 * uRest = 1 : image fixe — quelques feuilles / pétales posés au sol
 * (uRestPts), rien en l'air.
 */
import { FRAMING, PRECISION } from './common';

export const SEASON_VERT = /* glsl */ `
${PRECISION}
${FRAMING}
attribute vec4 aSeed;
attribute float aIdx;
uniform float uTime;
uniform float uCount;
uniform float uSeason;
uniform float uSizeK;
uniform float uAspect;
uniform float uGust;
uniform vec4 uWhirl;        // x, y (scène), force 0..1, rayon (hauteur d'image)
uniform float uWhirlK;      // phase du tourbillon 0..1
uniform vec4 uAvoid[6];     // visages des kodama : x, y, rayon, visibilité
uniform float uRest;
uniform vec3 uRestPts[8];   // feuilles posées : x, y, profondeur
uniform float uRestCount;
uniform vec3 uFogColor;
uniform float uFog;
varying vec4 vCol;
varying float vAngle;
varying float vFlip;
varying float vShape;
varying float vSoft;

vec3 leafColor(float k) {
  // Rouille, ambre, mousse, brun-rouge : teintes sourdes, fondues dans la peinture.
  vec3 c = mix(vec3(0.44, 0.21, 0.1), vec3(0.6, 0.4, 0.16), smoothstep(0.0, 0.4, k));
  c = mix(c, vec3(0.36, 0.39, 0.17), smoothstep(0.55, 0.75, k));
  return mix(c, vec3(0.38, 0.15, 0.09), smoothstep(0.85, 1.0, k));
}

void main() {
  float active = clamp(uCount - aIdx, 0.0, 1.0);
  vShape = aSeed.w;
  vSoft = 0.0;
  float depth;
  float size;
  float alpha;
  vec3 col;
  vec2 p;

  if (uRest > 0.5) {
    vec3 rp = vec3(-1.0);
    for (int i = 0; i < 8; i++) {
      if (float(i) == aIdx) rp = uRestPts[i];
    }
    depth = rp.z;
    p = rp.xy + vec2((aSeed.x - 0.5) * 0.02, (aSeed.y - 0.5) * 0.006);
    alpha = step(aIdx + 0.5, uRestCount) * step(0.0, rp.x) * 0.92;
    vAngle = aSeed.z * 6.2832;
    vFlip = 0.62 + 0.25 * aSeed.y;
    size = (uSeason < 0.5 ? 17.0 : 27.0) * mix(0.7, 1.5, depth);
    col = uSeason < 0.5 ? mix(vec3(0.95, 0.78, 0.82), vec3(0.98, 0.92, 0.9), aSeed.x) : leafColor(aSeed.x);
    col = mix(col * 0.85, uFogColor, uFog * 0.18);
    gl_Position = screenToClip(sceneToScreen(p + parallaxOf(depth)));
    gl_PointSize = size * uSizeK;
    vCol = vec4(col, alpha * step(uSeason, 1.5));
    return;
  }

  float speed;
  float sway;
  float cycle = 1.25;
  if (uSeason > 1.5) {
    // Neige : la moitié des flocons au premier plan, plus gros et plus rapides.
    depth = mix(0.15, 1.3, pow(aSeed.z, 0.55));
    speed = mix(0.03, 0.055, aSeed.w) * mix(0.55, 1.6, depth);
    sway = 0.012 + 0.01 * aSeed.w;
    size = mix(5.0, 9.0, aSeed.w) * mix(0.7, 2.6, smoothstep(0.3, 1.3, depth));
    vSoft = smoothstep(0.9, 1.3, depth);
    col = vec3(0.97, 0.98, 1.0);
    alpha = mix(0.6, 1.0, aSeed.y) * mix(0.7, 1.0, depth) * (1.0 - vSoft * 0.4);
  } else if (uSeason > 0.5) {
    depth = mix(0.2, 1.12, aSeed.z);
    speed = mix(0.045, 0.075, aSeed.w) * mix(0.7, 1.25, depth);
    sway = 0.035 + 0.03 * aSeed.y;
    size = mix(18.0, 26.0, aSeed.w) * mix(0.55, 1.5, depth);
    col = leafColor(aSeed.x) * 0.85;
    alpha = 0.95;
  } else {
    depth = mix(0.2, 1.1, aSeed.z);
    speed = mix(0.028, 0.045, aSeed.w) * mix(0.7, 1.2, depth);
    sway = 0.03 + 0.025 * aSeed.y;
    size = mix(14.0, 20.0, aSeed.w) * mix(0.55, 1.5, depth);
    col = mix(vec3(0.97, 0.7, 0.78), vec3(1.0, 0.86, 0.88), aSeed.x);
    alpha = 0.95;
  }

  float fall = fract(aSeed.y + uTime * speed / cycle);
  float ph = uTime * (0.45 + aSeed.w * 0.5) + aSeed.x * 31.0;
  // Position écran (0..1) : dérive vers la droite, balancement, souffle des pulses.
  vec2 s = vec2(
    aSeed.x * 1.2 - 0.1 + sin(ph) * sway + fall * 0.06 + uGust * 0.035 * depth,
    fall * cycle - 0.12 + cos(ph * 2.0) * sway * 0.12
  );
  p = uCenter + (s - 0.5) * uView;

  // Tourbillon léger au passage d'un pulse.
  if (uWhirl.z > 0.001) {
    vec2 iso = vec2(uAspect, 1.0);
    vec2 v = (p - uWhirl.xy) * iso;
    float fall2 = exp(-dot(v, v) / (uWhirl.w * uWhirl.w));
    float ang = uWhirl.z * fall2 * sin(3.14159 * uWhirlK) * 2.4;
    float c = cos(ang);
    float sn = sin(ang);
    v = vec2(c * v.x - sn * v.y, sn * v.x + c * v.y);
    p = uWhirl.xy + v / iso - vec2(0.0, uWhirl.z * fall2 * sin(3.14159 * uWhirlK) * 0.025);
  }

  // Jamais devant le visage d'un kodama.
  for (int i = 0; i < 6; i++) {
    vec4 a = uAvoid[i];
    vec2 dv = (p - a.xy) * vec2(uAspect, 1.0);
    alpha *= mix(1.0, smoothstep(a.z * 0.55, a.z * 1.25, length(dv)), a.w * step(depth, 0.9));
  }

  alpha *= smoothstep(0.0, 0.06, fall) * smoothstep(1.0, 0.9, fall) * active;
  // Au loin, la brume les adoucit ; tout près, l'ombre du sous-bois.
  if (uSeason < 1.5) {
    col = mix(col, uFogColor, uFog * (1.0 - smoothstep(0.2, 0.8, depth)) * 0.45);
    col *= mix(1.0, 0.72, smoothstep(0.85, 1.12, depth));
  }
  float spin = (aSeed.z - 0.5) * 2.2;
  vAngle = uTime * spin + aSeed.w * 6.2832 + sin(ph * 0.7) * 0.7;
  vFlip = uSeason > 1.5 ? 1.0 : cos(uTime * (0.9 + aSeed.y * 1.4) + aSeed.z * 9.0);
  gl_Position = screenToClip(sceneToScreen(p + parallaxOf(depth)));
  gl_PointSize = size * uSizeK;
  vCol = vec4(col, alpha);
}
`;

export const SEASON_FRAG = /* glsl */ `
${PRECISION}
uniform float uSeason;
varying vec4 vCol;
varying float vAngle;
varying float vFlip;
varying float vShape;
varying float vSoft;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  q.y = -q.y;
  float a;
  vec3 col = vCol.rgb;
  if (uSeason > 1.5) {
    float r2 = dot(q, q) * 4.0;
    a = mix(exp(-r2 * 6.0), exp(-r2 * 2.6) * 0.7, vSoft) * (1.0 - smoothstep(0.8, 1.0, r2));
  } else {
    float c = cos(vAngle);
    float s = sin(vAngle);
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    float flip = abs(vFlip);
    q.x /= max(0.16, flip);
    float face = vFlip < 0.0 ? 0.72 : 1.0;
    float d;
    if (uSeason < 0.5) {
      // Pétale : goutte arrondie, encoche au sommet, base plus rosée.
      vec2 e = vec2(q.x * 1.75, q.y + 0.04);
      d = length(e) - 0.3 + q.y * 0.18;
      d = max(d, -(length(q - vec2(0.0, 0.33)) - 0.07));
      col = mix(col * vec3(1.0, 0.86, 0.88), col, smoothstep(-0.25, 0.1, q.y));
    } else if (vShape < 0.6) {
      // Érable : cinq lobes pointus et une petite tige.
      float th = atan(q.x, q.y);
      float r = length(q);
      float lobes = pow(0.5 + 0.5 * cos(th * 5.0), 2.2);
      float R = 0.2 + 0.2 * lobes - 0.07 * smoothstep(2.4, 3.14, abs(th));
      d = r - R;
      float stem = max(abs(q.x) - 0.018, abs(q.y + 0.34) - 0.1);
      d = min(d, stem);
      col *= 1.0 - 0.22 * exp(-q.x * q.x * 1600.0) * step(q.y, 0.25);
    } else {
      // Feuille allongée (cèdre / chêne) : ovale pointu, nervure centrale.
      float y = q.y / 0.44;
      float w = 0.17 * pow(max(0.0, 1.0 - y * y), 0.75);
      d = abs(q.x) - w;
      d = max(d, abs(q.y) - 0.44);
      col *= 1.0 - 0.25 * exp(-q.x * q.x * 1500.0);
    }
    a = 1.0 - smoothstep(-0.03, 0.015, d);
    col *= face;
  }
  a *= vCol.a;
  // Neige et pétales : un peu de lumière propre (visibles sur la brume claire).
  float own = uSeason > 1.5 ? 0.45 : uSeason < 0.5 ? 0.25 : 0.0;
  gl_FragColor = vec4(col * a, a * (1.0 - own));
}
`;
