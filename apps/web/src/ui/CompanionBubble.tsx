/**
 * Bulle de parole d'un compagnon (Jiji pour `a`, Calcifer pour `b`).
 *
 * - Éphémère et jamais bloquante : aucun focus, aucun clic intercepté
 *   (pointer-events: none) ; le parent décide de la durée.
 * - La région `aria-live="polite"` est toujours montée : chaque nouvelle
 *   réplique est annoncée une fois par les lecteurs d'écran.
 * - Variantes : `perch` (au-dessus des compagnons perchés sur la feuille,
 *   queue vers la droite), `floating` (en bas d'écran avec une petite tête
 *   du compagnon, quand les compagnons perchés sont hors de vue), `inline`
 *   (à côté d'un compagnon dans une ligne).
 * - prefers-reduced-motion : simple fondu.
 */
import { Companion } from './Companion';
import { cx } from './format';
import './companionBubble.css';

export interface CompanionBubbleData {
  who: 'a' | 'b';
  text: string;
  /** Change à chaque réplique (rejoue l'apparition). */
  key: number;
  /** Phase de sortie (fondu) avant retrait. */
  leaving?: boolean;
}

const NAMES = { a: 'Jiji', b: 'Calcifer' } as const;

export function CompanionBubble({
  bubble,
  variant = 'perch',
  className,
}: {
  bubble: CompanionBubbleData | null;
  variant?: 'perch' | 'floating' | 'inline';
  className?: string;
}) {
  return (
    <div className={cx('cbubble-region', `cbubble-region--${variant}`, className)} aria-live="polite" aria-atomic="true">
      {bubble && (
        <div key={bubble.key} className={cx('cbubble', `cbubble--${bubble.who}`, bubble.leaving && 'is-leaving')}>
          {variant === 'floating' && <Companion who={bubble.who} size={34} mood="happy" className="cbubble__face" />}
          <p className="cbubble__body">
            <span className="cbubble__name">{NAMES[bubble.who]}</span>
            <span className="visually-hidden">&nbsp;: </span>
            <span className="cbubble__text">{bubble.text}</span>
          </p>
        </div>
      )}
    </div>
  );
}
