/**
 * V5.3 — mesure la scène et pose la quête (questPlacement.ts) : repères,
 * boutons, champs, montants et lignes de texte de la feuille, en
 * coordonnées de la feuille. Remesure quand la feuille change de taille ou
 * la fenêtre tourne ; rien pendant la fête (l'objet ne bouge plus).
 */
import type { QuestTab } from '@a2/core';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { MAX_SCROLL_SCREENS, PERCHES, fallbackPlace, findPlace, type Place, type Rect } from './questPlacement';

/** Ce que la quête ne recouvre jamais. */
const AVOID =
  'button, input, textarea, select, a[href], label, [role="button"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"]), .amount, .konpeito-jar';
/** Couches qui ne comptent pas (l'objet lui-même, les Noiraudes, le texte masqué). */
const IGNORE = '.quest, .soot-stage, .visually-hidden';

function rel(r: DOMRect, o: DOMRect): Rect {
  return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
}

function visible(el: Element): DOMRect | null {
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1 ? r : null;
}

function measure(sheet: HTMLElement, tab: QuestTab, spot: number): Place {
  const o = sheet.getBoundingClientRect();
  const perches = PERCHES[tab][spot] ?? PERCHES[tab][0]!;
  const anchors = perches.map((p) => {
    const el = sheet.querySelector(p.sel);
    const r = el === null ? null : visible(el);
    return r === null ? null : rel(r, o);
  });
  const avoid: Rect[] = [];
  for (const el of sheet.querySelectorAll(AVOID)) {
    if (el.closest(IGNORE) !== null) continue;
    const r = visible(el);
    if (r !== null) avoid.push(rel(r, o));
  }
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    if ((n.textContent ?? '').trim() === '' || n.parentElement?.closest(IGNORE) != null) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) avoid.push(rel(r, o));
  }
  const docTop = o.top + window.scrollY;
  const bounds = { left: 4, right: o.width - 4, top: 6, bottom: window.innerHeight * MAX_SCROLL_SCREENS - docTop };
  const gutter = parseFloat(getComputedStyle(sheet).paddingLeft) || 16;
  return findPlace(perches, anchors, avoid, bounds) ?? fallbackPlace(spot, o.width, gutter);
}

const same = (a: Place | null, b: Place) => a !== null && a.x === b.x && a.y === b.y && a.perch === b.perch;

/** Place de la quête `id` (null : pas encore mesurée). `frozen` : ne bouge plus. */
export function useQuestPlacement(
  ref: RefObject<HTMLElement | null>,
  tab: QuestTab,
  spot: number,
  id: string | null,
  frozen: boolean,
): Place | null {
  const [place, setPlace] = useState<Place | null>(null);
  useLayoutEffect(() => {
    const sheet = ref.current?.closest<HTMLElement>('.screen-sheet') ?? null;
    if (id === null || sheet === null || frozen) return;
    let raf = 0;
    const run = () => {
      const next = measure(sheet, tab, spot);
      setPlace((prev) => (same(prev, next) ? prev : next));
    };
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(run);
    };
    run();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    ro?.observe(sheet);
    window.addEventListener('resize', later);
    // Polices et images arrivent un peu après : une mesure de plus.
    const settle = window.setTimeout(later, 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      ro?.disconnect();
      window.removeEventListener('resize', later);
    };
  }, [ref, tab, spot, id, frozen]);
  return id === null ? null : place;
}
