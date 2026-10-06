/**
 * Sous la grille : petite légende (icône peinte = un moment, anneau de
 * mousse = des tâches de la maison) et l'interrupteur « Tâches », mémorisé
 * (calendarPrefs). Couper n'efface rien : les tâches restent dans Maison.
 */
import { calendarTheme } from '../../themes/manifest';

export function TasksFilter({ show, onChange }: { show: boolean; onChange: (show: boolean) => void }) {
  return (
    <div className="cal-filter">
      <p className="cal-filter__legend" aria-hidden="true">
        <span className="cal-filter__key">
          <img className="cal-filter__icon" src={calendarTheme.kinds.repas} alt="" width={16} height={16} draggable={false} />
          Moments
        </span>
        {show && (
          <span className="cal-filter__key">
            <span className="cal-day__task" />
            Tâches
          </span>
        )}
      </p>
      <button type="button" className="cal-filter__toggle" aria-pressed={show} onClick={() => onChange(!show)}>
        Afficher les tâches
        <span className="cal-filter__pill" aria-hidden="true" />
      </button>
    </div>
  );
}
