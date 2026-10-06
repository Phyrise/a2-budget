/**
 * Une lanterne de pierre (tōrō), d'après ses peintures (themes/lanterns.ts).
 * - `unlit` : pierre au repos ;
 * - `lit` : la version allumée se fond sur l'éteinte (mêmes toiles, au
 *   pixel près), et une lueur vivante respire autour de la chambre à feu ;
 * - `silhouette` : forme seule, ton de brume, sans aucun détail — pour un
 *   modèle pas encore débloqué, SEULE cette image est référencée (la vraie
 *   peinture n'est jamais chargée avant le déblocage).
 *
 * `height` est la hauteur du plus haut modèle : chaque lanterne garde sa
 * taille relative (`scale`), pied en bas, centrée.
 */
import type { CSSProperties, MouseEvent } from 'react';
import { LANTERN_ART, type LanternArt, type LanternId } from '../../../themes/lanterns';
import { cx } from '../../../ui';
import './toro.css';

export type ToroMode = 'unlit' | 'lit' | 'silhouette';

const block = (e: MouseEvent) => e.preventDefault();

export function lanternArtOf(id: string): LanternArt {
  return LANTERN_ART[id as LanternId] ?? LANTERN_ART['kasuga-moss'];
}

function Img({ src, className }: { src: string; className: string }) {
  return (
    <img
      src={src}
      alt=""
      className={className}
      decoding="async"
      draggable={false}
      onContextMenu={block}
      onDragStart={block}
    />
  );
}

export function ToroArt({
  id,
  mode = 'unlit',
  height = 96,
  relative = true,
  className,
}: {
  id: string;
  mode?: ToroMode;
  /** Hauteur (px) du plus haut modèle ; les autres en gardent la proportion. */
  height?: number;
  /** false : la toile occupe toute la hauteur donnée (vignette). */
  relative?: boolean;
  className?: string;
}) {
  const art = lanternArtOf(id);
  const h = Math.round(height * (relative ? art.scale : 1));
  const w = Math.round(h * art.aspect);
  const style = {
    width: w,
    height: h,
    '--fire-x': `${(art.fire.x * 100).toFixed(1)}%`,
    '--fire-y': `${(art.fire.y * 100).toFixed(1)}%`,
  } as CSSProperties;
  const spirit = id === 'spirit-light';

  return (
    <span className={cx('toro', `toro--${mode}`, spirit && 'toro--spirit', className)} style={style} aria-hidden="true" onContextMenu={block}>
      {mode === 'silhouette' ? (
        <Img src={art.silhouette} className="toro__img" />
      ) : (
        <>
          <span className="toro__glow" />
          <Img src={art.unlit} className="toro__img" />
          <Img src={art.lit} className="toro__img toro__lit" />
        </>
      )}
    </span>
  );
}
