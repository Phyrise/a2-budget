/**
 * Illustrations au trait de l'effort d'une tâche — des pierres de rivière,
 * comme les cairns qu'on croise sur les sentiers de Yakushima :
 * petit geste = un galet et une pousse ; tâche = deux pierres ;
 * corvée = un cairn de trois pierres. Même trait que le jeu d'icônes
 * (1,6 px, extrémités arrondies), mousse en aplat très léger.
 */
import type { TaskEffort } from '@a2/core';

const GROUND = 'M4.5 27.6h23';
const BASE = 'M6 26.7c0-3.3 4.4-5.6 10-5.6s10 2.3 10 5.6c0 .5-.4.9-.9.9H6.9c-.5 0-.9-.4-.9-.9Z';
const MIDDLE = 'M9.6 20.5c0-2.6 2.9-4.5 6.6-4.5s6.6 1.9 6.6 4.5c0 .4-.3.7-.7.7H10.3c-.4 0-.7-.3-.7-.7Z';
const TOP = 'M12.3 15.2c0-2.1 1.7-3.5 3.9-3.5s3.9 1.4 3.9 3.5c0 .3-.2.6-.6.6h-6.6c-.3 0-.6-.3-.6-.6Z';
const PEBBLE = 'M9.2 26.8c0-2.9 3-4.8 6.8-4.8s6.8 1.9 6.8 4.8c0 .4-.3.8-.8.8H10c-.4 0-.8-.4-.8-.8Z';
const SPROUT = 'M16 22v-3.4';
const LEAF = 'M16 19.4c.2-1.9 1.6-3 3.6-3-.1 1.9-1.5 3-3.6 3Z';
const LEAF_2 = 'M16 20.4c-.2-1.4-1.2-2.2-2.7-2.2.1 1.4 1.1 2.2 2.7 2.2Z';
/** Mousse : petits arcs posés sur les pierres. */
const MOSS_BASE = 'M9.4 22.6c1.2-.6 2.4-.7 3.4-.4M19.6 22.2c1-.3 2.1-.2 3 .3';
const MOSS_MIDDLE = 'M12 17.2c.8-.4 1.7-.5 2.4-.3';

export function EffortArt({ effort, size = 32, className }: { effort: TaskEffort; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `effort-art ${className}` : 'effort-art'}
      width={Math.round(size * 1.3)}
      height={size}
      viewBox="3 9.5 26 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={GROUND} opacity={0.4} />
      {effort === 1 ? (
        <>
          <path d={PEBBLE} fill="currentColor" fillOpacity={0.1} />
          <path d={SPROUT} />
          <path d={LEAF} className="effort-art__moss" />
          <path d={LEAF_2} className="effort-art__moss" />
        </>
      ) : (
        <>
          <path d={BASE} fill="currentColor" fillOpacity={0.1} />
          <path d={MOSS_BASE} className="effort-art__moss" strokeWidth={1.3} />
          <path d={MIDDLE} fill="currentColor" fillOpacity={0.14} />
          {effort === 3 && (
            <>
              <path d={MOSS_MIDDLE} className="effort-art__moss" strokeWidth={1.2} />
              <path d={TOP} fill="currentColor" fillOpacity={0.18} />
            </>
          )}
        </>
      )}
    </svg>
  );
}

export const EFFORTS: ReadonlyArray<{ value: TaskEffort; label: string; hint: string }> = [
  { value: 1, label: 'Petit geste', hint: 'quelques minutes' },
  { value: 2, label: 'Tâche', hint: 'un vrai moment' },
  { value: 3, label: 'Corvée', hint: 'celle qui pèse' },
];

/** Petit cairn seul (badge « corvée » d'une ligne de tâche). */
export function CairnMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="4 10 24 19" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={BASE} fill="currentColor" fillOpacity={0.2} />
      <path d={MIDDLE} fill="currentColor" fillOpacity={0.2} />
      <path d={TOP} fill="currentColor" fillOpacity={0.2} />
    </svg>
  );
}
