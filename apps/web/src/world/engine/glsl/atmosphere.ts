/**
 * Atmosphère de la forêt, partagée par la passe peinture et la lanterne de
 * pierre : brume en nappes modulée par la profondeur, rayons depuis la
 * canopée et leurs poussières, clair de lune, lumière portée de la lanterne.
 * Un objet posé dans la scène (la lanterne) reçoit ainsi EXACTEMENT la même
 * brume et la même lumière que la peinture à sa profondeur.
 *
 * À inclure après PRECISION ; déclare ses uniformes (uNoise, uTime, uAspect
 * compris), partagés entre les programmes (mêmes objets OGL, pipeline.ts).
 */
export const ATMOSPHERE = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uAspect;      // largeur / hauteur de l'image
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
uniform float uMoon;
uniform float uDetail;      // 0 = palier bas (moins d'échantillons)
uniform vec4  uLantern;     // lanterne : x, y, rayon (hauteur d'image), intensité
uniform vec3  uLanternColor;

/**
 * col : couleur posée ; suv : point de la peinture (après parallaxe) ;
 * depth : profondeur de ce qui est vu (0 loin, 1 près) ; gap : trouée de
 * lumière (masque A) ; lampK : part de la lumière portée de la lanterne.
 */
vec3 atmosphere(vec3 col, vec2 suv, float depth, float gap, float lampK, out float fogA) {
  vec2 iso = vec2(uAspect, 1.0);
  float t = uTime;
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
  fogA = clamp(density * 0.55, 0.0, 0.45);

  // --- Rayons depuis la canopée.
  vec2 dv = (suv - uLight) * iso;
  float r = length(dv);
  float ang = atan(dv.x, dv.y);
  vec4 dang = (vec4(ang) - uRayAng) / uRayWidth;
  float ray = dot(exp(-dang * dang), uRayW);
  float streak = texture2D(uNoise, vec2(ang * 2.6, r * 0.12 - t * 0.006)).g;
  float pulse = 0.82 + 0.18 * sin(t * 0.45) * sin(t * 0.17 + 1.3);
  ray *= (0.55 + 0.9 * streak) * smoothstep(0.02, 0.2, r) * exp(-r * 0.9) * pulse;
  ray *= 0.45 + 0.55 * (1.0 - depth) + 0.5 * gap;
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

  // Lanterne : lumière chaude portée sur la mousse et les racines alentour.
  if (uLantern.w > 0.001 && lampK > 0.0) {
    vec2 lv = (suv - uLantern.xy) * iso * vec2(1.0, 1.6);
    float lf = exp(-dot(lv, lv) / (uLantern.z * uLantern.z)) * uLantern.w * lampK;
    // Lumière orangée : le vert de la mousse ne doit pas virer au jaune acide.
    vec3 lc = uLanternColor * vec3(1.0, 0.78, 0.6);
    col += col * lc * lf * 0.75 + lc * lf * (0.035 + fogA * 0.06);
  }
  return col;
}
`;
