/**
 * Petite enveloppe cachetée (dessinée par le code) : papier ivoire, rabat,
 * cachet de cire à la couleur de l'expéditeur et tête de son compagnon
 * (Jiji pour AL, Calcifer pour AC). `opened` : le rabat se soulève et le
 * cachet s'efface (animation CSS, coupée si le mouvement est réduit).
 * Décorative : le nom accessible est porté par le bouton qui la contient.
 */
import { Companion, cx } from '../../../ui';

export function Envelope({ from, size = 44, opened = false, className }: { from: 'a' | 'b'; size?: number; opened?: boolean; className?: string }) {
  return (
    <span
      className={cx('envelope', `envelope--${from}`, opened && 'is-opened', className)}
      style={{ width: size, height: Math.round(size * 0.72) }}
      aria-hidden="true"
    >
      <svg className="envelope__art" viewBox="0 0 64 46">
        <rect className="envelope__body" x="1.5" y="1.5" width="61" height="43" rx="5" />
        <path className="envelope__fold" d="M3 43 L26 24 M61 43 L38 24" />
        <g className="envelope__flap">
          <path d="M2.5 3.5 Q2 2 4 2 L60 2 Q62 2 61.5 3.5 L35 25.5 Q32 28 29 25.5 Z" />
        </g>
        <circle className="envelope__wax" cx="32" cy="25" r="9" />
        <circle className="envelope__wax-ring" cx="32" cy="25" r="6.6" />
      </svg>
      <span className="envelope__head">
        <Companion who={from} size={Math.round(size * 0.34)} mood="happy" />
      </span>
    </span>
  );
}
