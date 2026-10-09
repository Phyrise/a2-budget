/**
 * Compagnon de l'interface : celui qu'AL (`a`) ou AC (`b`) a choisi (V5.6 :
 * Jiji, Calcifer, Teto ou Hin — ui/companions.ts), les deux pour
 * « ensemble », un kodama pour une tâche libre.
 *
 * - Sprite détouré du manifest (`manifest.companions[id][mood]`) s'il
 *   existe, sinon repli dessiné (companionArt.tsx : Jiji, Calcifer ; Teto et
 *   Hin retombent sur leur idle, sinon sur le dessin du défaut du rôle).
 * - Réactions : changer `reactKey` rejoue l'animation de l'humeur (sautille
 *   pour happy, gonfle pour proud, penche la tête pour curious, respire pour
 *   sleepy). Rien ne bouge si prefers-reduced-motion.
 * - `touchable` (`a` ou `b` seuls, jamais dans un autre contrôle) : un vrai
 *   bouton ; le toucher fait réagir le compagnon, et l'agace s'il est touché
 *   trop souvent (companionPoke.ts).
 * - `companion` : force un compagnon précis (sélecteur des Réglages, mode
 *   développeur) au lieu du choix de `who`.
 */
import { useEffect, type CSSProperties } from 'react';
import { defaultCompanion, type CompanionId } from '@a2/core';
import { prefetchSample } from '../app/sound/samples';
import type { CompanionMood, Who } from '../world/types';
import { manifest } from '../world/manifest';
import { CalciferArt, JijiArt, KodamaArt } from './companionArt';
import { pokeMood, useCompanionPoke } from './companionPoke';
import { companionProfile, useCompanionIds } from './companions';
import { cx } from './format';
import './companionPoke.css';

export type CompanionWho = Who;

/** Sprite d'une pose (repli : idle), '' sans sprite. */
export function companionSprite(id: CompanionId, mood: CompanionMood): string {
  const set = manifest.companions?.[id];
  if (!set) return '';
  return set[mood] || set.idle || '';
}

/** Le compagnon seul (sprite ou dessin), sans cadre : pour les petites têtes et décors. */
export function CompanionFigure({ id, mood, role }: { id: CompanionId; mood: CompanionMood; role: 'a' | 'b' }) {
  const src = companionSprite(id, mood);
  if (src) {
    return <img className="companion__sprite" src={src} alt="" draggable={false} decoding="async" data-companion={id} />;
  }
  const drawn = id === 'jiji' || id === 'calcifer' ? id : defaultCompanion(role);
  return drawn === 'jiji' ? <JijiArt mood={mood} /> : <CalciferArt mood={mood} />;
}

export function Companion({
  who,
  companion,
  mood = 'idle',
  size = 40,
  reactKey,
  label,
  className,
  perched = false,
  touchable = false,
}: {
  who: CompanionWho;
  /** Compagnon imposé (sinon celui choisi par `who`). */
  companion?: CompanionId;
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
  /** Bouton : le toucher fait réagir le compagnon (jamais à l'intérieur d'un autre contrôle). */
  touchable?: boolean;
}) {
  const ids = useCompanionIds();
  const role = who === 'a' || who === 'b' ? who : null;
  const id: CompanionId | null = role === null ? null : (companion ?? ids[role]);
  const pokeId = touchable && id !== null ? id : null;
  const poke = useCompanionPoke(pokeId);
  // Poses des réactions prêtes avant le premier toucher (aucun blanc au changement de sprite).
  useEffect(() => {
    if (!pokeId) return;
    for (const m of ['idle', 'happy', 'curious', 'proud', 'sleepy'] as const) {
      const src = companionSprite(pokeId, m);
      if (src) new Image().src = src;
    }
  }, [pokeId]);
  // V5.7 : un Hin à l'écran → son « hin » (fichier audio) récupéré d'avance, sans être joué.
  useEffect(() => {
    if (id === 'hin') prefetchSample('hin');
  }, [id]);
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  const style = { '--cmp-size': `${size}px` } as CSSProperties;
  // Petites tailles : Jiji (chat noir) reçoit un liseré clair pour rester
  // aussi présent que les autres sur les fonds sombres.
  const small = size < 40 && 'companion--small';

  if (pokeId && role) {
    return (
      <button
        type="button"
        className={cx(
          'companion',
          `companion--${role}`,
          `companion--${pokeId}`,
          'companion--touch',
          small,
          perched && 'companion--perched',
          poke.kind && `is-${poke.kind}`,
          poke.calm && 'is-calm',
          className,
        )}
        style={style}
        aria-label={label ?? companionProfile(pokeId).touchLabel}
        onClick={poke.poke}
      >
        <span className="companion__poke">
          <span key={reactKey ?? 'still'} className="companion__figure" data-mood={mood}>
            <CompanionFigure id={pokeId} role={role} mood={pokeMood(pokeId, poke.kind) ?? mood} />
          </span>
        </span>
        {poke.kind === 'upset' && pokeId === 'calcifer' && <span key={poke.n} className="companion__smoke" />}
      </button>
    );
  }

  if (who === 'both') {
    return (
      <span className={cx('companion', 'companion--both', small, perched && 'companion--perched', className)} style={style} {...a11y}>
        <span key={`a-${reactKey ?? ''}`} className={cx('companion__figure', 'companion__figure--a', `companion__figure--${ids.a}`)} data-mood={mood}>
          <CompanionFigure id={ids.a} role="a" mood={mood} />
        </span>
        <span key={`b-${reactKey ?? ''}`} className={cx('companion__figure', 'companion__figure--b', `companion__figure--${ids.b}`)} data-mood={mood}>
          <CompanionFigure id={ids.b} role="b" mood={mood} />
        </span>
      </span>
    );
  }

  return (
    <span className={cx('companion', `companion--${who}`, id && `companion--${id}`, small, perched && 'companion--perched', className)} style={style} {...a11y}>
      <span key={reactKey ?? 'still'} className="companion__figure" data-mood={mood}>
        {id === null || role === null ? <KodamaArt /> : <CompanionFigure id={id} role={role} mood={mood} />}
      </span>
    </span>
  );
}
