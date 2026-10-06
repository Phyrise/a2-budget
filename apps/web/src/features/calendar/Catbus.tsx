/**
 * Le Chatbus traverse l'écran (≈ 1,6 s) quand on ajoute un événement : il
 * file de gauche à droite au-dessus de la grille, puis disparaît. Calque
 * décoratif (aria-hidden, sans clic), rendu dans <body> pour ne jamais
 * élargir la page : le conteneur est fixe, rogné, de la largeur de l'écran.
 * Mouvement réduit : pas de traversée (le toast suffit).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { calendarTheme } from '../../themes/manifest';

const RUN_MS = 1700;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** `run` change (compteur) à chaque ajout ; 0 = rien. */
export function CatbusRun({ run }: { run: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (run === 0 || reducedMotion() || !calendarTheme.catbus.running) return;
    setActive(run);
    const t = window.setTimeout(() => setActive((current) => (current === run ? 0 : current)), RUN_MS + 100);
    return () => window.clearTimeout(t);
  }, [run]);

  if (active === 0) return null;
  return createPortal(
    <div className="cal-catbus" aria-hidden="true" key={active}>
      <img className="cal-catbus__bus" src={calendarTheme.catbus.running} alt="" decoding="async" draggable={false} />
    </div>,
    document.body,
  );
}
