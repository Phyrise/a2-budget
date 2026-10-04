/**
 * Le monde derrière l'interface : la forêt vivante (un seul canvas) et, par
 * module, la peinture de son univers.
 *
 * - Mobile / tablette : bandeau peint en haut (Budget = maison de bains,
 *   Courses = Koriko, Calendrier = le vieux cèdre), fondu à l'arrivée.
 * - Ordinateur : la colonne du monde (à gauche du carnet) montre la
 *   peinture portrait de l'univers en image fixe, en fondu enchaîné d'un
 *   module à l'autre ; la forêt vivante reste pour Maison et Calendrier.
 *
 * Une peinture n'est chargée qu'au premier passage sur son module (rien de
 * plus au démarrage sur Maison), puis gardée pour les fondus.
 */
import { useEffect, useState } from 'react';
import { cx } from '../ui';
import { manifest } from '../world/manifest';
import { WorldStage } from '../world/WorldContext';
import { UNIVERSES } from './modules';
import { MODULES, type ModuleId } from './prefs';

function useVisited(module: ModuleId): ReadonlySet<ModuleId> {
  const [visited, setVisited] = useState<ReadonlySet<ModuleId>>(() => new Set([module]));
  useEffect(() => {
    setVisited((prev) => (prev.has(module) ? prev : new Set([...prev, module])));
  }, [module]);
  return visited;
}

export function WorldBackdrop({ module, isDesktop }: { module: ModuleId; isDesktop: boolean }) {
  const visited = useVisited(module);
  return (
    <div className="app-world" aria-hidden="true">
      {manifest.placeholder && <img className="app-world__placeholder" src={manifest.placeholder} alt="" />}
      <WorldStage className="app-world__stage" />
      {MODULES.map(({ id }) => {
        const universe = UNIVERSES[id];
        if (!visited.has(id)) return null;
        const image = isDesktop ? universe.backdrop : universe.banner;
        if (image === null) return null;
        return (
          <img
            key={`${id}-${isDesktop ? 'backdrop' : 'banner'}`}
            className={cx(isDesktop ? 'app-world__backdrop' : 'app-world__banner', `app-world__img--${id}`, module === id && 'is-shown')}
            src={image.src}
            style={{ objectPosition: image.position }}
            alt=""
            decoding="async"
            data-universe={id}
          />
        );
      })}
      <div className="app-world__shade" />
    </div>
  );
}
