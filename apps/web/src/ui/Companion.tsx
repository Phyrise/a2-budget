/**
 * Compagnon de l'interface : Jiji (AL, `a`) ou Calcifer (AC, `b`), les deux
 * pour « ensemble », un kodama pour une tâche libre.
 *
 * - Sprite détouré du manifest (`manifest.companions[who][mood]`) s'il
 *   existe, sinon repli dessiné (companionArt.tsx).
 * - Réactions : changer `reactKey` rejoue l'animation de l'humeur (sautille
 *   pour happy, gonfle pour proud, penche la tête pour curious, respire pour
 *   sleepy). Rien ne bouge si prefers-reduced-motion.
 */
import type { CSSProperties } from 'react';
import type { CompanionMood, Who } from '../world/types';
import { manifest } from '../world/manifest';
import { CalciferArt, JijiArt, KodamaArt } from './companionArt';
import { cx } from './format';

export type CompanionWho = Who;

function sprite(who: 'a' | 'b', mood: CompanionMood): string {
  const set = manifest.companions?.[who];
  if (!set) return '';
  return set[mood] || set.idle || '';
}

function Figure({ who, mood }: { who: 'a' | 'b'; mood: CompanionMood }) {
  const src = sprite(who, mood);
  if (src) {
    return <img className="companion__sprite" src={src} alt="" draggable={false} decoding="async" />;
  }
  return who === 'a' ? <JijiArt mood={mood} /> : <CalciferArt mood={mood} />;
}

export function Companion({
  who,
  mood = 'idle',
  size = 40,
  reactKey,
  label,
  className,
  perched = false,
}: {
  who: CompanionWho;
  mood?: CompanionMood;
  /** Hauteur en px. */
  size?: number;
  /** Changer cette clé rejoue l'animation de réaction. */
  reactKey?: string | number;
  /** Libellé accessible ; sans libellé, le compagnon est décoratif. */
  label?: string;
  className?: string;
  /** Posé sur le bord de la feuille (ombre portée douce). */
  perched?: boolean;
}) {
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  const style = { '--cmp-size': `${size}px` } as CSSProperties;

  if (who === 'both') {
    return (
      <span className={cx('companion', 'companion--both', perched && 'companion--perched', className)} style={style} {...a11y}>
        <span key={`a-${reactKey ?? ''}`} className="companion__figure companion__figure--a" data-mood={mood}>
          <Figure who="a" mood={mood} />
        </span>
        <span key={`b-${reactKey ?? ''}`} className="companion__figure companion__figure--b" data-mood={mood}>
          <Figure who="b" mood={mood} />
        </span>
      </span>
    );
  }

  return (
    <span className={cx('companion', `companion--${who}`, perched && 'companion--perched', className)} style={style} {...a11y}>
      <span key={reactKey ?? 'still'} className="companion__figure" data-mood={mood}>
        {who === 'unassigned' ? <KodamaArt /> : <Figure who={who} mood={mood} />}
      </span>
    </span>
  );
}
