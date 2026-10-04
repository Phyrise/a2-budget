/**
 * Étalonnage final : étalonnage procédural léger (humeur), LUT 3D 33³ en bande
 * 1089×33 (pixel x = r + 33·b, y = g) avec interpolation trilinéaire manuelle
 * entre tranches b, fondu entre LUT courante et cible, nuit de repli
 * (assombrissement bleu) si la LUT nuit est absente, vignette et grain fin.
 */
import { HASH, LUMA, PRECISION } from './common';

export const POST_FRAG = /* glsl */ `
${PRECISION}
${HASH}
${LUMA}
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uLutA;
uniform sampler2D uLutB;
uniform float uHasA;
uniform float uHasB;
uniform float uLutMix;
uniform float uNightProc;
uniform float uExposure;
uniform float uSaturation;
uniform float uWarmth;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform vec2  uRes;
uniform vec3  uTint;        // teinte de saison (multiplicative, très légère)

vec3 lut(sampler2D t, vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float b = c.b * 32.0;
  float b0 = floor(b);
  float b1 = min(b0 + 1.0, 32.0);
  float x = c.r * 32.0 + 0.5;
  float y = (c.g * 32.0 + 0.5) / 33.0;
  vec3 s0 = texture2D(t, vec2((b0 * 33.0 + x) / 1089.0, y)).rgb;
  vec3 s1 = texture2D(t, vec2((b1 * 33.0 + x) / 1089.0, y)).rgb;
  return mix(s0, s1, b - b0);
}

void main() {
  vec3 c = texture2D(uScene, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  // Étalonnage procédural (neutre lorsque des LUT sont fournies).
  c *= exp2(uExposure);
  float l = luma(c);
  c = mix(vec3(l), c, uSaturation);
  c += vec3(0.6, 0.15, -0.55) * uWarmth * (0.35 + 0.65 * l);

  vec3 a = uHasA > 0.5 ? lut(uLutA, c) : c;
  vec3 b = uHasB > 0.5 ? lut(uLutB, c) : c;
  c = mix(a, b, uLutMix);

  c *= uTint;

  if (uNightProc > 0.001) {
    float nl = luma(c);
    vec3 night = vec3(0.52, 0.66, 1.0) * pow(nl, 1.2) * 0.62 + vec3(0.004, 0.012, 0.03);
    c = mix(c, night, uNightProc);
  }

  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  float v = smoothstep(1.05, 0.25, length(q * vec2(0.9, 1.0)));
  c *= mix(1.0, v, uVignette);

  float g = hash12(vUv * uRes + uSeed * 97.0) - 0.5;
  c += g * uGrain * (0.6 + 0.4 * (1.0 - luma(c)));
  gl_FragColor = vec4(c, 1.0);
}
`;
