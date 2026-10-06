/**
 * Curseur de montant en euros entiers (variante « montant » du Slider) :
 * salaires 0–5 000 €, compléments 0–3 000 €.
 *
 * - Le glissement avance par crans de 10 € (`stepEuros`) ; les boutons − / +
 *   ajustent à l'euro près (appui long qui accélère, voir holdRepeat) ;
 *   clavier : flèches ±1 €, Page ±100 €, Début / Fin = bornes.
 * - Toucher le montant pour le saisir (EuroValue) : une valeur au-delà du
 *   maximum est acceptée, le curseur se cale alors au bout de la piste.
 * - Brouillon local pendant le geste ; validation à la fin du geste ou après
 *   une courte pause, pour ne pas écrire à chaque pixel.
 * - Petit retour haptique (`navigator.vibrate`) à chaque cran, si disponible.
 *
 * Identifiants : `id` = la piste (input range) ; `${id}-value` / `${id}-edit`
 * = le montant à toucher ; `${id}-minus` / `${id}-plus` = les boutons.
 */
import { formatEuros, roundToEuroCents } from '@a2/core';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { EuroValue } from './EuroValue';
import { cx } from './format';
import { haptic, nextEuros, useHoldRepeat } from './holdRepeat';
import { Icon } from './Icon';
import './slider.css';
import './euroControls.css';

export interface EuroSliderProps {
  id: string;
  /** Libellé visible court (« Salaire »). */
  label: string;
  /** Nom accessible complet (« Salaire de AL ») ; défaut : label. */
  accessibleLabel?: string;
  hint?: ReactNode;
  valueCents: number;
  onCommit: (cents: number) => void;
  /** Borne haute de la piste, en euros (la saisie peut aller au-delà). */
  maxEuros: number;
  /** Cran du glissement, en euros (défaut 10). */
  stepEuros?: number;
  className?: string;
}

const COMMIT_DELAY_MS = 350;

function wholeEuros(cents: number): number {
  return roundToEuroCents(cents) / 100;
}

export function EuroSlider({
  id,
  label,
  accessibleLabel,
  hint,
  valueCents,
  onCommit,
  maxEuros,
  stepEuros = 10,
  className,
}: EuroSliderProps) {
  const name = accessibleLabel ?? label;
  const [draft, setDraft] = useState<number | null>(null); // euros
  const [dragging, setDragging] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<number | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const valueRef = useRef(valueCents);
  valueRef.current = valueCents;

  const shownEuros = draft ?? wholeEuros(valueCents);
  const shownRef = useRef(shownEuros);
  shownRef.current = shownEuros;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const pending = latest.current;
    latest.current = null;
    setDraft(null);
    if (pending !== null && pending * 100 !== valueRef.current) commitRef.current(pending * 100);
  };

  /** Brouillon (euros) ; validation différée si `defer`, sinon au relâché. */
  const preview = (euros: number, defer: boolean): boolean => {
    const next = Math.max(0, euros);
    if (next === shownRef.current) return false;
    haptic(4);
    latest.current = next;
    shownRef.current = next;
    setDraft(next);
    window.clearTimeout(timer.current);
    if (defer) timer.current = window.setTimeout(flush, COMMIT_DELAY_MS);
    return true;
  };

  const minus = useHoldRepeat((step) => preview(nextEuros(shownRef.current, -1, step), false), flush);
  const plus = useHoldRepeat((step) => preview(nextEuros(shownRef.current, 1, step), false), flush);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const v = shownRef.current;
    const map: Record<string, number> = {
      ArrowRight: v + 1,
      ArrowUp: v + 1,
      ArrowLeft: v - 1,
      ArrowDown: v - 1,
      PageUp: v + 100,
      PageDown: v - 100,
      Home: 0,
      End: maxEuros,
    };
    const target = map[event.key];
    if (target === undefined) return;
    event.preventDefault();
    preview(target, true);
  };

  const onTrack = Math.min(maxEuros, shownEuros);
  const fill = (onTrack / maxEuros) * 100;
  const active = draft !== null;

  return (
    <div className={cx('slider', 'euro-slider', dragging && 'is-dragging', active && 'is-active', className)}>
      <div className="slider__head">
        <div className="slider__titles">
          <label className="slider__label" htmlFor={id}>
            {label}
          </label>
          {hint && (
            <p className="slider__hint" id={`${id}-hint`}>
              {hint}
            </p>
          )}
        </div>
        <EuroValue
          id={id}
          label={name}
          valueCents={draft !== null ? draft * 100 : valueCents}
          active={active}
          onCommit={(cents) => {
            window.clearTimeout(timer.current);
            latest.current = null;
            setDraft(null);
            commitRef.current(cents);
          }}
        />
      </div>
      <div className="slider__row">
        <button
          id={`${id}-minus`}
          type="button"
          className="slider__step euro-step"
          aria-label={`${name} : moins 1 €`}
          disabled={shownEuros <= 0}
          {...minus}
        >
          <Icon name="minus" size={20} strokeWidth={2} />
        </button>
        <input
          id={id}
          className="slider__input"
          type="range"
          min={0}
          max={maxEuros}
          step={1}
          value={onTrack}
          aria-label={name}
          aria-valuetext={formatEuros(shownEuros * 100)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          style={{ '--fill': `${fill}%` } as CSSProperties}
          onChange={(event) => {
            const raw = Number(event.target.value);
            preview(Math.round(raw / stepEuros) * stepEuros, true);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={() => {
            if (latest.current !== null) flush();
          }}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => {
            setDragging(false);
            flush();
          }}
          onPointerCancel={() => {
            setDragging(false);
            flush();
          }}
          onBlur={() => {
            setDragging(false);
            if (latest.current !== null) flush();
          }}
        />
        <button
          id={`${id}-plus`}
          type="button"
          className="slider__step euro-step"
          aria-label={`${name} : plus 1 €`}
          {...plus}
        >
          <Icon name="plus" size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
