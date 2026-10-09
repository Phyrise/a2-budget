/**
 * Mode développeur — rendu de la forêt, en direct : images/s réelles, cible
 * et plafond (essai « 30 images/s » des Réglages), densité, palier. Relu
 * toutes les 500 ms, seulement quand la section est ouverte. Le panneau fige
 * la forêt : les images/s sont celles de la dernière animation. Forêt
 * démontée (ou sans WebGL) : « — ».
 */
import { useEffect, useState } from 'react';
import type { EngineStats } from '../../world/engine';
import type { LivingForestDebugHandle } from '../../world/LivingForest';
import { useWorld } from '../../world/WorldContext';
import { Row } from './DevNumbers';
import { useDevSectionOpen } from './DevSection';

const DASH = '—';

export function DevRender() {
  const { handleRef } = useWorld();
  const open = useDevSectionOpen();
  const [stats, setStats] = useState<EngineStats | null>(null);

  useEffect(() => {
    if (!open) return;
    const read = () => setStats((handleRef.current as LivingForestDebugHandle | null)?.stats?.() ?? null);
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, [open, handleRef]);

  const s = stats;
  return (
    <section className="dev-section" aria-labelledby="dev-render">
      <h3 id="dev-render" className="dev-section__title">
        Rendu
      </h3>
      <dl className="dev-grid" data-testid="dev-render">
        <Row label="Images/s" value={s && s.rate > 0 ? Math.round(s.rate) : DASH} hint="réelles, dernière animation" />
        <Row label="Cible / plafond" value={s ? `${s.targetFps} / ${s.maxFps}` : DASH} />
        <Row label="Densité · palier" value={s ? `${s.dpr.toFixed(2)} · ${s.tier}` : DASH} />
      </dl>
    </section>
  );
}
