/**
 * Voile de brume CSS (repli sans WebGL) : deux nappes de dégradés qui
 * dérivent très lentement ; immobile si le mouvement est réduit.
 */
import type { CSSProperties } from 'react';

const KEYFRAMES = `
@keyframes a2-mist-drift-a { from { transform: translate3d(-6%, 0, 0); } to { transform: translate3d(6%, -1.5%, 0); } }
@keyframes a2-mist-drift-b { from { transform: translate3d(5%, 1%, 0); } to { transform: translate3d(-5%, 0, 0); } }
@media (prefers-reduced-motion: reduce) { .a2-mist > div { animation: none !important; } }
`;

const sheet: CSSProperties = {
  position: 'absolute',
  inset: '-10%',
  pointerEvents: 'none',
  mixBlendMode: 'screen',
};

export function ForestMist({ still }: { still: boolean }) {
  return (
    <div className="a2-mist" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          ...sheet,
          opacity: 0.32,
          background:
            'radial-gradient(60% 18% at 30% 62%, rgba(190,204,198,0.55), transparent 70%), radial-gradient(50% 14% at 75% 48%, rgba(190,204,198,0.4), transparent 70%)',
          animation: still ? 'none' : 'a2-mist-drift-a 38s ease-in-out infinite alternate',
        }}
      />
      <div
        style={{
          ...sheet,
          opacity: 0.22,
          background:
            'radial-gradient(70% 20% at 60% 74%, rgba(200,210,204,0.5), transparent 72%), radial-gradient(40% 12% at 20% 40%, rgba(200,210,204,0.35), transparent 70%)',
          animation: still ? 'none' : 'a2-mist-drift-b 52s ease-in-out infinite alternate',
        }}
      />
    </div>
  );
}
