/**
 * Dessin d'une image : passe peinture → sprites → effets peints → fougères
 * (dans la cible hors écran), puis étalonnage vers l'écran, puis couches
 * émissives (lumières, halos, kodama luisants, particules) non étalonnées :
 * une source de lumière reste lumineuse la nuit.
 */
import type { Mesh, Renderer } from 'ogl';
import type { Pipeline } from './pipeline';
import type { SpriteDraw } from './spirits';

export interface FrameInputs {
  sprites: SpriteDraw[];
  fogColor: [number, number, number];
  hasForeground: boolean;
  drawRain: boolean;
  drawBurst: boolean;
  drawMotes: boolean;
}

function draw(renderer: Renderer, mesh: Mesh, target: Pipeline['target'] | null) {
  renderer.render({ scene: mesh, target: target ?? undefined, clear: false, sort: false, frustumCull: false, update: false });
}

function setSprite(mesh: Mesh, d: SpriteDraw, fogColor: [number, number, number], emissive: boolean) {
  const un = mesh.program.uniforms;
  un.uTex!.value = d.asset.tex;
  un.uCell!.value = d.asset.rect;
  un.uAnchor!.value = [d.x, d.y];
  un.uSize!.value = [d.h * d.asset.aspect, d.h];
  un.uDepth!.value = d.depth;
  un.uRot!.value = d.rot;
  un.uAlpha!.value = emissive ? d.alpha * d.glow : d.alpha;
  un.uReveal!.value = d.reveal;
  un.uGlow!.value = d.glowColor;
  un.uFogColor!.value = fogColor;
  un.uFogMix!.value = d.fogMix;
}

export function drawFrame(renderer: Renderer, pipe: Pipeline, f: FrameInputs) {
  const target = pipe.target;
  draw(renderer, pipe.scene, target);
  for (const d of f.sprites) {
    setSprite(pipe.sprite, d, f.fogColor, false);
    draw(renderer, pipe.sprite, target);
  }
  if (pipe.sceneFx.commit()) draw(renderer, pipe.sceneFx.mesh, target);
  if (f.hasForeground) draw(renderer, pipe.fg, target);

  pipe.post.program.uniforms.uScene!.value = target.texture;
  draw(renderer, pipe.post, null);

  for (const d of f.sprites) {
    if (d.glow <= 0.01) continue;
    setSprite(pipe.spriteGlow, d, f.fogColor, true);
    draw(renderer, pipe.spriteGlow, null);
  }
  if (pipe.emissive.commit()) draw(renderer, pipe.emissive.mesh, null);
  if (f.drawRain) draw(renderer, pipe.rain, null);
  if (f.drawMotes) draw(renderer, pipe.motes, null);
  if (f.drawBurst) draw(renderer, pipe.burst, null);
}
