/**
 * Courses — la liste commune. Ajout rapide toujours visible (« 2 pommes »,
 * « lait x2 »), rayons automatiques, panier, suggestions des articles
 * fréquents, retrait par glissement ou bouton (annulable).
 */
import { grocerySuggestions, groupGroceryItems, type GroceryItem } from '@a2/core';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Button, Checkbox, EmptyState, Icon, IconButton, cx, fr, plural, useToast } from '../../ui';
import { ItemSheet } from './ItemSheet';
import './courses.css';

const SWIPE_REMOVE = 96;

function ItemRow({
  item,
  highlight,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: GroceryItem;
  highlight: boolean;
  onToggle: (item: GroceryItem) => void;
  onEdit: (item: GroceryItem) => void;
  onRemove: (item: GroceryItem) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean; id: number } | null>(null);
  const [swiping, setSwiping] = useState(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
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

  return (
    <li className={cx('item-row', item.done && 'is-done', highlight && 'is-new', swiping && 'is-swiping')}>
      <span className="item-row__reveal" aria-hidden="true">
        <Icon name="trash" size={20} />
        Retirer
      </span>
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

export function CoursesScreen() {
  const { appState, today, addGrocery, toggleGrocery, removeGrocery, restoreGrocery, clearDoneGroceries } = useApp();
  const { setForegroundSheet } = useShell();
  const toast = useToast();
  const [text, setText] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForegroundSheet(editing !== null);
    return () => setForegroundSheet(false);
  }, [editing, setForegroundSheet]);

  useEffect(() => {
    if (lastAdded === null) return;
    const t = window.setTimeout(() => setLastAdded(null), 1600);
    return () => window.clearTimeout(t);
  }, [lastAdded]);

  const items = appState?.groceries.items ?? [];
  const history = appState?.groceries.history;
  const { toBuy, basket } = useMemo(() => groupGroceryItems(items), [items]);
  const toBuyCount = items.length - basket.length;
  const suggestions = useMemo(() => grocerySuggestions(items, 8, { history, now: today }), [items, history, today]);

  const add = (raw: string) => {
    const result = addGrocery(raw);
    if (result.item === null) return false;
    if (result.added) {
      setLastAdded(result.item.id);
    } else {
      setLastAdded(result.item.id);
      toast.show({ message: fr(`« ${result.item.label} » est déjà dans la liste`), icon: 'info' });
    }
    return true;
  };

  const submit = () => {
    if (add(text)) setText('');
    inputRef.current?.focus();
  };

  const remove = (item: GroceryItem) => {
    const removed = removeGrocery(item.id);
    if (removed === null) return;
    toast.show({
      message: fr(`« ${item.label} » retiré`),
      icon: 'trash',
      action: { label: 'Annuler', onClick: () => restoreGrocery(removed) },
    });
  };

  const clearBasket = () => {
    const n = clearDoneGroceries();
    if (n > 0) toast.show({ message: `${plural(n, 'article')} rangé${n > 1 ? 's' : ''} dans l’historique`, icon: 'check' });
  };

  const summary =
    items.length === 0
      ? 'Rien à acheter pour l’instant'
      : [toBuyCount > 0 ? `${plural(toBuyCount, 'article')} à prendre` : 'Tout est pris', basket.length > 0 ? `${basket.length} dans le panier` : null]
          .filter(Boolean)
          .join(' · ');

  return (
    <>
      <div className="world-window world-window--banner courses-banner">
        <p className="eyebrow month-bar__eyebrow">La liste commune</p>
        <h1 id="courses-title" tabIndex={-1} className="month-bar__label display">
          Courses
        </h1>
        <p className="courses-banner__summary">{summary}</p>
      </div>

      <section className="screen-sheet courses" aria-labelledby="courses-title">
        <ShellNotices />

        <form
          className="quick-add"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="visually-hidden" htmlFor="grocery-input">
            Ajouter un article
          </label>
          <Icon name="plus" size={20} className="quick-add__icon" />
          <input
            ref={inputRef}
            id="grocery-input"
            className="quick-add__input"
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ajouter… ex. 2 pommes"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            maxLength={120}
          />
          <Button type="submit" variant="primary" size="sm" disabled={text.trim() === ''} className="quick-add__submit">
            Ajouter
          </Button>
        </form>

        {suggestions.length > 0 && (
          <div className="suggestions">
            <p className="eyebrow suggestions__title">
              <Icon name="sparkle" size={14} /> Souvent pris
            </p>
            <ul className="suggestions__list">
              {suggestions.map((s) => (
                <li key={s.key}>
                  <button type="button" className="chip suggestions__chip" onClick={() => add(s.label)} aria-label={`Ajouter ${s.label}`}>
                    <Icon name="plus" size={16} strokeWidth={2.2} />
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState title="La liste est vide">
            Tapez un article ci-dessus, avec sa quantité si besoin&nbsp;: <span className="nowrap">«&nbsp;2 pommes&nbsp;»</span>,{' '}
            <span className="nowrap">«&nbsp;lait x2&nbsp;»</span>, <span className="nowrap">«&nbsp;500 g de farine&nbsp;»</span>.
          </EmptyState>
        ) : (
          <>
            {toBuy.length === 0 ? (
              <EmptyState compact art="leaf" title="Tout est dans le panier">
                Il ne reste plus qu’à passer en caisse.
              </EmptyState>
            ) : (
              <div className="aisles">
                {toBuy.map((group) => (
                  <section key={group.category} className="aisle" aria-label={group.label}>
                    <h2 className="aisle__title">
                      <span>{group.label}</span>
                      <span className="aisle__count">{group.items.length}</span>
                    </h2>
                    <ul className="item-list">
                      {group.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          highlight={item.id === lastAdded}
                          onToggle={(i) => toggleGrocery(i.id)}
                          onEdit={setEditing}
                          onRemove={remove}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {basket.length > 0 && (
              <section className="sheet-section basket" aria-labelledby="basket-title">
                <div className="section-head">
                  <h2 id="basket-title" className="section-title">
                    Dans le panier
                  </h2>
                  <span className="section-head__meta">{basket.length}</span>
                </div>
                <ul className="item-list item-list--basket">
                  {basket.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      highlight={false}
                      onToggle={(i) => toggleGrocery(i.id)}
                      onEdit={setEditing}
                      onRemove={remove}
                    />
                  ))}
                </ul>
                <Button variant="ghost" icon="check" onClick={clearBasket} className="basket__clear">
                  Vider le panier
                </Button>
              </section>
            )}
          </>
        )}
      </section>

      <ItemSheet item={editing} onClose={() => setEditing(null)} onRemove={remove} />
    </>
  );
}
