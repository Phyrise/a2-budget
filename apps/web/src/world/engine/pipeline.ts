/**
 * Programmes et maillages OGL du monde, avec leurs uniformes partagés.
 * Un seul endroit où l'on crée de l'état GPU (reconstruit après une perte de
 * contexte en recréant tout le moteur).
 */
import { Geometry, Mesh, Program, RenderTarget, Triangle, type OGLRenderingContext, type Texture } from 'ogl';
import { BillboardBatch } from './batch';
import { FULLSCREEN_VERT } from './glsl/common';
import { FOREGROUND_FRAG, SPRITE_FRAG, SPRITE_VERT } from './glsl/layers';
import { POINTS_FRAG, POINTS_VERT } from './glsl/points';
import { POST_FRAG } from './glsl/post';
import { SCENE_FRAG } from './glsl/scene';
import { SEASON_FRAG, SEASON_VERT } from './glsl/season';
import { SEASON, restPoints } from './seasons';
import { rng } from './noise';

type U = { value: unknown };
const u = (value: unknown): U => ({ value });

export const MOTES = 72;
export const BURST = 56;
export const RAIN = 110;

function pointsGeometry(gl: OGLRenderingContext, n: number, seed: number): Geometry {
  const r = rng(seed);
  const s = new Float32Array(n * 4);
  const idx = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) s[i * 4 + k] = r();
    idx[i] = i;
  }
  return new Geometry(gl, { aSeed: { size: 4, data: s }, aIdx: { size: 1, data: idx } });
}

export class Pipeline {
  readonly frame = { uCenter: u([0.5, 0.5]), uView: u([1, 1]), uPar: u([0, 0]) };
  readonly scene: Mesh;
  readonly post: Mesh;
  readonly fg: Mesh;
  readonly sprite: Mesh;
  readonly spriteGlow: Mesh;
  readonly sceneFx: BillboardBatch;
  readonly emissive: BillboardBatch;
  readonly motes: Mesh;
  readonly burst: Mesh;
  readonly rain: Mesh;
  readonly season: Mesh;
  target: RenderTarget;

