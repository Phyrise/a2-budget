/**
 * Curseur accessible (input range natif stylé) pour régler vite un taux.
 *
 * - Pas de 1 % (100 points de base) ; boutons − / + pour l'ajustement fin
 *   (zones tactiles de 44 px), clavier : flèches ±1 %, Page ±10 %,
 *   Début / Fin = bornes.
 * - La valeur s'affiche en grand et s'illumine pendant le glissement.
 * - Brouillon local pendant le geste ; la valeur est validée à la fin du
 *   geste (relâché, touche, perte du focus) ou après une courte pause, pour
 *   ne pas écrire à chaque pixel.
 * - Petit retour haptique (`navigator.vibrate`) à chaque cran, si disponible.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { cx, percent } from './format';
import './slider.css';

export interface SliderProps {
  id?: string;
  label: string;
  /** Aide courte sous le libellé (ex. « sur le salaire »). */
  hint?: ReactNode;
  /** Valeur en points de base (40 % = 4000). */
  valueBps: number;
  onCommit: (bps: number) => void;
  /** Valeur suivie pendant le geste (null quand elle est validée), pour un aperçu en direct. */
  onDraft?: (bps: number | null) => void;
  minBps?: number;
  maxBps?: number;
  /** Pas du curseur et des boutons (défaut : 1 % = 100). */
  stepBps?: number;
  className?: string;
}

const COMMIT_DELAY_MS = 350;

function haptic(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(6);
  } catch {
    // Retour haptique facultatif.
  }
}

export function Slider({
  id,
  label,
  hint,
  valueBps,
  onCommit,
  onDraft,
  minBps = 0,
  maxBps = 10_000,
  stepBps = 100,
  className,
}: SliderProps) {
  const auto = useId();
  const inputId = id ?? `slider-${auto}`;
  const [draft, setDraft] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const draftRef = useRef(onDraft);
  draftRef.current = onDraft;
  const latest = useRef<number | null>(null);

  const shown = draft ?? valueBps;
  const clamp = (bps: number) => Math.min(maxBps, Math.max(minBps, bps));

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const pending = latest.current;
    latest.current = null;
    setDraft(null);
    draftRef.current?.(null);
    if (pending !== null && pending !== valueBps) commitRef.current(pending);
  };

  // Validation différée si le geste ne se termine pas proprement.
  const schedule = (bps: number) => {
    latest.current = bps;
    setDraft(bps);
    draftRef.current?.(bps);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, COMMIT_DELAY_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (bps: number, immediate = false) => {
    const next = clamp(bps);
    if (next === shown && !immediate) return;
    if (next !== shown) haptic();
    if (immediate) {
      latest.current = next;
      flush();
    } else {
      schedule(next);
    }
  };

  // Les boutons partent du cran le plus proche (33,33 % → 34 % / 33 %).
  const stepFrom = (direction: 1 | -1) => {
    const snapped = direction > 0 ? Math.floor(shown / stepBps) * stepBps + stepBps : Math.ceil(shown / stepBps) * stepBps - stepBps;
    change(snapped, true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const big = stepBps * 10;
    const map: Record<string, number> = {
      ArrowRight: shown + stepBps,
      ArrowUp: shown + stepBps,
      ArrowLeft: shown - stepBps,
      ArrowDown: shown - stepBps,
      PageUp: shown + big,
      PageDown: shown - big,
      Home: minBps,
      End: maxBps,
    };
    const target = map[event.key];
    if (target === undefined) return;
    event.preventDefault();
    change(target);
  };

  const fill = ((shown - minBps) / (maxBps - minBps)) * 100;
  const text = percent(shown);

  return (
    <div className={cx('slider', dragging && 'is-dragging', draft !== null && 'is-active', className)}>
      <div className="slider__head">
        <div className="slider__titles">
          <label className="slider__label" htmlFor={inputId}>
            {label}
          </label>
          {hint && (
            <p className="slider__hint" id={`${inputId}-hint`}>
              {hint}
            </p>
          )}
        </div>
        <output className="slider__value amount" htmlFor={inputId} aria-hidden="true">
          {text}
        </output>
      </div>
      <div className="slider__row">
        <button
          type="button"
          className="slider__step"
          aria-label={`${label} : moins 1 %`}
          onClick={() => stepFrom(-1)}
          disabled={shown <= minBps}
        >
          <Icon name="minus" size={20} strokeWidth={2} />
        </button>
        <input
          id={inputId}
          className="slider__input"
          type="range"
          min={minBps}
          max={maxBps}
          step={stepBps}
          value={shown}
          aria-valuetext={text}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
          style={{ '--fill': `${fill}%` } as CSSProperties}
          onChange={(event) => change(Number(event.target.value))}
          onKeyDown={onKeyDown}
          onKeyUp={flush}
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
          type="button"
          className="slider__step"
          aria-label={`${label} : plus 1 %`}
          onClick={() => stepFrom(1)}
          disabled={shown >= maxBps}
        >
          <Icon name="plus" size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
