/**
 * Le monde derrière l'interface : la forêt vivante (un seul canvas) et, par
 * module, la peinture de son univers.
 *
 * - Mobile / tablette : bandeau peint en haut (Budget = maison de bains,
 *   Courses = Koriko, Calendrier = l'arrêt de bus de Totoro), fondu à l'arrivée.
 * - Ordinateur : la colonne du monde (à gauche du carnet) montre la
 *   peinture portrait de l'univers en image fixe, en fondu enchaîné d'un
 *   module à l'autre ; la forêt vivante ne reste que pour Maison.
 *
 * Une peinture n'est chargée qu'au premier passage sur son module (rien de
 * plus au démarrage sur Maison), puis gardée pour les fondus. En automne et
 * en hiver, Budget et Courses montrent leur variante de saison, en fondu
 * par-dessus la dernière peinture affichée (UniversePainting). V4.3 : sur
 * ordinateur, le train des eaux traverse la peinture du Budget une fois par
 * mois (ChihiroTrain).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChihiroTrain } from '../features/fetes/ChihiroTrain';
import { cx } from '../ui';
import type { Season } from '../world/types';
import { manifest } from '../world/manifest';
import { WorldStage, useWorld } from '../world/WorldContext';
import { UNIVERSES, imageForSeason, type UniverseImage } from './modules';
import { MODULES, type ModuleId } from './prefs';

/** Après le fondu de la nouvelle peinture, la précédente (ou l'image d'attente) quitte le DOM. */
const RELEASE_MS = 900;
/** Ordinateur : la base portrait (hors précache) ne sert d'image d'attente que si la variante tarde. */
const DESKTOP_WAIT_MS = 600;

function useVisited(module: ModuleId): ReadonlySet<ModuleId> {
  const [visited, setVisited] = useState<ReadonlySet<ModuleId>>(() => new Set([module]));
  useEffect(() => {
    setVisited((prev) => (prev.has(module) ? prev : new Set([...prev, module])));
  }, [module]);
  return visited;
}

const withItem = (set: ReadonlySet<string>, v: string): ReadonlySet<string> => (set.has(v) ? set : new Set([...set, v]));

/** « base » ou la saison de la variante (attribut data-season). */
function seasonOfSrc(image: UniverseImage, src: string): Season | 'base' {
  const hit = Object.entries(image.seasons ?? {}).find(([, u]) => u === src);
  return src !== image.src && hit ? (hit[0] as Season) : 'base';
}

/**
 * Une peinture d'univers. En automne / hiver (Budget, Courses), la variante
 * de saison arrive en fondu par-dessus la dernière peinture affichée — d'une
 * saison à l'autre, jamais de retour par la base (automne → hiver direct).
 * Au premier affichage, l'image d'attente est la base : tout de suite sur
 * téléphone (paysage précaché), sur ordinateur seulement si la variante tarde
 * (portrait hors précache). Déjà décodée au montage, la variante s'affiche
 * sans fondu. Variante introuvable : la base. Un retour à la base (fin
 * d'aperçu) se fait aussi en fondu. `data-universe` ne marque qu'une image à
 * la fois : la peinture en vigueur.
 */
function UniversePainting({ id, image, season, shown, desktop }: { id: ModuleId; image: UniverseImage; season: Season; shown: boolean; desktop: boolean }) {
  const wanted = imageForSeason(image, season);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const front = failed.has(wanted) ? image.src : wanted;
  // Dernière peinture entièrement affichée (null : aucune encore).
  const [settled, setSettled] = useState<string | null>(() => (front === image.src ? image.src : null));
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const [instant, setInstant] = useState(false);
  const [waitBase, setWaitBase] = useState(!desktop);
  const ref = useRef<HTMLImageElement>(null);

  // La base, sans rien dessous : affichée telle quelle (comme hors saison).
  const plain = front === image.src && (settled === null || settled === front);
  const ready = plain || loaded.has(front);
  const back = plain || settled === front ? null : (settled ?? (waitBase ? image.src : null));

  useLayoutEffect(() => {
    const img = ref.current;
    const done = !!img && img.complete && img.naturalWidth > 0;
    // Sans fondu seulement au premier affichage (rien dessous) ; tout changement ensuite est fondu.
    setInstant(done && settled === null);
    if (done) setLoaded((prev) => withItem(prev, front));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front]);

  useEffect(() => {
    if (!ready || settled === front) return;
    const t = window.setTimeout(() => {
      setSettled(front);
      setLoaded(new Set([front]));
    }, instant ? 0 : RELEASE_MS);
    return () => window.clearTimeout(t);
  }, [ready, front, settled, instant]);

  useEffect(() => {
    if (waitBase || ready || settled !== null) return;
    const t = window.setTimeout(() => setWaitBase(true), DESKTOP_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [waitBase, ready, settled]);

  const cls = desktop ? 'app-world__backdrop' : 'app-world__banner';
  const style = { objectPosition: image.position };
  const inForce = ready ? front : (back ?? front);
  return (
    <>
      {(back ? [back, front] : [front]).map((src) => {
        const fading = src === front && !plain;
        return (
          <img
            key={src}
            ref={src === front ? ref : undefined}
            className={cx(
              cls,
              `app-world__img--${id}`,
              fading && 'app-world__season',
              fading && ready && 'is-ready',
              fading && instant && 'is-instant',
              shown && 'is-shown',
            )}
            src={src}
            style={style}
            alt=""
            decoding="async"
            onLoad={() => setLoaded((prev) => withItem(prev, src))}
            onError={src === front && src !== image.src ? () => setFailed((prev) => withItem(prev, src)) : undefined}
            data-universe={src === inForce ? id : undefined}
            data-season={seasonOfSrc(image, src)}
          />
        );
      })}
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
      {isDesktop && <ChihiroTrain shown={module === 'budget'} />}
      <div className="app-world__shade" />
    </div>
  );
}
