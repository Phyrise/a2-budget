/**
 * Carnet — « Lanternes » : la collection des lanternes de pierre. Les
 * modèles débloqués montrent leur peinture, leur nom et une ligne ; les
 * autres restent une silhouette dans la brume (« après huit lanternes ») —
 * leur vraie peinture n'est jamais référencée avant le déblocage.
 * Toucher une lanterne débloquée la pose dans la forêt (selectLantern).
 */
import { LANTERNS, activeLantern, isLanternUnlocked } from '@a2/core';
import { useApp } from '../../../state/store';
import { Icon, cx } from '../../../ui';
import { LANTERN_ENTRIES, lanternName, unlockWords } from '../lantern/lanternData';
import { ToroArt } from '../lantern/ToroArt';
import { NB, capitalizeFirst } from '../ritualText';
import './carnet-lanterns.css';

export function CarnetLanterns() {
  const { appState, selectLantern } = useApp();
  const focus = appState?.focus;
  const chosen = activeLantern(focus);

  return (
    <section className="carnet-section carnet-lanterns" id="carnet-lanterns" aria-labelledby="carnet-lanterns-title">
      <h3 id="carnet-lanterns-title" className="carnet-section__title display">
        Lanternes
      </h3>

      <div className="carnet-lantern-preview">
        <span className="carnet-lantern-preview__art">
          <ToroArt key={chosen} id={chosen} mode="lit" height={132} />
        </span>
        <p className="carnet-lantern-preview__text" aria-live="polite">
          <span className="carnet-lantern-preview__kicker">Posée dans la forêt</span>
          <span className="carnet-lantern-preview__name display">{lanternName(chosen)}</span>
          <span className="carnet-lantern-preview__hint">Elle s’allume quand vous lancez une lanterne.</span>
        </p>
      </div>

      <ul className="carnet-lanterns__grid">
        {LANTERNS.map((def) => {
          const open = isLanternUnlocked(focus, def.id);
          const entry = LANTERN_ENTRIES[def.id];
          const selected = open && def.id === chosen;
          if (!open) {
            return (
              <li key={def.id} className="carnet-lantern is-locked">
                <span className="carnet-lantern__art" aria-hidden="true">
                  <ToroArt id={def.id} mode="silhouette" height={92} />
                </span>
                <span className="carnet-lantern__name">Une lanterne dans la brume</span>
                <span className="carnet-lantern__line">{capitalizeFirst(unlockWords(def))}</span>
              </li>
            );
          }
          return (
            <li key={def.id} className={cx('carnet-lantern', selected && 'is-selected')}>
              <button
                type="button"
                className="carnet-lantern__pick"
                aria-pressed={selected}
                aria-label={selected ? `${lanternName(def.id)}, posée dans la forêt` : `Poser ${lanternName(def.id)} dans la forêt`}
                onClick={() => selectLantern(def.id)}
              >
                <span className="carnet-lantern__art" aria-hidden="true">
                  <ToroArt id={def.id} mode={selected ? 'lit' : 'unlit'} height={92} />
                </span>
                <span className="carnet-lantern__name">{entry?.name ?? lanternName(def.id)}</span>
                <span className="carnet-lantern__line">{entry?.line}</span>
                {selected && (
                  <span className="carnet-lantern__here">
                    <Icon name="check" size={13} /> Dans la forêt
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="carnet-lanterns__foot">
        Chaque lanterne allumée compte{NB}: les suivantes se dévoilent peu à peu.
      </p>
    </section>
  );
}
