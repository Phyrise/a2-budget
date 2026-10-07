/**
 * Une image du monde : avance les horloges et les transitions, calcule les
 * uniformes, remplit les lots, puis dessine (draw.ts).
 */
import { drawFrame } from './draw';
import type { WorldEngine } from './Engine';
import { festivalKodama, festivalOf } from './festival';
import { approachParams, cloneParams, kodamaCount } from './moods';
import { BURST, MOTES, RAIN } from './pipeline';
import { approachLook, seasonLook } from './paint';
import { avoidList, particleSeason } from './seasons';

const TIER_PARTICLES = [1, 0.7, 0.4];
const TIER_FOG_LAYERS = [3, 2, 1];
const smoothstep = (k: number) => k * k * (3 - 2 * k);
const mix3 = (a: number[], b: number[], k: number): [number, number, number] => [
  a[0]! + (b[0]! - a[0]!) * k,
  a[1]! + (b[1]! - a[1]!) * k,
  a[2]! + (b[2]! - a[2]!) * k,
];

export function renderWorld(e: WorldEngine, n: number, dt: number, fps: number) {
  const s = e.state;
  if (!s || !e.stage) return;
  const m = e.cfg.manifest;
  const aspect = m.size.w / m.size.h;
  const animate = e.animated;
  const stillLive = !animate && e.cfg.motion === 'still' && e.cfg.live;
  const motionK = e.cfg.motion === 'gentle' ? 0.5 : animate ? 1 : 0;
  const tier = e.tier;
  void fps;

  if (animate) e.t += dt;
  const t = e.t;

  // --- Ambiance (humeur, nuit) : lente en direct, courte en « immobile », immédiate en bandeau.
  const nightTarget = s.paused ? 1 : 0;
  if (animate || stillLive) {
    const tau = animate ? 1 : 0.2;
    approachParams(e.mood, e.target, dt, tau);
    e.night += (nightTarget - e.night) * (1 - Math.exp(-dt / tau));
    if (Math.abs(nightTarget - e.night) < 1e-3) e.night = nightTarget;
  } else {
    e.mood = cloneParams(e.target);
    e.night = nightTarget;
  }
  const mood = e.mood;
  const night = e.night;
  // Regard de la saison peinte : suit le fondu de peinture (≈ 2,6 s), immédiat en image fixe.
  const painted = e.paintedSeason;
  approachLook(e.look, seasonLook(painted), dt, animate ? 0.9 : 0.2, !animate && !stillLive);
  const look = e.look;

  // --- Croissance.
  let grow = 1;
  if (e.growStart >= 0) {
    const k = (n - e.growStart) / e.growDur;
    if (k >= 1 || (!animate && !stillLive)) e.disposePrev();
    else grow = smoothstep(Math.max(0, k));
  }

  // --- Gardien.
  const g = e.spirits.guardianFrame(n);
  if (!g.active && e.spirits.guardian) e.releaseGuardian();

  // --- Lumières qui se posent : souffle de vent, éclat de rayon, kodama attentif.
  e.lights.update(n);
  for (const land of e.lights.landed.splice(0)) {
    e.gust = Math.max(e.gust, land.strong ? 1.8 : 1);
    e.rayBoost = Math.max(e.rayBoost, land.strong ? 0.85 : 0.5);
    e.spirits.lookAt(land.x, land.y, n, land.strong);
    e.fx.gust(n, land.strong ? 2.2 : 1);
    // Un pulse sur deux (toujours une corvée) fait tourbillonner les feuilles.
    if (land.strong || e.fx.coin()) e.seasons.stir(land.x, land.y - 0.03, land.strong ? 1 : 0.6, n);
  }

  // --- Lanterne : progression lissée, floraison (souffle, éclat de rayon).
  e.lantern.update(dt, n, animate || stillLive, stillLive);
  e.stone.update(n, animate, e.lantern.blooming(n));
  if (e.lantern.bloomEvent) {
    e.lantern.bloomEvent = false;
    if (animate) {
      e.gust = Math.max(e.gust, 0.9);
      e.rayBoost = Math.max(e.rayBoost, 0.7);
    }
  }
  // --- Matsuri (anniversaire du couple) : lampions, lucioles, kodama (festival.ts).
  const festival = festivalOf(e, aspect);
  const fest = festival.update(s.festival === true, n, dt, t, animate);
  e.gust *= animate ? Math.exp(-dt / 1.3) : 0;
  e.rayBoost *= animate ? Math.exp(-dt / 1.6) : 0;

  // --- Parallaxe : respiration lente + doigt / souris, lissées.
  const p = e.pointer;
  const pk = 1 - Math.exp(-dt / 0.45);
  p.x += (p.tx * motionK - p.x) * pk;
  p.y += (p.ty * motionK - p.y) * pk;
  const auto = animate && e.cfg.motion === 'full';
  let px = (auto ? Math.sin(t * 0.13) * 0.0045 + Math.sin(t * 0.051 + 2) * 0.0015 : 0) - p.x * 0.012;
  let py = (auto ? Math.sin(t * 0.09 + 1) * 0.0022 : 0) - p.y * 0.006;
  const mag = Math.hypot(px, py);
  if (mag > 0.015) {
    px *= 0.015 / mag;
    py *= 0.015 / mag;
  }
  const f = e.framing;
  const fr = e.pipe.frame;
  fr.uCenter.value = [f.cx, f.cy];
  fr.uView.value = [f.vw, f.vh];
  fr.uPar.value = [px * f.vw, py * f.vw * aspect];

  // --- Passe peinture.
  const fogBase = mix3([0.5, 0.58, 0.57], [0.7, 0.73, 0.68], mood.fogLift);
  const fogDay: [number, number, number] = [fogBase[0] * look.fogTint[0], fogBase[1] * look.fogTint[1], fogBase[2] * look.fogTint[2]];
  const fogColor = mix3(fogDay, [0.13, 0.19, 0.27], night);
  const mirror = m.lightSource.x > 0.5 ? 1 : -1;
  const baseAng = [-0.36, -0.16, 0.03, -0.56];
  const rayAngles = baseAng.map((a, i) => (a + Math.sin(t * 0.031 + i * 1.7) * 0.018) * mirror);
  const day = 1 - night;
  const hasRaysFx = e.fx.hasRays;
  const sc = e.pipe.scene.program.uniforms;
  sc.uColor!.value = e.stage.color;
  sc.uDepth!.value = e.stage.depth;
  sc.uPrev!.value = e.prev?.color ?? e.stage.color;
  sc.uGrow!.value = e.prev ? grow : 1;
  sc.uFadeMode!.value = e.fadeMode;
  if (e.res.masks) sc.uMasks!.value = e.res.masks;
  sc.uTime!.value = t;
  sc.uWind!.value = (0.9 * mood.wind + e.gust * 1.4) * Math.max(motionK, animate ? 0 : 0.5) * g.windScale * look.wind;
  sc.uWater!.value = 1;
  sc.uFog!.value = mood.fog * (e.fx.hasFog ? 0.7 : 1) * (1 - night * 0.25);
  sc.uFogLift!.value = mood.fogLift;
  sc.uFogLayers!.value = TIER_FOG_LAYERS[tier] ?? 1;
  sc.uFogColor!.value = fogColor;
  sc.uFogGlow!.value = g.fogGlow * 0.55;
  sc.uRays!.value = (mood.rays * day + e.rayBoost + g.fogGlow * 0.15) * (hasRaysFx ? 0.38 : 1);
  sc.uRayW!.value = [mood.ray0, mood.ray1, mood.ray2, mood.ray3];
  sc.uRayAng!.value = rayAngles;
  sc.uRayWidth!.value = [0.075, 0.05, 0.06, 0.045];
  sc.uLight!.value = [m.lightSource.x, m.lightSource.y];
  sc.uRayColor!.value = mix3([1, 0.94, 0.8], [1, 0.84, 0.58], mood.gold * 0.6);
  sc.uSparkle!.value = mood.sparkle * (1 - night * 0.7) * look.sparkle;
  sc.uMoss!.value = (mood.moss * day + s.growthProgress * 0.12 * day) * look.moss;
  sc.uMoon!.value = night * 0.9;
  sc.uDetail!.value = tier < 2 ? 1 : 0;
  const lamp = e.lantern.sceneLight(n, t, animate);
  sc.uLantern!.value = lamp.light;
  sc.uLanternColor!.value = lamp.color;

  // --- Étalonnage.
  const pu = e.pipe.post.program.uniforms;
  const lutA = e.res.lut(e.lutA.url);
  const lutB = e.res.lut(e.lutB.url);
  pu.uAmtA!.value = e.lutA.amount;
  pu.uAmtB!.value = e.lutB.amount;
  pu.uHasA!.value = lutA ? 1 : 0;
  pu.uHasB!.value = lutB ? 1 : 0;
  if (lutA) pu.uLutA!.value = lutA;
  if (lutB) pu.uLutB!.value = lutB;
  pu.uLutMix!.value = e.lutMix(n);
  // Nuit procédurale tant que la LUT cible (nuit de saison ou de base) n'est pas en mémoire.
  pu.uNightProc!.value = night > 0 && !lutB ? night : 0;
  const proc = e.res.hasAnyLut ? 0 : 1;
  pu.uExposure!.value = mood.exposure * proc + g.fogGlow * 0.06;
  pu.uSaturation!.value = 1 + (mood.saturation - 1) * proc;
  pu.uWarmth!.value = mood.warmth * proc * day;
  pu.uVignette!.value = e.cfg.variant === 'banner' ? 0.3 : 0.42;
  pu.uGrain!.value = tier < 2 ? 0.022 : 0;
  pu.uSeed!.value = animate ? (t * 7.31) % 1 : 0;
  pu.uRes!.value = [e.pipe.target.width, e.pipe.target.height];
  // Particules de la saison peinte (pas de feuilles d'automne sur la peinture d'été en cours de chargement).
  const ps = particleSeason(m, s.season, painted);
  const sf = e.seasons.frame(ps, n, animate, night, painted !== 'summer', mood.rain);
  pu.uTint!.value = sf.tint;

  // --- Fougères du premier plan.
  const fg = e.pipe.fg.program.uniforms;
  if (e.res.foreground) fg.uFg!.value = e.res.foreground;
  fg.uTime!.value = t;
  fg.uSway!.value = motionK * (0.75 + e.gust * 1.6) * g.windScale * look.fgSway;
  fg.uFgSeason!.value = look.fg;
  fg.uFogColor!.value = fogColor;
  fg.uFogMix!.value = mood.fog * 0.07 + night * 0.05;

  // --- Esprits.
  const spots = m.kodamaSpots.length;
  e.spirits.update(n, dt, festivalKodama(kodamaCount(s.mood, spots, s.paused), spots, fest), s.creatures, animate || stillLive);
  // Lanterne de pierre d'abord (au loin, sous les kodama des racines), puis les esprits.
  const sprites = [
    ...e.stone.draws(n, t, e.lantern.litLevel(n), night, mood.fog, animate),
    ...e.spirits.draws(n, night, mood.fog, g),
    ...festival.draws(e.res, night),
  ];

  // --- Lots additifs.
  e.pipe.sceneFx.reset();
  e.fx.update(n, mood, animate);
  e.fx.emit(e.pipe.sceneFx, n, t, mood, night, rayAngles, e.rayBoost, g.fogGlow);
  e.pipe.emissive.reset();
  e.spirits.emitHalos(e.pipe.emissive, t, night, e.fx.atlas);
  e.lights.emit(e.pipe.emissive, n, t, night, 1, aspect);
  e.lantern.emit(e.pipe.emissive, n, t, night, animate);
  e.stone.emitNight(e.pipe.emissive, t, night);
  festival.emit(e.pipe.emissive, night);

  // --- Particules.
  const sizeK = e.dpr * Math.min(1.4, Math.max(0.75, e.cssH / 700));
  const tierK = TIER_PARTICLES[tier] ?? 0.4;
  // Été : lucioles plus nombreuses le soir (même lot que les spores).
  const flies = Math.max(sf.fireflies, fest);
  const motesCount = Math.min(MOTES, (mood.spores + s.growthProgress * 8) * day + 18 * night + 30 * sf.fireflies + 24 * fest) * tierK;
  const mu = e.pipe.motes.program.uniforms;
  mu.uTime!.value = t;
  mu.uCount!.value = motesCount;
  mu.uNight!.value = Math.max(night, flies);
  mu.uGold!.value = mood.gold;
  mu.uSizeK!.value = sizeK;
  mu.uIntensity!.value = 1 + 0.6 * flies;
  const rainCount = mood.rain * look.rain * day * RAIN * tierK;
  const ru = e.pipe.rain.program.uniforms;
  ru.uTime!.value = t;
  ru.uCount!.value = rainCount;
  ru.uSizeK!.value = sizeK;
  // Saisons : feuilles, neige, pétales (dans la scène) ; posés au sol en image fixe.
  const seasonK = sf.rest ? 1 : tierK * (e.cfg.motion === 'gentle' ? 0.7 : 1);
  const seasonCount = sf.code < 0 ? 0 : sf.count * seasonK;
  if (seasonCount > 0.5) {
    const su = e.pipe.season.program.uniforms;
    su.uTime!.value = t * (e.cfg.motion === 'gentle' ? 0.7 : 1);
    su.uSizeK!.value = sizeK;
    su.uFogColor!.value = fogColor;
    su.uFog!.value = mood.fog;
    e.seasons.uniforms(su, sf, n, avoidList(e.kodamaSpots, (i) => e.spirits.visibility(i)), e.gust);
    su.uCount!.value = seasonCount;
  }
  const bu = e.pipe.burst.program.uniforms;
  if (g.burst > 0) {
    const box = e.spirits.guardianBox();
    bu.uTime!.value = t;
    bu.uBurst!.value = g.burst;
    bu.uCount!.value = BURST;
    bu.uRect!.value = [box[0], box[1], box[2] / aspect, box[3]];
    bu.uDepth!.value = m.guardianSpot.depth;
    bu.uSizeK!.value = sizeK;
  }

  drawFrame(e.renderer, e.pipe, {
    sprites,
    fogColor,
    stoneSeason: look.fg,
    hasForeground: !!e.res.foreground,
    drawRain: animate && rainCount > 1,
    drawBurst: g.burst > 0,
    drawMotes: motesCount > 0.5,
    drawSeason: seasonCount > 0.5,
  });
}
