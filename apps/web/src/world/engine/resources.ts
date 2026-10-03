/**
 * Ressources GPU du monde : chargement paresseux, replis, comptabilité mémoire.
 * Budget visé < 60 MB : un seul stade résident (deux pendant la croissance),
 * profondeur et masques réduits, gardien chargé à la demande puis libéré.
 */
import { Texture, type OGLRenderingContext } from 'ogl';
import type { GrowthStage, LutName, WorldManifest } from '../types';
import { buildFxAtlas, type FxAtlasMap } from './atlas';
import { synthesizeMaps, type DataMap } from './fallbackMaps';
import { decodeImage, imageSize, opaqueBounds, releaseImage, spriteCell, type Decoded } from './loader';
import { makeNoiseData } from './noise';
import type { SpriteAsset } from './spirits';

type TexImage = Decoded | Uint8Array;

export interface StageTextures {
  stage: GrowthStage;
  color: Texture;
  depth: Texture;
  /** Profondeur réelle (true) ou synthétique (false). */
  realDepth: boolean;
}

export class Resources {
  readonly noise: Texture;
  masks: Texture | null = null;
  realMasks = false;
  foreground: Texture | null = null;
  atlas: { tex: Texture; map: FxAtlasMap } | null = null;
  private luts = new Map<LutName, Texture | null>();
  private lutLoads = new Map<LutName, Promise<Texture | null>>();
  private bytes = new Map<Texture, number>();
  private disposed = false;

  constructor(
    private readonly gl: OGLRenderingContext,
    private readonly manifest: WorldManifest,
  ) {
    const size = 256;
    this.noise = this.texture(makeNoiseData(size), { w: size, h: size, wrap: true, mips: false });
  }

  get memoryMB(): number {
    let b = 0;
    for (const v of this.bytes.values()) b += v;
    return b / (1024 * 1024);
  }

  texture(img: TexImage, o: { w?: number; h?: number; mips?: boolean; wrap?: boolean; premult?: boolean } = {}): Texture {
    if (this.disposed) {
      releaseImage(img instanceof Uint8Array ? null : img);
      throw new Error('disposed');
    }
    const gl = this.gl;
    const mips = o.mips ?? false;
    const size = img instanceof Uint8Array ? { w: o.w ?? 1, h: o.h ?? 1 } : imageSize(img);
    const t = new Texture(gl, {
      image: img as unknown as HTMLImageElement,
      width: size.w,
      height: size.h,
      generateMipmaps: mips,
      minFilter: mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: o.wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE,
      wrapT: o.wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE,
      flipY: false,
      premultiplyAlpha: o.premult ?? false,
      unpackAlignment: 1,
    });
    t.update();
    releaseImage(img instanceof Uint8Array ? null : img);
    this.bytes.set(t, size.w * size.h * 4 * (mips ? 1.34 : 1));
    return t;
  }

  dataTexture(m: DataMap): Texture {
    return this.texture(m.data, { w: m.width, h: m.height });
  }

  free(t: Texture | null | undefined) {
    if (!t) return;
    this.gl.deleteTexture(t.texture);
    this.bytes.delete(t);
  }

  /** Charge un stade (couleur + profondeur réelle ou synthétique). */
  async loadStage(stage: GrowthStage): Promise<StageTextures> {
    const img = this.manifest.stages[stage];
    const colorImg = await decodeImage(img.color, { kind: 'color', maxWidth: 1280 });
    let depth: Texture | null = null;
    let realDepth = false;
    if (img.depth) {
      try {
        depth = this.texture(await decodeImage(img.depth, { kind: 'data', maxWidth: 512 }), { mips: true });
        realDepth = true;
      } catch {
        depth = null;
      }
    }
    if (!depth || !this.realMasks) {
      const synth = synthesizeMaps(colorImg);
      if (synth) {
        if (!depth) depth = this.dataTexture(synth.depth);
        if (!this.realMasks) {
          this.free(this.masks);
          this.masks = this.dataTexture(synth.masks);
        }
      }
    }
    if (!depth) depth = this.dataTexture({ data: new Uint8Array([128, 128, 128, 255]), width: 1, height: 1 });
    if (this.disposed) throw new Error('disposed');
    const color = this.texture(colorImg, { mips: true });
    return { stage, color, depth, realDepth };
  }

  async loadMasks(): Promise<void> {
    if (!this.manifest.masks) return;
    try {
      const m = await decodeImage(this.manifest.masks, { kind: 'data', maxWidth: 768 });
      this.free(this.masks);
      this.masks = this.texture(m);
      this.realMasks = true;
    } catch {
      /* repli : masques synthétiques au chargement du stade */
    }
  }

  async loadForeground(): Promise<void> {
    if (!this.manifest.foreground) return;
    try {
      this.foreground = this.texture(await decodeImage(this.manifest.foreground, { kind: 'sprite', maxWidth: 1024 }), { mips: true });
    } catch {
      this.foreground = null;
    }
  }

  get hasAnyLut(): boolean {
    return Object.values(this.manifest.luts).some((u) => !!u);
  }

  lut(name: LutName): Texture | null {
    return this.luts.get(name) ?? null;
  }

  loadLut(name: LutName): Promise<Texture | null> {
    const url = this.manifest.luts[name];
    if (!url) return Promise.resolve(null);
    let p = this.lutLoads.get(name);
    if (!p) {
      p = decodeImage(url, { kind: 'data' })
        .then((img) => {
          const t = this.texture(img);
          this.luts.set(name, t);
          return t;
        })
        .catch(() => null);
      this.lutLoads.set(name, p);
    }
    return p;
  }

  /** `sheet` : planche non découpée possible (stub kodama) → une seule case. */
  async sprite(url: string, index = 0, sheet = false): Promise<SpriteAsset | null> {
    if (!url) return null;
    try {
      const img = await decodeImage(url, { kind: 'sprite', maxWidth: 768 });
      const cell: [number, number, number, number] = sheet ? spriteCell(img, index) : [0, 0, 1, 1];
      const rect = opaqueBounds(img, cell);
      const s = imageSize(img);
      const aspect = (rect[2] * s.w) / (rect[3] * s.h);
      return { tex: this.texture(img, { mips: true, premult: true }), rect, aspect };
    } catch {
      return null;
    }
  }

  async loadAtlas(): Promise<void> {
    if (!this.manifest.fx) return;
    try {
      const built = await buildFxAtlas(this.manifest.fx);
      if (!built || this.disposed) return;
      const t = this.texture(built.canvas as unknown as Decoded, { mips: false, premult: true });
      this.atlas = { tex: t, map: built.map };
    } catch {
      this.atlas = null;
    }
  }

  dispose() {
    this.disposed = true;
    for (const t of [...this.bytes.keys()]) this.free(t);
  }
}
