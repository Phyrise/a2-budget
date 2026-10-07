/**
 * Le Sans-Visage en visite (V4) : quand on coche ou décoche un paiement alors
 * que le Sans-Visage du solde est hors de l'écran, il glisse doucement depuis
 * le bord droit, au-dessus de la navigation, reçoit ou laisse partir ses
 * pépites, puis repart.
 * Toujours monté (la bouche sert de cible aux pépites), invisible au repos.
 * Décoratif : aria-hidden.
 */
import type { RefObject } from 'react';
import { cx } from '../../../ui';
import type { Visit } from './feeding';
import type { NoFaceMood } from './mood';
import { NoFace } from './NoFace';

export function NoFaceVisitor({
  visit,
  mouthRef,
  mood,
  eating,
  bowing,
}: {
  visit: Visit;
  mouthRef: RefObject<HTMLSpanElement | null>;
  mood: NoFaceMood;
  eating: boolean;
  bowing: boolean;
  /** Ignoré depuis V4.2 (la taille suit le compte). Gardé pour l'écran. */
  fullness?: number;
}) {
  return (
    <div className={cx('noface-visitor', visit === 'in' && 'is-in', visit === 'out' && 'is-out')} aria-hidden="true">
      <span ref={mouthRef} className="noface-visitor__mouth" />
      {visit !== null && (
        <div className="noface-visitor__body">
          <NoFace mood={mood} bowing={bowing} eating={eating} scale={0.25} touchable={false} />
        </div>
      )}
    </div>
  );
}
