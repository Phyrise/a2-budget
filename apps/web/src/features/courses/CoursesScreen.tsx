/**
 * Courses — la liste commune, dans l'univers de Kiki la petite sorcière.
 * Ajout rapide toujours visible (« 2 pommes », « lait x2 »), rayons
 * automatiques illustrés, coup de balai vers le panier en osier (Jiji veille
 * dessus et donne un coup de patte à chaque article qui arrive), suggestions
 * des articles fréquents, retrait par glissement ou bouton (annulable), envol
 * de Kiki quand on vide le panier.
 *
 * L'état est écrit tout de suite (cocher reste instantané) ; seules les
 * animations sont différées : pendant le coup de balai, l'article coché est
 * encore dessiné dans son rayon, puis il apparaît dans le panier.
 */
import { grocerySuggestions, groupGroceryItems, type GroceryItem } from '@a2/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { coursesTheme } from '../../themes/manifest';
import { Button, Icon, fr, plural, useToast } from '../../ui';
import { BasketStage } from './BasketStage';
import { ItemRow, type RowMotion } from './ItemRow';
import { ItemSheet } from './ItemSheet';
import { AllInBasket, CoursesEmpty, KikiFlight, KikiGreeting } from './KikiScenes';
import { FLIGHT_MS, JIJI_BAG_MS, basketFill, coursesSounds, jijiPose, markGreeted, prefersReducedMotion, shouldGreet } from './kiki';
import { useIdSet } from './useIdSet';
import './courses.css';
import './courses-sweep.css';
import './courses-kiki.css';

