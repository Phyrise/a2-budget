/**
 * Accès aux Noiraudes de l'écran affiché (une scène montée à la fois, voir
 * SootStage) pour le reste de l'app : le portage (cases du Budget), la
 * Noiraude qui traverse, le kompeitō tiré du bocal, et les appels du
 * panneau DEV (`summonNoiraudes`, événement `a2:noiraudes`). Sans scène
 * montée, tout est sans effet.
 */
import type { Point } from '../susuwatari';
import type { SootDirector, SootScreen } from './director';
import { treatCancel, treatDrop, treatMove, treatStart } from './herd';
import type { KonpeitoTone } from './items';
import { porters, runner, type PortTarget } from './porters';

let active: SootDirector | null = null;

/** Dix essais (1,5 s) au plus. */
const busyForever = (tries: number) => tries >= 10;
let jarEl: HTMLElement | null = null;

function jarPoint(): Point | null {
  const r = jarEl?.getBoundingClientRect();
  if (!r || r.width === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.45 };
}

/** Le bocal frémit : un kompeitō gagné vient d'y tomber. */
function jarBump(): void {
  if (!jarEl) return;
  jarEl.classList.remove('is-fed');
  void jarEl.offsetWidth;
  jarEl.classList.add('is-fed');
}

export function attachSoot(d: SootDirector): void {
  active = d;
  d.jar = jarPoint;
  d.onGift = jarBump;
}

export function detachSoot(d: SootDirector): void {
  if (active === d) active = null;
}

/** Le bocal de l'écran (cible des kompeitō gagnés), ou null. */
export function registerJar(el: HTMLElement | null): void {
  jarEl = el;
}

export const soot = {
  /** Une case de virement cochée (`paid`) ou décochée en `origin`. */
  porters(origin: Point, paid: boolean, target: PortTarget | null): void {
    if (active) porters(active, origin, paid, target);
  },
  /**
   * Un montant a changé : une Noiraude traverse avec un kompeitō. Le clavier
   * met un instant à se fermer : on attend jusqu'à 1,5 s qu'il soit parti.
   */
  runner(tone: KonpeitoTone): boolean {
    const d = active;
    if (d === null || d.calm) return false;
    let tries = 0;
    const attempt = () => {
      if (active !== d || runner(d, tone) !== null || busyForever(++tries)) return;
      d.later(150, attempt);
    };
    attempt();
    return true;
  },
  /** Kompeitō tiré du bocal : faux s'il n'y a pas de scène. */
  treatStart(p: Point): boolean {
    if (!active) return false;
    treatStart(active, p);
    return true;
  },
  treatMove(p: Point): void {
    if (active) treatMove(active, p);
  },
  /** Lâché : vrai s'il est donné aux Noiraudes (il coûte alors 1 kompeitō). */
  treatDrop(p: Point): boolean {
    return active !== null && treatDrop(active, p);
  },
  treatCancel(): void {
    if (active) treatCancel(active);
  },
};

/** Ce que le panneau DEV peut faire venir sans attendre. */
export type SootSummon = 'stray' | 'golden' | 'procession' | 'lost';
export const SUMMON_EVENT = 'a2:noiraudes';

export interface SummonDetail {
  kind: SootSummon;
  /** Seule la scène de cet écran répond (sinon celle qui est montée). */
  screen?: SootScreen;
}

/** Fait venir une Noiraude (ou la procession) dès qu'aucune feuille n'est ouverte. */
export function summonNoiraudes(kind: SootSummon, screen?: SootScreen): void {
  const detail: SummonDetail = screen ? { kind, screen } : { kind };
  window.dispatchEvent(new CustomEvent<SummonDetail>(SUMMON_EVENT, { detail }));
}
