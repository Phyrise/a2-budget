/**
 * Compagnon de l'interface : Jiji (AL, `a`) ou Calcifer (AC, `b`), les deux
 * pour « ensemble », un kodama pour une tâche libre.
 *
 * - Sprite détouré du manifest (`manifest.companions[who][mood]`) s'il
 *   existe, sinon repli dessiné (companionArt.tsx).
 * - Réactions : changer `reactKey` rejoue l'animation de l'humeur (sautille
 *   pour happy, gonfle pour proud, penche la tête pour curious, respire pour
 *   sleepy). Rien ne bouge si prefers-reduced-motion.
 * - `touchable` (Jiji ou Calcifer seuls, jamais dans un autre contrôle) : un
 *   vrai bouton ; le toucher fait réagir le compagnon, et l'agace s'il est
 *   touché trop souvent (companionPoke.ts).
 */
import { useEffect, type CSSProperties } from 'react';
import type { CompanionMood, Who } from '../world/types';
import { manifest } from '../world/manifest';
import { CalciferArt, JijiArt, KodamaArt } from './companionArt';
import { pokeMood, useCompanionPoke, type PokeWho } from './companionPoke';
import { cx } from './format';
import './companionPoke.css';

/** Libellés des compagnons touchables. */
const TOUCH_LABEL: Record<PokeWho, string> = { a: 'Caresser Jiji', b: 'Taquiner Calcifer' };

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
  touchable = false,
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
  /** Bouton : le toucher fait réagir Jiji ou Calcifer (jamais à l'intérieur d'un autre contrôle). */
  touchable?: boolean;
}) {
  const pokeWho: PokeWho | null = touchable && (who === 'a' || who === 'b') ? who : null;
  const poke = useCompanionPoke(pokeWho);
  // Poses des réactions prêtes avant le premier toucher (aucun blanc au changement de sprite).
  useEffect(() => {
    if (!pokeWho) return;
    for (const m of ['idle', 'happy', 'curious', 'proud'] as const) {
      const src = sprite(pokeWho, m);
      if (src) new Image().src = src;
    }
  }, [pokeWho]);
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  const style = { '--cmp-size': `${size}px` } as CSSProperties;
  // Petites tailles : Jiji (chat noir) reçoit un liseré clair pour rester
  // aussi présent que Calcifer sur les fonds sombres.
  const small = size < 40 && 'companion--small';

  if (pokeWho) {
    return (
      <button
        type="button"
        className={cx(
          'companion',
          `companion--${pokeWho}`,
          'companion--touch',
          small,
          perched && 'companion--perched',
          poke.kind && `is-${poke.kind}`,
          poke.calm && 'is-calm',
          className,
        )}
        style={style}
        aria-label={label ?? TOUCH_LABEL[pokeWho]}
        onClick={poke.poke}
      >
        <span className="companion__poke">
          <span key={reactKey ?? 'still'} className="companion__figure" data-mood={mood}>
            <Figure who={pokeWho} mood={pokeMood(pokeWho, poke.kind) ?? mood} />
          </span>
        </span>
        {poke.kind === 'upset' && pokeWho === 'b' && <span key={poke.n} className="companion__smoke" />}
      </button>
    );
  }

  if (who === 'both') {
    return (
      <span className={cx('companion', 'companion--both', small, perched && 'companion--perched', className)} style={style} {...a11y}>
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
    <span className={cx('companion', `companion--${who}`, small, perched && 'companion--perched', className)} style={style} {...a11y}>
      <span key={reactKey ?? 'still'} className="companion__figure" data-mood={mood}>
        {who === 'unassigned' ? <KodamaArt /> : <Figure who={who} mood={mood} />}
      </span>
    </span>
  );
}
