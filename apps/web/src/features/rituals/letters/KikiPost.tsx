/**
 * Calque de la traversée de Kiki (V5.10), monté une fois dans l'app :
 * Kiki file de droite à gauche (le sens du sprite, balai derrière elle)
 * sous l'en-tête, l'enveloppe cachetée pendue à sa main, puis s'en va.
 * Deux animations CSS (avance, ondulation), aucune boucle rAF ; calque
 * fixe sans toucher (pointer-events: none), décoratif (aria-hidden).
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { coursesTheme } from '../../../themes/manifest';
import { Envelope } from './Envelope';
import { KIKI_POST_MS, kikiPost, useKikiPost } from './kikiDelivery';
import './kiki-post.css';

export function KikiPost() {
  const flight = useKikiPost();

  // Filet : fin d'animation manquée, ou app passée en arrière-plan (pas de reprise au retour).
  useEffect(() => {
    if (flight === null) return;
    const end = () => kikiPost.land(flight.id);
    const timer = window.setTimeout(end, KIKI_POST_MS + 500);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') end();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flight]);

  if (flight === null) return null;
  return createPortal(
    <div className="kiki-post" aria-hidden="true" data-testid="kiki-post">
      <span
        key={flight.id}
        className="kiki-post__path"
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) kikiPost.land(flight.id);
        }}
      >
        <span className="kiki-post__bob">
          <img className="kiki-post__kiki" src={coursesTheme.kiki.flying} alt="" draggable={false} />
          <span className="kiki-post__letter">
            <span className="kiki-post__string" />
            <Envelope from={flight.from} size={36} />
          </span>
        </span>
      </span>
    </div>,
    document.body,
  );
}
