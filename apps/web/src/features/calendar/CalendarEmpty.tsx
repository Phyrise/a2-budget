/**
 * États vides illustrés du Calendrier (sprites existants des manifests) :
 * Jiji qui prend le thé quand rien n'est prévu, un kodama pour un jour libre.
 * Jamais de reproche : un jour sans rien est un jour tranquille.
 */
import { coursesTheme } from '../../themes/manifest';
import { Button } from '../../ui';
import { manifest } from '../../world/manifest';

const KODAMA = manifest.sprites?.kodama?.[3] ?? manifest.sprites?.kodama?.[0] ?? '';

export function CalendarEmpty({ hasPast, onAdd }: { hasPast: boolean; onAdd: () => void }) {
  return (
    <div className="cal-empty">
      <img className="cal-empty__art" src={coursesTheme.jiji.teacup} alt="" width={132} height={120} decoding="async" draggable={false} />
      <p className="cal-empty__title">{hasPast ? 'Rien de prévu pour l’instant' : 'Le calendrier est tout calme'}</p>
      <p className="cal-empty__text">
        Un dîner, un anniversaire, une sortie, un week-end… Notez ce que vous vivez ensemble&#8239;: Jiji et Calcifer s’en
        souviendront pour vous.
      </p>
      <Button variant="primary" icon="plus" onClick={onAdd} className="cal-empty__action">
        Prévoir un moment
      </Button>
    </div>
  );
}

export function DayEmpty({ month = false, onAdd }: { month?: boolean; onAdd?: () => void }) {
  return (
    <div className="cal-day-empty">
      {KODAMA && <img className="cal-day-empty__art" src={KODAMA} alt="" decoding="async" draggable={false} />}
      <p className="cal-day-empty__text">{month ? 'Rien de prévu ce mois-ci, pour l’instant.' : 'Rien de prévu ce jour-là. Une journée tranquille.'}</p>
      {onAdd && (
        <Button variant="ghost" size="sm" icon="plus" onClick={onAdd} className="cal-day-empty__add">
          Prévoir
        </Button>
      )}
    </div>
  );
}
