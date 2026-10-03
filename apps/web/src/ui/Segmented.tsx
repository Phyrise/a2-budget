import type { ReactNode } from 'react';
import { cx } from './format';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Libellé accessible si `label` n'est pas du texte. */
  ariaLabel?: string;
}

/**
 * Choix exclusif en pastilles (radios natives : flèches du clavier, lecteurs
 * d'écran). `columns` force une grille (ex. 7 jours de la semaine).
 */
export function Segmented<T extends string>({
  name,
  legend,
  legendVisible = true,
  options,
  value,
  onChange,
  columns,
  className,
  size = 'md',
}: {
  name: string;
  legend: string;
  legendVisible?: boolean;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  columns?: number;
  className?: string;
  size?: 'md' | 'sm';
}) {
  return (
    <fieldset className={cx('segmented', size === 'sm' && 'segmented--sm', className)}>
      <legend className={legendVisible ? 'field__label' : 'visually-hidden'}>{legend}</legend>
      <div
        className="segmented__track"
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <div className="segmented__item" key={option.value}>
              <input
                className="segmented__input"
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                aria-label={option.ariaLabel}
              />
              <label className="segmented__label" htmlFor={id}>
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
