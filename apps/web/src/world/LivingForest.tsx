/**
 * <LivingForest> — STUB provisoire (remplacé par le moteur WebGL, world/engine).
 * Affiche la peinture du stade courant en image fixe. Respecte le contrat
 * LivingForestProps / LivingForestHandle de world/types.ts.
 */
import { forwardRef, useImperativeHandle } from 'react';
import { manifest } from './manifest';
import type { GrowthStage, LivingForestHandle, LivingForestProps } from './types';

export const LivingForest = forwardRef<LivingForestHandle, LivingForestProps>(function LivingForest(
  { state, variant = 'hero', className = '', onReady },
  ref,
) {
  useImperativeHandle(ref, () => ({ pulse: () => {}, playGuardian: () => {} }), []);
  const stage = Math.min(7, Math.max(1, Math.round(state.stage))) as GrowthStage;
  return (
    <div className={`living-forest living-forest--${variant} ${className}`.trim()} aria-hidden="true">
      <img
        src={manifest.stages[stage].color}
        alt=""
        onLoad={onReady}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
});
