/**
 * Lanterne de pierre DANS la peinture (passe de scène, avant l'étalonnage) :
 * - occlusion : là où la peinture est plus proche que la pierre (carte de
 *   profondeur, seuil adouci), la peinture passe devant ;
 * - pied dans la mousse : bande basse au profil bruité (touffes) où le sol
 *   peint recouvre la pierre, et les frondes claires de la peinture un peu
 *   plus haut ; ombre portée vers le bas de la pierre ;
 * - ombre de contact douce sur la mousse autour du pied (quad élargi) ;
 * - lumière du lieu : teinte ambiante de la peinture alentour, légère
 *   désaturation et flou de distance, saison (neige sur le toit, mousse
 *   dorée d'automne, vert tendre du printemps), puis la MÊME atmosphère que
 *   la peinture (brume, rayons, lune) à la profondeur de la pierre.
 * Mode émissif (après étalonnage, ONE, ONE) : même masque, lueur seule.
 * Sert aussi au kodama assis sur le toit (sans pied ni ombre).
 */
import { ATMOSPHERE } from './atmosphere';
import { FRAMING, HASH, LUMA, PRECISION } from './common';

export const STONE_VERT = /* glsl */ `
${PRECISION}
${FRAMING}
attribute vec2 position;
uniform vec2 uAnchor;
uniform vec2 uSize;     // largeur, hauteur de la toile en unités de hauteur d'image
uniform float uZ;       // profondeur de la pierre (0 loin, 1 près)
uniform float uRot;
uniform float uAspect;
uniform vec4 uCell;
uniform vec3 uPad;      // marges du quad (ombre) : côtés, haut, bas — en fractions de la toile
varying vec2 vUv;
varying vec2 vCanvas;
varying vec2 vScreen;
void main() {
  vec2 c = vec2(mix(-uPad.x, 1.0 + uPad.x, position.x), mix(-uPad.y, 1.0 + uPad.z, position.y));
  vec2 local = (c - vec2(0.5, 1.0)) * uSize;
  float co = cos(uRot);
  float si = sin(uRot);
  local = vec2(co * local.x - si * local.y, si * local.x + co * local.y);
  vec2 p = uAnchor + vec2(local.x / uAspect, local.y) + parallaxOf(uZ);
  vUv = uCell.xy + c * uCell.zw;
  vCanvas = c;
  vScreen = sceneToScreen(p);
  gl_Position = screenToClip(vScreen);
}
`;

