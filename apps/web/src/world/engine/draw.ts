/**
 * Dessin d'une image : passe peinture → lanterne de pierre et sprites → effets peints → saisons → fougères
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
  /** Saison peinte pour les objets posés : automne, neige, printemps (look.fg). */
  stoneSeason: [number, number, number];
  hasForeground: boolean;
  drawRain: boolean;
  drawBurst: boolean;
  drawMotes: boolean;
  drawSeason: boolean;
}

function draw(renderer: Renderer, mesh: Mesh, target: Pipeline['target'] | null) {
  renderer.render({ scene: mesh, target: target ?? undefined, clear: false, sort: false, frustumCull: false, update: false });
}

/** Marge du quad d'une tête qui secoue (karakara) : elle peut sortir de sa case. */
const HEAD_PAD = 0.15;
const NO_HEAD = [0.5, 0.4, 0, 0];

function setSprite(mesh: Mesh, d: SpriteDraw, fogColor: [number, number, number], emissive: boolean) {
  const un = mesh.program.uniforms;
  const hd = d.head;
  un.uPad!.value = hd ? HEAD_PAD : 0;
  un.uHead!.value = hd ? [hd.rig.pivot[0], hd.rig.pivot[1], hd.angle, hd.squeeze] : NO_HEAD;
  if (hd) un.uHeadBox!.value = [hd.rig.center[0], hd.rig.center[1], hd.rig.radius[0], hd.rig.radius[1]];
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

/** Marges du quad d'une pierre posée (ombre de contact) : côtés, haut, bas. */
const STONE_PAD: [number, number, number] = [0.32, 0, 0.09];

function setStone(mesh: Mesh, d: SpriteDraw, season: [number, number, number]) {
  const un = mesh.program.uniforms;
  const st = d.stone!;
  const shadow = st.shadow > 0;
  un.uTex!.value = d.asset.tex;
  un.uCell!.value = d.asset.rect;
  un.uAnchor!.value = [d.x, d.y];
  un.uSize!.value = [d.h * d.asset.aspect, d.h];
  un.uZ!.value = d.depth;
  un.uRot!.value = d.rot;
  un.uPad!.value = shadow ? STONE_PAD : [0, 0, 0];
  un.uAlpha!.value = mesh.program.uniforms.uEmissive!.value ? d.alpha * d.glow : d.alpha;
  un.uReveal!.value = d.reveal;
  un.uGlow!.value = d.glowColor;
  un.uFoot!.value = st.foot;
  un.uGround!.value = st.ground;
  un.uShadow!.value = st.shadow;
  un.uTexelV!.value = 1 / Math.max(16, d.asset.px ?? 400);
  un.uSeasonK!.value = season;
}

export function drawFrame(renderer: Renderer, pipe: Pipeline, f: FrameInputs) {
  const target = pipe.target;
  draw(renderer, pipe.scene, target);
  for (const d of f.sprites) {
    if (d.stone) {
      setStone(pipe.stone, d, f.stoneSeason);
      draw(renderer, pipe.stone, target);
      continue;
    }
    setSprite(pipe.sprite, d, f.fogColor, false);
    draw(renderer, pipe.sprite, target);
  }
  if (pipe.sceneFx.commit()) draw(renderer, pipe.sceneFx.mesh, target);
  if (f.drawSeason) draw(renderer, pipe.season, target);
  if (f.hasForeground) draw(renderer, pipe.fg, target);

  pipe.post.program.uniforms.uScene!.value = target.texture;
  draw(renderer, pipe.post, null);

  for (const d of f.sprites) {
    if (d.glow <= 0.01) continue;
    if (d.stone) {
      setStone(pipe.stoneGlow, d, f.stoneSeason);
      draw(renderer, pipe.stoneGlow, null);
      continue;
    }
    setSprite(pipe.spriteGlow, d, f.fogColor, true);
    draw(renderer, pipe.spriteGlow, null);
  }
  if (pipe.emissive.commit()) draw(renderer, pipe.emissive.mesh, null);
  if (f.drawRain) draw(renderer, pipe.rain, null);
  if (f.drawMotes) draw(renderer, pipe.motes, null);
  if (f.drawBurst) draw(renderer, pipe.burst, null);
}
