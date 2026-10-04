/**
 * En-tête du Calendrier, posé sur le bandeau peint (fourni par la coquille) :
 * « Ensemble », le mois affiché, ‹ › et « Aujourd’hui » dès qu'on s'éloigne
 * du jour présent. Titre h1 id="calendar-title" (focus au changement de module).
 */
import { Icon, IconButton } from '../../ui';
import { monthLabel } from './calendarText';

export function CalendarBanner({
  monthKey,
  away,
  onPrev,
  onNext,
  onToday,
}: {
  monthKey: string;
  /** Un autre mois ou un autre jour qu'aujourd'hui est affiché. */
  away: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const { month, year } = monthLabel(monthKey);
  return (
    <div className="world-window world-window--banner cal-banner">
      <div className="cal-bar">
        <div className="cal-bar__titles">
          {away ? (
            <button type="button" className="chip chip--glass cal-bar__today" onClick={onToday}>
              <Icon name="today" size={15} strokeWidth={1.9} />
              Aujourd’hui
            </button>
          ) : (
            <p className="eyebrow cal-bar__eyebrow">Ensemble</p>
          )}
          <h1 id="calendar-title" tabIndex={-1} className="cal-bar__label display" aria-live="polite">
            <span className="visually-hidden">Calendrier, </span>
            <span className="cal-bar__month">{month}</span> <span className="cal-bar__year">{year}</span>
          </h1>
        </div>
        <div className="cal-bar__nav">
          <IconButton icon="chevron-left" label="Mois précédent" variant="glass" onClick={onPrev} />
          <IconButton icon="chevron-right" label="Mois suivant" variant="glass" onClick={onNext} />
        </div>
      </div>
    </div>
  );
}
