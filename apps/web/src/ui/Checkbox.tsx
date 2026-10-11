import { forwardRef, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { cx } from './format';

export type CheckTone = 'a' | 'b' | 'both' | 'unassigned' | 'neutral';

/**
 * Case ronde de 48 px (cercle visible de 30 px) avec coche dessinée
 * (stroke-dashoffset). Le clic transmet ses coordonnées d'écran — ou le
 * centre de la case au clavier — pour lancer la lumière depuis la case.
 * V5.10 : `onLongPress` — appui long tactile (LONG_PRESS_MS, doigt
 * immobile) qui remplace la coche (le clic qui suit est ignoré).
 * La feuille ouverte doigt posé, iOS Safari peut envoyer le clic de fin sur
 * son fond (qui la fermerait) : après un appui long, le prochain clic est
 * avalé au niveau du document (capture, une fois, ≈ SWALLOW_MS après le relâché).
 */
const LONG_PRESS_MS = 450;
/** Au-delà (px), le doigt fait défiler : pas d'appui long. */
const LONG_PRESS_SLOP = 10;
/** Retard du minuteur (ms) au-delà duquel on laisse d'abord passer les événements en attente. */
const LATE_MS = 80;
/** Fenêtre (ms) après le relâché pendant laquelle le clic de fin est avalé. */
const SWALLOW_MS = 500;
/** Doigt jamais relevé (événement perdu) : on cesse d'attendre. */
const SWALLOW_MAX_MS = 10_000;

export const Checkbox = forwardRef<
  HTMLButtonElement,
  {
    checked: boolean;
    label: string;
    onToggle: (origin: { x: number; y: number }) => void;
    tone?: CheckTone;
    className?: string;
    disabled?: boolean;
    size?: 'md' | 'sm';
    /** id d'un élément qui décrit la case (aria-describedby). */
    describedBy?: string;
    /** Appui long sur la case (sans cocher). */
    onLongPress?: (origin: { x: number; y: number }) => void;
  }
>(function Checkbox({ checked, label, onToggle, tone = 'neutral', className, disabled, size = 'md', describedBy, onLongPress }, ref) {
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const fired = useRef(false);
  const unswallow = useRef<(() => void) | null>(null);
  const cancel = () => {
    if (press.current !== null) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(
    () => () => {
      cancel();
      unswallow.current?.();
    },
    [],
  );
  /** Avale le prochain clic, où qu'il tombe (fond de la feuille compris). */
  const swallowNextClick = () => {
    unswallow.current?.();
    let timer = window.setTimeout(() => done(), SWALLOW_MAX_MS);
    const eat = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      done();
    };
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => done(), SWALLOW_MS);
    };
    const done = () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', eat, true);
      document.removeEventListener('pointerup', arm, true);
      document.removeEventListener('pointercancel', arm, true);
      if (unswallow.current === done) unswallow.current = null;
      fired.current = false;
    };
    document.addEventListener('click', eat, true);
    document.addEventListener('pointerup', arm, true);
    document.addEventListener('pointercancel', arm, true);
    unswallow.current = done;
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    fired.current = false;
    // Geste tactile (doigt, stylet) : à la souris, le menu ⋯ ou le toast suffisent.
    if (onLongPress === undefined || event.pointerType === 'mouse') return;
    cancel();
    const { clientX: x, clientY: y } = event;
    const due = performance.now() + LONG_PRESS_MS;
    // Minuteur en retard (page occupée) : le relâché attend peut-être encore
    // dans la file — on lui laisse passer devant avant de conclure.
    const settle = () => {
      if (press.current === null) return;
      if (performance.now() - due > LATE_MS) {
        press.current.timer = window.setTimeout(fire, 30);
        return;
      }
      fire();
    };
    const fire = () => {
      if (press.current === null) return;
      press.current = null;
      fired.current = true;
      swallowNextClick();
      onLongPress({ x, y });
    };
    press.current = { x, y, timer: window.setTimeout(settle, LONG_PRESS_MS) };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (p !== null && Math.hypot(event.clientX - p.x, event.clientY - p.y) > LONG_PRESS_SLOP) cancel();
  };
  const handle = (event: MouseEvent<HTMLButtonElement>) => {
    // Le clic qui termine un appui long ne coche pas.
    if (fired.current) {
      fired.current = false;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const fromKeyboard = event.detail === 0;
    onToggle({
      x: fromKeyboard ? rect.left + rect.width / 2 : event.clientX,
      y: fromKeyboard ? rect.top + rect.height / 2 : event.clientY,
    });
  };
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={handle}
      onPointerDown={onLongPress ? down : undefined}
      onPointerMove={onLongPress ? move : undefined}
      onPointerUp={onLongPress ? cancel : undefined}
      onPointerCancel={onLongPress ? cancel : undefined}
      onPointerLeave={onLongPress ? cancel : undefined}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      className={cx('check', `check--${tone}`, size === 'sm' && 'check--sm', checked && 'is-checked', className)}
    >
      <svg className="check__svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle className="check__ring" cx="16" cy="16" r="13.5" />
        <circle className="check__fill" cx="16" cy="16" r="13.5" />
        <path className="check__mark" d="M10.2 16.6l3.9 3.8 7.8-8.4" pathLength={1} />
      </svg>
    </button>
  );
});
