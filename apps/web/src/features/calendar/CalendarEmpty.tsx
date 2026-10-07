/**
 * États vides illustrés du Calendrier (univers Totoro, V4) : Totoro sous son
 * parapluie-feuille attend à l'arrêt quand rien n'est à venir ; Totoro
 * endormi quand un jour (ou un mois) est libre. Jamais de reproche : un jour
 * sans rien est un jour tranquille. Pas de bouton d'action ici : l'unique
 * « + » est en tête du jour choisi, on y renvoie d'un mot. Totoro endormi se
 * touche pour rien : il bâille, s'étire et se rendort (SleepingTotoro).
 */
import { calendarTheme } from '../../themes/manifest';
import { SleepingTotoro } from './SleepingTotoro';

export function CalendarEmpty({ hasPast }: { hasPast: boolean }) {
  return (
    <div className="cal-empty">
      <img
        className="cal-empty__art"
        src={calendarTheme.totoro.umbrella}
        alt=""
        width={104}
        height={132}
        decoding="async"
        draggable={false}
      />
      <p className="cal-empty__title">{hasPast ? 'Rien de prévu pour l’instant' : 'Le calendrier est tout calme'}</p>
      <p className="cal-empty__text">
        Totoro attend le prochain bus sous la pluie. Un dîner, un anniversaire, une sortie, un week-end…
        Touchez&nbsp;+ pour noter ce que vous vivrez ensemble.
      </p>
    </div>
  );
}

export function DayEmpty({ month = false }: { month?: boolean }) {
  return (
    <div className="cal-day-empty">
      <SleepingTotoro />
      <p className="cal-day-empty__text">
        {month ? 'Rien de prévu ce mois-ci, pour l’instant.' : 'Rien de prévu ce jour-là.'}
      </p>
    </div>
  );
}