export const STONE_FRAG = /* glsl */ `
${PRECISION}
${FRAMING}
${HASH}
${LUMA}
${ATMOSPHERE}
varying vec2 vUv;
varying vec2 vCanvas;
varying vec2 vScreen;
uniform sampler2D uTex;
uniform sampler2D uColor;    // peinture du stade
uniform sampler2D uDepth;    // profondeur de la peinture
uniform sampler2D uMasks;
uniform float uZ;
uniform float uAlpha;
uniform float uReveal;       // dissolution : 0 caché → 1 entier
uniform float uEmissive;     // 0 = dans la scène (alpha prémultiplié), 1 = lueur additive
uniform vec3 uGlow;
uniform float uFoot;         // ligne du pied dans la toile (v, depuis le haut)
uniform float uGround;       // 1 = pied dans la mousse, 0 = rien (kodama)
uniform float uShadow;       // ombre de contact (0 = aucune)
uniform float uTexelV;       // 1 / hauteur de la toile (px)
uniform vec3 uSeasonK;       // x : automne, y : neige, z : printemps

float vnoise(float x, float seed) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash12(vec2(i, seed)), hash12(vec2(i + 1.0, seed)), f * f * (3.0 - 2.0 * f));
}

void main() {
  // Ce que montre la peinture sous ce pixel (même calcul que la passe de scène).
  vec2 uv = uCenter + (vScreen - 0.5) * uView;
  float d0 = texture2D(uDepth, uv, 2.5).r;
  vec2 suv = uv - parallaxOf(d0);
  float pd = texture2D(uDepth, suv, 1.5).r;
  float gap = texture2D(uMasks, suv).a;
  vec3 pc = texture2D(uColor, suv).rgb;
  vec3 pb = texture2D(uColor, suv, 3.0).rgb;

  vec2 c = vCanvas;
  float inside = step(0.0, c.x) * step(c.x, 1.0) * step(0.0, c.y) * step(c.y, 1.0);
  // Flou de distance très léger (biais de mip), comme la peinture alentour.
  vec4 tx = texture2D(uTex, vUv, 0.45) * inside;

  // Dissolution (changement de modèle).
  float mask = 1.0;
  float edge = 0.0;
  if (uReveal < 0.999) {
    vec2 q = clamp(c, 0.0, 1.0);
    float n = texture2D(uNoise, q * vec2(0.9, 1.4)).a * 0.6 + texture2D(uNoise, q * vec2(3.0, 4.5) + 0.31).b * 0.4;
    float field = n * 0.8 + (1.0 - q.y) * 0.2;
    float soft = 0.08;
    float front = uReveal * (1.0 + soft) - soft;
    mask = 1.0 - smoothstep(front, front + soft, field);
    edge = smoothstep(soft * 1.2, 0.0, abs(field - front - soft * 0.5)) * step(0.001, uReveal) * (1.0 - uReveal * uReveal);
  }

  // --- Occlusion par la profondeur : ce qui est peint plus près passe devant.
  float occD = smoothstep(uZ + 0.025, uZ + 0.075, pd);
  // --- Pied dans la mousse : touffes au profil bruité, frondes claires un peu plus haut.
  float up = uFoot - c.y;
  float tuft = 0.03 + 0.05 * vnoise(c.x * 6.0, 3.1) + 0.06 * pow(vnoise(c.x * 15.0, 7.7), 3.0);
  float ground = (1.0 - smoothstep(tuft - 0.012, tuft + 0.012, up)) * uGround;
  float leaf = smoothstep(0.012, 0.06, luma(pc) - luma(pb)) * (1.0 - smoothstep(0.07, 0.2, up)) * uGround;
  float occ = max(occD, max(ground, leaf * 0.9));
  float a = tx.a * mask * (1.0 - occ) * uAlpha;

  if (uEmissive > 0.5) {
    float fogA;
    atmosphere(vec3(0.0), suv, uZ, gap, 0.0, fogA);
    vec3 glow = (tx.rgb * mask + edge * tx.a * 1.6) * (1.0 - occ) * uGlow * uAlpha * (1.0 - fogA * 0.6);
    gl_FragColor = vec4(glow, 0.0);
    return;
  }

  vec3 rgb = tx.a > 0.002 ? tx.rgb / tx.a : vec3(0.0);
  // Saison : mousse dorée d'automne, vert tendre du printemps, neige posée sur le haut.
  float l = luma(rgb);
  float green = smoothstep(0.0, 0.05, rgb.g - max(rgb.r, rgb.b));
  if (uSeasonK.x > 0.001) rgb = mix(rgb, vec3(l * 1.25, l * 1.02, l * 0.55), uSeasonK.x * green * 0.45);
  if (uSeasonK.z > 0.001) rgb = mix(rgb, rgb * vec3(1.03, 1.1, 0.92), uSeasonK.z * green);
  if (uSeasonK.y > 0.001) {
    float above = texture2D(uTex, vUv - vec2(0.0, uTexelV * 5.0)).a;
    float cap = smoothstep(0.3, 0.85, tx.a - above);
    float lumps = 0.6 + 0.4 * sin(c.x * 90.0 + sin(c.y * 60.0) * 2.0);
    vec3 frost = vec3(l * 1.15 + 0.04) * vec3(0.88, 0.95, 1.06);
    // Mousse endormie sous le givre, comme celle du cèdre peint.
    rgb = mix(rgb, vec3(l), uSeasonK.y * green * 0.55);
    rgb = mix(rgb, frost, uSeasonK.y * 0.42);
    rgb = mix(rgb, vec3(0.86, 0.9, 0.96), uSeasonK.y * cap * lumps);
  }
  // Lumière du lieu : teinte ambiante de la peinture alentour, désaturation légère.
  vec3 env = texture2D(uColor, suv, 5.0).rgb;
  vec3 tint = env / max(luma(env), 0.03);
  rgb = mix(rgb, rgb * clamp(tint, 0.0, 2.0), 0.28);
  rgb = mix(vec3(luma(rgb)), rgb, 0.86);
  // Le bas de la pierre, près du sol, reçoit moins de lumière.
  rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.22, up * uGround + (1.0 - uGround)));
  float fogA;
  rgb = atmosphere(rgb, suv, uZ, gap, 0.3, fogA);
  rgb += uGlow * edge * 1.2;

  // Ombre de contact : ellipse douce sous le pied ; pas sur ce qui passe devant ni sur les frondes claires.
  vec2 sd = vec2((c.x - 0.5) / 0.6, (c.y - uFoot) / 0.075);
  float sh = exp(-dot(sd, sd) * 1.4) * uShadow * (1.0 - occD) * (1.0 - leaf * 0.6) * (1.0 - fogA) * uAlpha;
  gl_FragColor = vec4(rgb * a, a + sh * (1.0 - a));
}
`;
