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
 * plus au démarrage sur Maison), puis gardée pour les fondus. En automne et
 * en hiver, Budget et Courses montrent leur variante de saison, en fondu
 * par-dessus la base si elle arrive après le premier rendu.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../ui';
import type { Season } from '../world/types';
import { manifest } from '../world/manifest';
import { WorldStage, useWorld } from '../world/WorldContext';
import { UNIVERSES, imageForSeason, type UniverseImage } from './modules';
import { MODULES, type ModuleId } from './prefs';

/** Après le fondu de la variante, la base (image d'attente) quitte le DOM. */
const BASE_RELEASE_MS = 900;

function useVisited(module: ModuleId): ReadonlySet<ModuleId> {
  const [visited, setVisited] = useState<ReadonlySet<ModuleId>>(() => new Set([module]));
  useEffect(() => {
    setVisited((prev) => (prev.has(module) ? prev : new Set([...prev, module])));
  }, [module]);
  return visited;
}

/**
 * Une peinture d'univers. En automne / hiver (Budget, Courses), la variante
 * de saison se pose sur la base : la base sert d'image d'attente et la
 * variante arrive en fondu ; déjà en cache (décodée) au montage, elle
 * s'affiche sans fondu. Un retour à la base (fin d'aperçu) la remontre.
 */
function UniversePainting({ id, image, season, shown, desktop }: { id: ModuleId; image: UniverseImage; season: Season; shown: boolean; desktop: boolean }) {
  const target = imageForSeason(image, season);
  const seasonal = target !== image.src;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [instant, setInstant] = useState(false);
  const [baseReleased, setBaseReleased] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const ready = seasonal && loaded === target;

  useLayoutEffect(() => {
    const img = ref.current;
    if (seasonal && img && img.complete && img.naturalWidth > 0) {
      setInstant(true);
      setLoaded(target);
    }
  }, [seasonal, target]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setBaseReleased(target), instant ? 0 : BASE_RELEASE_MS);
    return () => window.clearTimeout(t);
  }, [ready, instant, target]);

  const cls = desktop ? 'app-world__backdrop' : 'app-world__banner';
  const style = { objectPosition: image.position };
  return (
    <>
      {!(ready && baseReleased === target) && (
        <img
          className={cx(cls, `app-world__img--${id}`, shown && 'is-shown')}
          src={image.src}
          style={style}
          alt=""
          decoding="async"
          data-universe={id}
          data-season="base"
        />
      )}
      {seasonal && (
        <img
          key={target}
          ref={ref}
          className={cx(cls, `app-world__img--${id}`, 'app-world__season', ready && 'is-ready', instant && 'is-instant', shown && 'is-shown')}
          src={target}
          style={style}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(target)}
          data-universe={id}
          data-season={season}
        />
      )}
    </>
  );
}

export function WorldBackdrop({ module, isDesktop }: { module: ModuleId; isDesktop: boolean }) {
  const visited = useVisited(module);
  const { state } = useWorld();
  // Saison affichée (réelle, ou aperçu du mode développeur).
  const season = state?.season ?? 'summer';
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
          <UniversePainting
            key={`${id}-${isDesktop ? 'backdrop' : 'banner'}`}
            id={id}
            image={image}
            season={season}
            shown={module === id}
            desktop={isDesktop}
          />
        );
      })}
      <div className="app-world__shade" />
    </div>
  );
}
