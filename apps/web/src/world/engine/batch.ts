/**
 * Lot instancié de quads additifs, rempli sur le CPU à chaque image
 * (quelques dizaines d'instances : négligeable).
 */
import { Geometry, Mesh, Program, type OGLRenderingContext, type Texture } from 'ogl';
import { BILLBOARD_FRAG, BILLBOARD_VERT } from './glsl/layers';

export type Rect = readonly [number, number, number, number];

/** Modes procéduraux (sans texture peinte). */
export const GLOW: Rect = [0, 0, 0, 0];
export const STREAK: Rect = [0, 0, -1, 0];
export const WEDGE: Rect = [0, 0, -2, 0];

export interface BillboardWriter {
  push(
    x: number,
    y: number,
    depth: number,
    w: number,
    h: number,
    rot: number,
    r: number,
    g: number,
    b: number,
    a: number,
    rect: Rect,
  ): void;
}

export class BillboardBatch implements BillboardWriter {
  readonly mesh: Mesh;
  readonly program: Program;
  private readonly geometry: Geometry;
  private readonly pos: Float32Array;
  private readonly size: Float32Array;
  private readonly rot: Float32Array;
  private readonly color: Float32Array;
  private readonly rect: Float32Array;
  count = 0;

  constructor(
    gl: OGLRenderingContext,
    readonly capacity: number,
    uniforms: Record<string, { value: unknown }>,
  ) {
    this.pos = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity * 2);
    this.rot = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 4);
    this.rect = new Float32Array(capacity * 4);
    this.geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]) },
      index: { data: new Uint16Array([0, 2, 1, 1, 2, 3]) },
      aPos: { instanced: 1, size: 3, data: this.pos },
      aSize: { instanced: 1, size: 2, data: this.size },
      aRot: { instanced: 1, size: 1, data: this.rot },
      aColor: { instanced: 1, size: 4, data: this.color },
      aRect: { instanced: 1, size: 4, data: this.rect },
    });
    this.program = new Program(gl, {
      vertex: BILLBOARD_VERT,
      fragment: BILLBOARD_FRAG,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    });
    this.program.setBlendFunc(gl.ONE, gl.ONE);
    this.mesh = new Mesh(gl, { geometry: this.geometry, program: this.program, frustumCulled: false });
  }

  setAtlas(tex: Texture) {
    this.program.uniforms.uAtlas!.value = tex;
  }

  reset() {
    this.count = 0;
  }

  push(x: number, y: number, depth: number, w: number, h: number, rot: number, r: number, g: number, b: number, a: number, rect: Rect) {
    if (this.count >= this.capacity || a <= 0.002) return;
    const i = this.count++;
    this.pos.set([x, y, depth], i * 3);
    this.size.set([w, h], i * 2);
    this.rot[i] = rot;
    this.color.set([r, g, b, a], i * 4);
    this.rect.set(rect, i * 4);
  }

  /** Envoie les instances au GPU ; renvoie false s'il n'y a rien à dessiner. */
  commit(): boolean {
    if (this.count === 0) return false;
    const attrs = this.geometry.attributes;
    for (const k of ['aPos', 'aSize', 'aRot', 'aColor', 'aRect']) attrs[k]!.needsUpdate = true;
    this.geometry.setInstancedCount(this.count);
    return true;
  }
}
