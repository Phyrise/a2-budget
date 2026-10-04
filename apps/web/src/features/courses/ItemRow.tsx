/**
 * Ligne d'article : case, libellé (tap = modifier), quantité, retrait par
 * glissement ou bouton. Coup de balai quand on la coche (Kiki passe sur la
 * ligne, l'article file vers le panier), retour par le balai quand on la
 * décoche depuis le panier.
 */
import type { GroceryItem } from '@a2/core';
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { coursesTheme } from '../../themes/manifest';
import { Checkbox, Icon, IconButton, cx } from '../../ui';
import { prefersReducedMotion } from './kiki';
import { returnFromBasket, sweepToBasket } from './sweep';

const SWIPE_REMOVE = 96;

export type RowMotion = 'sweep' | 'return' | 'landed' | null;

/** Calque décoratif du coup de balai : Kiki (deux images en alternance) et la poussière. */
function SweepFx({ kind }: { kind: 'sweep' | 'return' }) {
  if (kind === 'return') {
    return (
      <span className="sweep-fx sweep-fx--return" aria-hidden="true">
        <img className="sweep-fx__broom" src={coursesTheme.broom} alt="" draggable={false} />
        <img className="sweep-fx__sparkles" src={coursesTheme.sparkles} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className="sweep-fx" aria-hidden="true">
      <img className="sweep-fx__dust" src={coursesTheme.dust} alt="" draggable={false} />
      <span className="sweep-fx__kiki">
        <img className="sweep-fx__frame sweep-fx__frame--a" src={coursesTheme.kiki.sweepA} alt="" draggable={false} />
        <img className="sweep-fx__frame sweep-fx__frame--b" src={coursesTheme.kiki.sweepB} alt="" draggable={false} />
      </span>
      <img className="sweep-fx__sparkles" src={coursesTheme.sparkles} alt="" draggable={false} />
    </span>
  );
}

export function ItemRow({
  item,
  motion = null,
  highlight = false,
  onToggle,
  onEdit,
  onRemove,
  onMotionEnd,
}: {
  item: GroceryItem;
  motion?: RowMotion;
  highlight?: boolean;
  onToggle: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onRemove: (item: GroceryItem) => void;
  onMotionEnd?: (id: string, motion: RowMotion) => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean; id: number } | null>(null);
  const [swiping, setSwiping] = useState(false);
  const endRef = useRef(onMotionEnd);
  endRef.current = onMotionEnd;

  useLayoutEffect(() => {
    if (motion !== 'sweep' && motion !== 'return') return;
    const row = rowRef.current;
    const content = contentRef.current;
    if (!row || !content) return;
    const reduced = prefersReducedMotion();
    const ctrl = motion === 'sweep' ? sweepToBasket(row, content, reduced) : returnFromBasket(row, content, reduced);
    ctrl.finished.then(
      () => endRef.current?.(item.id, motion),
      () => undefined,
    );
    return () => ctrl.cancel();
  }, [motion, item.id]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || motion === 'sweep') return;
    drag.current = { x: event.clientX, y: event.clientY, dx: 0, active: false, id: event.pointerId };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = contentRef.current;
    if (!d || !el || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4 && dx < 0) {
        d.active = true;
        setSwiping(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (Math.abs(dy) > 10) {
        drag.current = null;
        return;
      } else {
        return;
      }
    }
    d.dx = Math.min(0, dx);
    el.style.transition = 'none';
    el.style.transform = `translateX(${d.dx}px)`;
  };
  const onPointerEnd = () => {
    const d = drag.current;
    const el = contentRef.current;
    drag.current = null;
    if (!d || !el || !d.active) return;
    el.style.transition = '';
    if (d.dx < -SWIPE_REMOVE) {
      el.style.transform = 'translateX(-110%)';
      window.setTimeout(() => onRemove(item), 160);
    } else {
      el.style.transform = '';
      window.setTimeout(() => setSwiping(false), 200);
    }
  };

  const fx = motion === 'sweep' || motion === 'return' ? motion : null;

  return (
    <li
      ref={rowRef}
      data-id={item.id}
      className={cx(
        'item-row',
        item.done && 'is-done',
        highlight && 'is-new',
        swiping && 'is-swiping',
        motion === 'sweep' && 'is-sweeping',
        motion === 'return' && 'is-returning',
        motion === 'landed' && 'is-landed',
      )}
    >
      <span className="item-row__reveal" aria-hidden="true">
        <Icon name="trash" size={20} />
        Retirer
      </span>
      {fx && <SweepFx kind={fx} />}
      <div
        ref={contentRef}
        className="item-row__content"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <Checkbox
          checked={item.done}
          label={item.quantity ? `${item.label} (${item.quantity})` : item.label}
          tone={item.done ? 'neutral' : 'both'}
          size="sm"
          onToggle={() => onToggle(item)}
        />
        <button type="button" className="item-row__body" onClick={() => onEdit(item)} aria-label={`Modifier ${item.label}`}>
          <span className="item-row__label">{item.label}</span>
          {item.quantity && <span className="item-row__qty num">{item.quantity}</span>}
        </button>
        <IconButton icon="close" label={`Retirer ${item.label}`} variant="ghost" className="item-row__remove" onClick={() => onRemove(item)} />
      </div>
    </li>
  );
}
