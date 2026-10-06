/**
 * Image décorative du carnet : ni glisser-déposer, ni menu contextuel
 * (clic droit, appui long iOS / Android), ni sélection. Avec la silhouette
 * à part des créatures non rencontrées, plus rien ne permet de « tricher ».
 */
import type { MouseEvent } from 'react';

const block = (e: MouseEvent) => e.preventDefault();

export function CarnetImage({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      className={className ? `carnet-img ${className}` : 'carnet-img'}
      loading="lazy"
      decoding="async"
      draggable={false}
      onContextMenu={block}
      onDragStart={block}
    />
  );
}
