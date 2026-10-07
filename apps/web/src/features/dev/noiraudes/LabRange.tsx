/** Labo Noiraudes — un curseur étiqueté, sa valeur affichée, réglable au doigt. */
import type { CSSProperties } from 'react';

export function LabRange({
  label,
  value,
  min,
  max,
  step = 1,
  digits = 0,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  digits?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const fill = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const shown = `${value.toFixed(digits)}${unit}`;
  return (
    <label className="nlab-range">
      <span className="nlab-range__label">
        <span className="nlab-range__name">{label}</span>
        <output className="nlab-range__value" aria-hidden="true">
          {shown}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={shown}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