  constructor(
    private readonly gl: OGLRenderingContext,
    noise: Texture,
    blank: Texture,
    aspect: number,
    texel: number,
  ) {
    const f = this.frame;
    const tri = new Triangle(gl);
    const common = { transparent: false, depthTest: false, depthWrite: false, cullFace: false as const };

    const sceneProgram = new Program(gl, {
      ...common,
      vertex: FULLSCREEN_VERT,
      fragment: SCENE_FRAG,
      uniforms: {
        ...f,
        uColor: u(blank), uPrev: u(blank), uDepth: u(blank), uMasks: u(blank), uNoise: u(noise),
        uTime: u(0), uAspect: u(aspect), uTexel: u(texel), uGrow: u(1), uWind: u(1), uWater: u(1),
        uFog: u(0.5), uFogLift: u(0.3), uFogLayers: u(3), uFogColor: u([0.6, 0.66, 0.64]), uFogGlow: u(0),
        uRays: u(0.4), uRayW: u([1, 0, 0, 0]), uRayAng: u([0, 0, 0, 0]), uRayWidth: u([0.08, 0.08, 0.08, 0.08]),
        uLight: u([0.6, 0.02]), uRayColor: u([1, 0.94, 0.8]), uSparkle: u(0), uMoss: u(0), uMoon: u(0), uDetail: u(1),
        uLantern: u([0.5, 0.6, 0.1, 0]), uLanternColor: u([1, 0.8, 0.5]),
      },
    });
    this.scene = new Mesh(gl, { geometry: tri, program: sceneProgram, frustumCulled: false });

    const postProgram = new Program(gl, {
      ...common,
      vertex: FULLSCREEN_VERT,
      fragment: POST_FRAG,
      uniforms: {
        uScene: u(blank), uLutA: u(blank), uLutB: u(blank), uHasA: u(0), uHasB: u(0), uLutMix: u(0),
        uNightProc: u(0), uExposure: u(0), uSaturation: u(1), uWarmth: u(0), uVignette: u(0.4),
        uGrain: u(0.025), uSeed: u(0), uRes: u([1, 1]), uTint: u([1, 1, 1]),
      },
    });
    this.post = new Mesh(gl, { geometry: tri, program: postProgram, frustumCulled: false });

    const fgProgram = new Program(gl, {
      ...common,
      transparent: true,
      vertex: FULLSCREEN_VERT,
      fragment: FOREGROUND_FRAG,
      uniforms: {
        ...f, uFg: u(blank), uTime: u(0), uSway: u(1), uTexel: u(texel), uFgDepth: u(1.3),
        uFogColor: u([0.6, 0.66, 0.64]), uFogMix: u(0),
      },
    });
    fgProgram.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.fg = new Mesh(gl, { geometry: tri, program: fgProgram, frustumCulled: false });

    const quad = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) },
      index: { data: new Uint16Array([0, 2, 1, 1, 2, 3]) },
    });
    const spriteUniforms = () => ({
      ...f,
      uAnchor: u([0.5, 0.5]), uSize: u([0.05, 0.05]), uDepth: u(0.5), uRot: u(0), uAspect: u(aspect), uCell: u([0, 0, 1, 1]),
      uTex: u(blank), uNoise: u(noise), uAlpha: u(1), uReveal: u(1), uEmissive: u(0), uGlow: u([1, 1, 1]),
      uFogColor: u([0.6, 0.66, 0.64]), uFogMix: u(0),
    });
    const spriteProgram = new Program(gl, { ...common, transparent: true, vertex: SPRITE_VERT, fragment: SPRITE_FRAG, uniforms: spriteUniforms() });
    spriteProgram.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.sprite = new Mesh(gl, { geometry: quad, program: spriteProgram, frustumCulled: false });
    const glowUniforms = spriteUniforms();
    glowUniforms.uEmissive.value = 1;
    const glowProgram = new Program(gl, { ...common, transparent: true, vertex: SPRITE_VERT, fragment: SPRITE_FRAG, uniforms: glowUniforms });
    glowProgram.setBlendFunc(gl.ONE, gl.ONE);
    this.spriteGlow = new Mesh(gl, { geometry: quad, program: glowProgram, frustumCulled: false });

    const batchUniforms = () => ({ ...f, uAspect: u(aspect), uAtlas: u(blank) });
    this.sceneFx = new BillboardBatch(gl, 64, batchUniforms());
    this.emissive = new BillboardBatch(gl, 160, batchUniforms());

    const pointsUniforms = (mode: number) => ({
      ...f,
      uTime: u(0), uCount: u(0), uNight: u(0), uGold: u(0), uMode: u(mode), uBurst: u(0), uRect: u([0.3, 0.6, 0.2, 0.4]),
      uDepth: u(0.4), uSizeK: u(1), uIntensity: u(1), uAtlas: u(blank), uSprite: u([0, 0, 0, 0]),
    });
    const pointsProgram = (mode: number) => {
      const p = new Program(gl, { ...common, transparent: true, vertex: POINTS_VERT, fragment: POINTS_FRAG, uniforms: pointsUniforms(mode) });
      p.setBlendFunc(gl.ONE, gl.ONE);
      return p;
    };
    this.motes = new Mesh(gl, { geometry: pointsGeometry(gl, MOTES, 91), program: pointsProgram(0), mode: gl.POINTS, frustumCulled: false });
    this.burst = new Mesh(gl, { geometry: pointsGeometry(gl, BURST, 17), program: pointsProgram(1), mode: gl.POINTS, frustumCulled: false });
    this.rain = new Mesh(gl, { geometry: pointsGeometry(gl, RAIN, 5), program: pointsProgram(2), mode: gl.POINTS, frustumCulled: false });

    // Saisons : dans la scène (avant étalonnage), alpha prémultiplié.
    const seasonProgram = new Program(gl, {
      ...common,
      transparent: true,
      vertex: SEASON_VERT,
      fragment: SEASON_FRAG,
      uniforms: {
        ...f,
        uTime: u(0), uCount: u(0), uSeason: u(1), uSizeK: u(1), uAspect: u(aspect), uGust: u(0),
        uWhirl: u([0, 0, 0, 0.16]), uWhirlK: u(0), uAvoid: u(Array.from({ length: 6 }, () => [0, 0, 0, 0])),
        uRest: u(0), uRestPts: u(restPoints()), uRestCount: u(0),
      },
    });
    seasonProgram.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.season = new Mesh(gl, { geometry: pointsGeometry(gl, SEASON, 333), program: seasonProgram, mode: gl.POINTS, frustumCulled: false });

    this.target = this.makeTarget(2, 2);
  }

  private makeTarget(w: number, h: number) {
    const gl = this.gl;
    return new RenderTarget(gl, { width: w, height: h, depth: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
  }

  resizeTarget(w: number, h: number) {
    if (this.target.width === w && this.target.height === h) return;
    this.target.setSize(w, h);
  }
}
