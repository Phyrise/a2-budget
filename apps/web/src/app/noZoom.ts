/**
 * Pas de zoom dans l'app (pincement, double toucher) : un zoom accidentel
 * décale toute l'interface du téléphone. Le viewport (index.html :
 * maximum-scale=1, user-scalable=no) et `touch-action: manipulation`
 * (base.css) suffisent presque partout ; Safari iOS ignore user-scalable=no,
 * d'où ces écouteurs : gestes de pincement WebKit (gesture*) et
 * déplacements à plusieurs doigts annulés. Un seul doigt n'est jamais
 * retenu : défilement, curseurs, glissés et pavé de saisie restent intacts.
 */
import { useEffect } from 'react';

export function useNoZoom(): void {
  useEffect(() => {
    const stop = (event: Event) => event.preventDefault();
    const pinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const options = { passive: false } as const;
    const gestures = ['gesturestart', 'gesturechange', 'gestureend'] as const;
    for (const name of gestures) document.addEventListener(name, stop, options);
    // Seulement là où les gestes WebKit existent : ailleurs, le viewport suffit
    // et le défilement garde ses écouteurs passifs.
    const webkit = 'GestureEvent' in window;
    if (webkit) document.addEventListener('touchmove', pinch, options);
    return () => {
      for (const name of gestures) document.removeEventListener(name, stop);
      if (webkit) document.removeEventListener('touchmove', pinch);
    };
  }, []);
}
