/**
 * En-tête de « Dans le panier » : le panier en osier (vide, à moitié, plein)
 * et Jiji à côté, dans une petite fenêtre de ciel. Décoratif (aria-hidden) :
 * le titre et la phrase portent l'information. Un article coché file vers le
 * panier : Jiji lui donne un petit coup de patte curieux (jijiPaw.ts).
 */
import { useEffect, useRef } from 'react';
import { coursesTheme } from '../../themes/manifest';
import type { BasketFill, JijiPose } from '../../themes/types';
import { cx, plural } from '../../ui';
import { jijiPaw } from './jijiPaw';

/** Phrase douce sous le titre, selon l'avancée des courses. */
function basketLine(done: number, total: number): string {
  if (done === 0) return 'Jiji garde la place au chaud.';
  if (done === total) return 'Tout est dans le panier !';
  const left = total - done;
  return `Plus que ${plural(left, 'article')} à trouver.`;
}

export function BasketStage({
  fill,
  pose,
  done,
  total,
  bump,
  paw = 0,
}: {
  fill: BasketFill;
  pose: JijiPose;
  done: number;
  total: number;
  /** Change à chaque article déposé : le panier sautille. */
  bump: number;
  /** Change à chaque article coché (en vol vers le panier) : coup de patte de Jiji. */
  paw?: number;
}) {
  // Le coup de patte anime un calque stable : Jiji peut changer de pose
  // (nouvelle image) pendant le geste sans l'interrompre.
  const pawRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (paw > 0) jijiPaw(pawRef.current);
  }, [paw]);

  return (
    <div className="basket-head">
      <div className={cx('basket-stage', `basket-stage--${fill}`)} data-fill={fill} data-pose={pose} aria-hidden="true">
        <span className="basket-stage__sky" />
        <img
          key={`b-${bump}`}
          className={cx('basket-stage__basket', bump > 0 && 'is-bumped')}
          src={coursesTheme.basket[fill]}
          alt=""
          draggable={false}
        />
        <span ref={pawRef} className="basket-stage__paw">
          <img
            key={pose}
            className={cx('basket-stage__jiji', `basket-stage__jiji--${pose}`)}
            src={coursesTheme.jiji[pose]}
            alt=""
            draggable={false}
          />
        </span>
      </div>
      <div className="basket-head__text">
        <div className="section-head">
          <h2 id="basket-title" className="section-title" tabIndex={-1}>
            Dans le panier
          </h2>
          <span className="section-head__meta">{done}</span>
        </div>
        <p className="basket-head__line">{basketLine(done, total)}</p>
      </div>
    </div>
  );
}
