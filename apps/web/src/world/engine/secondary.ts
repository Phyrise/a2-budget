/**
 * Chargement secondaire, non bloquant (après la première image) : kodama
 * (et le gréement de leur tête), créatures, atlas des effets peints, LUT de
 * nuit (de la saison peinte), préchargement au repos de la peinture du stade
 * suivant.
 */
import type { WorldEngine } from './Engine';
import { prefetchNext } from './growth';
import { rigFor } from './karakara';
import { nightLutUrl } from './paint';

export async function loadSecondary(e: WorldEngine): Promise<void> {
  const m = e.cfg.manifest;
  const urls = m.kodamaSpots.map((_, i) => m.sprites.kodama[i % m.sprites.kodama.length]!);
  const assets = await Promise.all(m.sprites.kodama.length > 0 ? urls.map((url, i) => e.res.sprite(url, i, m.sprites.kodama.length === 1)) : []);
  // Chaque peinture garde le gréement de sa tête (karakara).
  e.spirits.kodama = assets.flatMap((a, i) => (a ? [{ ...a, head: rigFor(urls[i]!) }] : []));
  if (e.isDestroyed) return;
  await e.syncCreatures();
  await e.res.loadAtlas();
  if (e.isDestroyed) return;
  if (e.res.atlas) {
    e.fx.atlas = e.res.atlas.map;
    e.pipe.sceneFx.setAtlas(e.res.atlas.tex);
    e.pipe.emissive.setAtlas(e.res.atlas.tex);
    for (const mesh of [e.pipe.motes, e.pipe.burst]) mesh.program.uniforms.uAtlas!.value = e.res.atlas.tex;
    const mote = e.res.atlas.map.motes[0];
    if (mote) e.pipe.motes.program.uniforms.uSprite!.value = mote.rect;
  }
  void e.res.loadLut(nightLutUrl(m, e.paintedSeason));
  prefetchNext(e);
  e.requestFrame(true);
}