export function CoursesScreen() {
  const { appState, today, addGrocery, toggleGrocery, removeGrocery, restoreGrocery, clearDoneGroceries } = useApp();
  const { setForegroundSheet } = useShell();
  const toast = useToast();
  const [text, setText] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const sweeping = useIdSet();
  const returning = useIdSet();
  const [landed, setLanded] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const [paw, setPaw] = useState(0);
  const [bagUntil, setBagUntil] = useState(0);
  const [flight, setFlight] = useState<{ reduced: boolean } | null>(null);
  const [greeting, setGreeting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => appState?.groceries.items ?? [], [appState]);
  const history = appState?.groceries.history;
  const total = items.length;

  useEffect(() => {
    setForegroundSheet(editing !== null);
    return () => setForegroundSheet(false);
  }, [editing, setForegroundSheet]);

  useEffect(() => {
    if (lastAdded === null) return;
    const t = window.setTimeout(() => setLastAdded(null), 1600);
    return () => window.clearTimeout(t);
  }, [lastAdded]);

  useEffect(() => {
    if (landed === null) return;
    const t = window.setTimeout(() => setLanded(null), 900);
    return () => window.clearTimeout(t);
  }, [landed]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (bagUntil === 0) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, bagUntil - Date.now()) + 20);
    return () => window.clearTimeout(t);
  }, [bagUntil]);

  // Première ouverture du jour : Kiki salue, à l'arrivée sur l'écran et
  // seulement s'il reste à prendre (jamais au milieu d'un ajout).
  const greetChecked = useRef(false);
  useEffect(() => {
    if (greetChecked.current || appState === null) return;
    greetChecked.current = true;
    if (items.some((i) => !i.done) && shouldGreet(today)) {
      setGreeting(true);
      markGreeted(today);
    }
  }, [appState, items, today]);

  // Pendant le coup de balai, l'article coché reste dessiné dans son rayon.
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const display = useMemo(
    () => items.map((i) => (i.done && sweeping.has(i.id) ? { ...i, done: false } : i)),
    [items, sweeping],
  );
  const { toBuy, basket } = useMemo(() => groupGroceryItems(display), [display]);
  const done = useMemo(() => items.filter((i) => i.done).length, [items]);
  const suggestions = useMemo(() => grocerySuggestions(items, 8, { history, now: today }), [items, history, today]);
  const toBuyCount = total - done;
  // Le panier et Jiji suivent ce qui y est déjà tombé (pas les articles en vol).
  const inBasket = basket.length;
  const fill = basketFill(inBasket, total);
  const pose = jijiPose(total, inBasket, bagUntil > Date.now());

  // Tout est au panier : « Tout est dans le panier » suffit, le salut s'efface.
  useEffect(() => {
    if (greeting && toBuyCount === 0) setGreeting(false);
  }, [greeting, toBuyCount]);

  const nudgeJiji = () => setBagUntil(Date.now() + JIJI_BAG_MS);

  const add = (raw: string) => {
    const result = addGrocery(raw);
    if (result.item === null) return false;
    setLastAdded(result.item.id);
    if (result.added) nudgeJiji();
    else toast.show({ message: fr(`« ${result.item.label} » est déjà dans la liste`), icon: 'info' });
    return true;
  };

  const submit = () => {
    if (add(text)) setText('');
    inputRef.current?.focus();
  };

  const toggle = (item: GroceryItem) => {
    toggleGrocery(item.id);
    if (!item.done) {
      returning.remove(item.id);
      sweeping.add(item.id);
      setPaw((n) => n + 1);
    } else if (sweeping.has(item.id)) {
      // Décoché pendant le coup de balai : il reste dans son rayon.
      sweeping.remove(item.id);
    } else {
      returning.add(item.id);
      coursesSounds.unsweep();
    }
  };

  const onMotionEnd = useCallback(
    (id: string, motion: RowMotion) => {
      if (motion === 'return') {
        returning.remove(id);
        return;
      }
      // Le focus suit : la case suivante à prendre, sinon le titre du panier.
      const row = document.querySelector(`.aisles .item-row[data-id="${CSS.escape(id)}"]`);
      const hadFocus = row !== null && row.contains(document.activeElement);
      if (hadFocus) {
        const boxes = [...document.querySelectorAll<HTMLElement>('.aisles .item-row:not(.is-sweeping) .check')];
        const after = boxes.find((b) => row.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        (after ?? boxes[boxes.length - 1] ?? document.getElementById('basket-title'))?.focus({ preventScroll: true });
      }
      sweeping.remove(id);
      setLanded(id);
      setBump((n) => n + 1);
      nudgeJiji();
    },
    [returning, sweeping],
  );

  const remove = (item: GroceryItem) => {
    const removed = removeGrocery(item.id);
    if (removed === null) return;
    sweeping.remove(item.id);
    returning.remove(item.id);
    toast.show({
      message: fr(`Retiré de la liste : ${item.label}`),
      icon: 'trash',
      action: { label: 'Annuler', onClick: () => restoreGrocery(removed) },
    });
  };

  const flightTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (flightTimer.current !== null) window.clearTimeout(flightTimer.current);
  }, []);

  const clearBasket = () => {
    const n = clearDoneGroceries();
    if (n <= 0) return;
    const reduced = prefersReducedMotion();
    const message = `${plural(n, 'article')} rangé${n > 1 ? 's' : ''} dans l’historique`;
    setFlight({ reduced });
    if (flightTimer.current !== null) window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(
      () => {
        flightTimer.current = null;
        setFlight(null);
        toast.show({ message, icon: 'check' });
      },
      reduced ? 700 : FLIGHT_MS,
    );
  };

  const summary =
    total === 0
      ? 'Rien à acheter pour l’instant'
      : [toBuyCount > 0 ? `${plural(toBuyCount, 'article')} à prendre` : 'Tout est pris', done > 0 ? `${done} dans le panier` : null]
          .filter(Boolean)
          .join(' · ');

  const motionOf = (id: string): RowMotion =>
    sweeping.has(id) ? 'sweep' : returning.has(id) ? 'return' : landed === id ? 'landed' : null;

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

        {greeting && toBuyCount > 0 && <KikiGreeting toBuy={toBuyCount} now={today} onClose={() => setGreeting(false)} />}

        {suggestions.length > 0 && (
          <div className="suggestions">
            <p className="eyebrow suggestions__title">
              <Icon name="sparkle" size={14} /> Souvent pris
            </p>
            <ul className="suggestions__list">
              {suggestions.map((s) => (
                <li key={s.key}>
                  <button type="button" className="chip suggestions__chip" onClick={() => add(s.label)} aria-label={`Ajouter ${s.label}`}>
                    <img className="suggestions__icon" src={coursesTheme.categories[s.category]} alt="" aria-hidden="true" draggable={false} />
                    {s.label}
                    <Icon name="plus" size={15} strokeWidth={2.2} className="suggestions__plus" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {total === 0 ? (
          <CoursesEmpty />
        ) : (
          <>
            {toBuy.length === 0 ? (
              <AllInBasket />
            ) : (
              <div className="aisles">
                {toBuy.map((group) => (
                  <section key={group.category} className="aisle" aria-label={group.label}>
                    <h2 className="aisle__title">
                      <img className="aisle__icon" src={coursesTheme.categories[group.category]} alt="" aria-hidden="true" draggable={false} />
                      <span>{group.label}</span>
                      <span className="aisle__count">{group.items.filter((i) => !sweeping.has(i.id)).length}</span>
                    </h2>
                    <ul className="item-list">
                      {group.items.map((shown) => (
                        <ItemRow
                          key={shown.id}
                          item={byId.get(shown.id) ?? shown}
                          motion={motionOf(shown.id)}
                          highlight={shown.id === lastAdded}
                          onToggle={toggle}
                          onEdit={setEditing}
                          onRemove={remove}
                          onMotionEnd={onMotionEnd}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <section className="sheet-section basket" aria-labelledby="basket-title">
              <BasketStage fill={fill} pose={pose} done={inBasket} total={total} bump={bump} paw={paw} />
              {basket.length > 0 && (
                <ul className="item-list item-list--basket">
                  {basket.map((item) => (
                    <ItemRow key={item.id} item={item} motion={motionOf(item.id)} onToggle={toggle} onEdit={setEditing} onRemove={remove} />
                  ))}
                </ul>
              )}
              {done > 0 && (
                <Button variant="ghost" icon="check" onClick={clearBasket} className="basket__clear">
                  Vider le panier
                </Button>
              )}
            </section>
          </>
        )}
      </section>

      {flight && <KikiFlight reduced={flight.reduced} />}
      <ItemSheet item={editing} onClose={() => setEditing(null)} onRemove={remove} />
    </>
  );
}
