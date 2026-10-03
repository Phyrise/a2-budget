/**
 * Passe principale : la peinture du stade, en 2.5D.
 * Parallaxe par profondeur, vent (masque G), eau à deux phases (masque R),
 * croissance par dissolution organique (masque B), brume en nappes modulée par
 * la profondeur, rayons procéduraux + poussières, mousse lumineuse, clair de lune.
 */
import { FRAMING, HASH, LUMA, PRECISION } from './common';

export const SCENE_FRAG = /* glsl */ `
${PRECISION}
${FRAMING}
${HASH}
${LUMA}
varying vec2 vUv;

uniform sampler2D uColor;
uniform sampler2D uPrev;
uniform sampler2D uDepth;
uniform sampler2D uMasks;
uniform sampler2D uNoise;

uniform float uTime;
uniform float uAspect;      // largeur / hauteur de l'image
uniform float uTexel;       // 1 / largeur image (px)
uniform float uGrow;        // 0..1 dissolution vers le nouveau stade (1 = terminé)
uniform float uWind;        // amplitude du vent en px image
uniform float uWater;       // 0..1 intensité de l'eau
uniform float uFog;
uniform float uFogLift;
uniform float uFogLayers;   // 1..3 (paliers de qualité)
uniform vec3  uFogColor;
uniform float uFogGlow;     // gardien : la brume s'illumine
uniform float uRays;
uniform vec4  uRayW;
uniform vec4  uRayAng;
uniform vec4  uRayWidth;
uniform vec2  uLight;
uniform vec3  uRayColor;
uniform float uSparkle;
uniform float uMoss;
uniform float uMoon;
uniform float uDetail;      // 0 = palier bas (moins d'échantillons)

vec3 sampleColor(sampler2D t, vec2 p) { return texture2D(t, p).rgb; }

void main() {
  vec2 uv = uCenter + (vUv - 0.5) * uView;
  // Profondeur adoucie (biais de mip) : pas de déchirure aux contours.
  float d0 = texture2D(uDepth, uv, 2.5).r;
  vec2 suv = uv - parallaxOf(d0);
  float depth = texture2D(uDepth, suv, 1.5).r;
  vec4 m = texture2D(uMasks, suv);
  vec2 iso = vec2(uAspect, 1.0);
  float t = uTime;

  // --- Vent : léger déplacement bruité sur le feuillage (1–2 px à 1x).
  vec2 wn = texture2D(uNoise, suv * iso * 2.2 + vec2(t * 0.045, t * 0.012)).rg - 0.5;
  float gust = texture2D(uNoise, vec2(suv.y * 0.6 + t * 0.03, 0.37)).r;
  vec2 wind = (wn + vec2(0.18, 0.0)) * (0.6 + 0.8 * gust) * uWind * uTexel * 2.0 * m.g;
  vec2 cuv = suv + wind;

  vec3 col = sampleColor(uColor, cuv);
  // Écran large : au-delà des bords de la peinture, reflet flou et assombri.
  float inside = min(suv.x, 1.0 - suv.x);
  if (inside < 0.1) {
    vec2 mir = vec2(suv.x < 0.5 ? abs(suv.x) : 2.0 - suv.x, suv.y);
    vec3 blurred = texture2D(uColor, clamp(mir, 0.0, 1.0), 5.5).rgb;
    float outside = max(0.0, -inside);
    blurred *= 0.6 * exp(-outside * 2.6) + 0.07;
    col = mix(blurred, col, smoothstep(-0.02, 0.1, inside));
  }

  // --- Eau : écoulement à deux phases vers le bas / le spectateur.
  float wm = m.r * uWater;
  if (wm > 0.01) {
    vec2 fn = texture2D(uNoise, suv * iso * 1.3 + vec2(0.0, t * 0.01)).ga - 0.5;
    vec2 flow = normalize(vec2(fn.x * 0.9, 1.0)) * (0.010 + 0.006 * fn.y);
    float sp = t * 0.22;
    float p0 = fract(sp);
    float p1 = fract(sp + 0.5);
    float w0 = 1.0 - abs(1.0 - 2.0 * p0);
    vec3 c0 = sampleColor(uColor, cuv + flow * (p0 - 0.5) * 0.9);
    vec3 c1 = sampleColor(uColor, cuv + flow * (p1 - 0.5) * 0.9 + vec2(0.0013, 0.0));
    vec3 flowed = mix(c1, c0, w0);
    col = mix(col, flowed, smoothstep(0.0, 0.5, wm));
    // Scintillements discrets sur le courant.
    float gl = texture2D(uNoise, suv * iso * vec2(26.0, 14.0) + vec2(0.0, -t * 0.08)).b;
    float gl2 = texture2D(uNoise, suv * iso * vec2(17.0, 9.0) + vec2(t * 0.013, -t * 0.05)).b;
    float spark = smoothstep(0.78, 0.98, gl * gl2 * 1.35);
    col += vec3(0.72, 0.82, 0.86) * spark * wm * (0.15 + 0.6 * luma(col)) * 0.55;
  }

  // --- Croissance : dissolution organique depuis les racines / le cèdre.
  if (uGrow < 0.999) {
    vec3 prev = sampleColor(uPrev, cuv);
    float n = texture2D(uNoise, suv * iso * 1.7).a * 0.62 + texture2D(uNoise, suv * iso * 6.0).b * 0.38;
    float dist = length((suv - vec2(0.5, 0.86)) * iso);
    float field = dist * 0.85 - m.b * 0.22 + n * 0.42;
    float soft = 0.07;
    float front = uGrow * (1.2 + soft) - soft;
    float reveal = 1.0 - smoothstep(front, front + soft, field);
    float edge = smoothstep(soft, 0.0, abs(field - front - soft * 0.5)) * (1.0 - uGrow);
    col = mix(prev, col, reveal);
    col += vec3(0.55, 0.62, 0.34) * edge * 0.35;
  }

  float l = luma(col);

  // --- Mousse lumineuse (florissant) : les verts du sol respirent.
  if (uMoss > 0.01) {
    float green = smoothstep(0.01, 0.09, col.g - max(col.r, col.b));
    float ground = smoothstep(0.45, 0.85, suv.y) * (1.0 - m.r);
    float breathe = 0.6 + 0.4 * sin(t * 0.7 + texture2D(uNoise, suv * iso * 3.0).r * 9.0);
    col += vec3(0.30, 0.48, 0.16) * green * ground * breathe * uMoss * 0.16 * (0.4 + l);
  }

  // --- Gouttes qui scintillent sur les feuilles.
  if (uSparkle > 0.01) {
    float s1 = texture2D(uNoise, suv * iso * 21.0).b;
    float tw = 0.5 + 0.5 * sin(t * 2.3 + s1 * 60.0);
    float s = smoothstep(0.9, 0.99, s1) * tw * tw;
    col += vec3(0.85, 0.92, 0.9) * s * (m.g * 0.8 + wm) * uSparkle * (0.25 + l) * 0.9;
  }

  // --- Brume : 2–3 nappes de bruit qui dérivent, plus denses au loin.
  vec2 fp = suv * iso;
  float f = texture2D(uNoise, fp * vec2(0.55, 1.1) + vec2(t * 0.0045, t * 0.0011)).r;
  if (uFogLayers > 1.5) f = f * 0.6 + texture2D(uNoise, fp * vec2(1.25, 2.1) + vec2(-t * 0.0085, t * 0.002)).g * 0.4;
  if (uFogLayers > 2.5) f = mix(f, texture2D(uNoise, fp * vec2(0.3, 0.6) + vec2(t * 0.0022, -t * 0.0008)).a, 0.3);
  float far = pow(1.0 - depth, 1.5);
  // Nappe basse (sol) qui se lève avec l'humeur ; toujours plus dense au loin.
  float band = smoothstep(0.35, 0.62, suv.y) * (1.0 - smoothstep(0.78, 0.98, suv.y));
  float height = mix(0.55 + 0.45 * band, 0.8 + 0.2 * (1.0 - suv.y), uFogLift);
  float density = uFog * (0.1 + 0.9 * far) * height * smoothstep(0.32, 0.86, f + uFog * 0.12);
  float fogA = clamp(density * 0.55, 0.0, 0.45);

  // --- Rayons depuis la canopée.
  vec2 dv = (suv - uLight) * iso;
  float r = length(dv);
  float ang = atan(dv.x, dv.y);
  vec4 dang = (vec4(ang) - uRayAng) / uRayWidth;
  float ray = dot(exp(-dang * dang), uRayW);
  float streak = texture2D(uNoise, vec2(ang * 2.6, r * 0.12 - t * 0.006)).g;
  float pulse = 0.82 + 0.18 * sin(t * 0.45) * sin(t * 0.17 + 1.3);
  ray *= (0.55 + 0.9 * streak) * smoothstep(0.02, 0.2, r) * exp(-r * 0.9) * pulse;
  ray *= 0.45 + 0.55 * (1.0 - depth) + 0.5 * m.a;
  float rayL = ray * uRays;
  vec3 fogCol = uFogColor + uRayColor * rayL * 0.6 + vec3(0.62, 0.72, 0.66) * uFogGlow;
  col = mix(col, fogCol, clamp(fogA + uFogGlow * 0.25 * far, 0.0, 0.8));
  col += uRayColor * rayL * (0.32 + fogA * 0.8);

  // Poussières qui flottent dans les rayons.
  if (uDetail > 0.5 && rayL > 0.004) {
    float dn = texture2D(uNoise, fp * 7.5 + vec2(t * 0.0035, -t * 0.007)).b;
    float dn2 = texture2D(uNoise, fp * 4.1 + vec2(-t * 0.002, -t * 0.004)).b;
    col += uRayColor * smoothstep(0.86, 0.985, dn * dn2 * 1.45) * rayL * 2.2;
  }

  // Clair de lune : une lueur froide et large depuis la canopée.
  if (uMoon > 0.01) {
    float beam = exp(-pow((ang - 0.18) / 0.32, 2.0)) * exp(-r * 1.1);
    col += vec3(0.42, 0.55, 0.78) * beam * uMoon * (0.25 + fogA) * 0.5;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
