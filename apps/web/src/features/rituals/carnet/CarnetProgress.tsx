/**
 * Petite barre d'avancée du carnet (prochaine lanterne, stade suivant du
 * cèdre) : une ligne fine, une légende courte facultative. `value` 0..1.
 */
import { cx } from '../../../ui';

export function CarnetProgress({ value, label, srLabel, className }: { value: number; label?: string; srLabel: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className={cx('carnet-progress', className)}>
      <span className="carnet-progress__track" role="progressbar" aria-label={srLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className="carnet-progress__fill" style={{ width: `${pct}%` }} />
      </span>
      {label && <span className="carnet-progress__label">{label}</span>}
    </span>
  );
}
