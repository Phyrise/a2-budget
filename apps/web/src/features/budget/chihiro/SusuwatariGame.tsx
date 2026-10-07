/**
 * Noiraudes vagabondes (V4.2), petit jeu de l'écran Budget : de temps en
 * temps (25–60 s, parfois après un défilement), une Noiraude se pose au bord
 * d'un bloc, trottine quelques secondes puis repart. Un toucher l'attrape :
 * elle saute, laisse un kompeitō, et « Noiraudes attrapées : N » augmente
 * (clé locale dédiée, voir strays.ts).
 * - Jamais sur un contrôle (perchoir choisi loin des boutons et champs) ;
 *   seule la Noiraude reçoit les touchers, la couche est transparente.
 * - Rien pendant une feuille ou le clavier (elle s'en va aussitôt), ni onglet
 *   caché, ni pendant les 20 premières secondes.
 * - Mouvement réduit ou forêt « immobile » : plus rare, et elle ne bouge pas.
 * - Navigateur piloté (tests) : aucune apparition spontanée ; l'événement
 *   `a2:susuwatari` en fait venir une.
 * Monté une fois dans la feuille du Budget (position: relative).
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useMediaQuery, useShell } from '../../../app/ShellContext';
import { playCue } from '../../../app/sound';
import { isTextEntry } from '../../../app/useKeyboardOpen';
import { budgetTheme } from '../../../themes/manifest';
import { cx, fr } from '../../../ui';
import { SCROLL_GAP_MS, WARMUP_MS, nextDelayMs, pickPerch, readCaught, writeCaught, type Box } from './strays';
import './strays.css';

const WALK_MS = 4600;
const CAUGHT_MS = 1700;
export const SPAWN_EVENT = 'a2:susuwatari';

const SPRITES = [
  { src: budgetTheme.susuwatari.carryPink, gift: budgetTheme.gold.konpeito.pink },
  { src: budgetTheme.susuwatari.carryYellow, gift: budgetTheme.gold.konpeito.yellow },
  { src: budgetTheme.susuwatari.carryGreen, gift: budgetTheme.gold.konpeito.green },
  { src: budgetTheme.susuwatari.jumpWhite, gift: budgetTheme.gold.konpeito.white },
];

const BLOCKS = '.card, .ledger, .sheet-section';
const CONTROLS = 'button, input, textarea, select, a[href], label, [role="checkbox"], [role="button"], [tabindex]:not([tabindex="-1"])';

interface Stray {
  id: number;
  x: number;
  y: number;
  dx: number;
  sprite: number;
  caught: boolean;
  align: 'start' | 'center' | 'end';
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/** Une feuille, le pavé ou le clavier sont ouverts : pas de Noiraude. */
function busy(): boolean {
  return (
    document.visibilityState !== 'visible' ||
    document.querySelector('dialog[open]') !== null ||
    document.querySelector('.app--keyboard') !== null ||
    isTextEntry(document.activeElement)
  );
}

function automated(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

export function SusuwatariGame() {
  const { prefs } = useShell();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const calm = reduced || prefs.forestMotion === 'still';
  const layerRef = useRef<HTMLDivElement>(null);
  const [stray, setStray] = useState<Stray | null>(null);
  const [caught, setCaught] = useState(readCaught);
  const seq = useRef(0);

  // Rythme des apparitions.
  useEffect(() => {
    const robot = automated();
    const mountedAt = performance.now();
    let lastAt = mountedAt;
    let timer: number | undefined;
    let scrollTimer: number | undefined;

    const spawn = () => {
      const layer = layerRef.current;
      const sheet = layer?.parentElement;
      if (!layer || !sheet || busy()) return;
      const header = document.querySelector('.app-header');
      const dock = document.querySelector('.app-dock');
      const view: Box = {
        left: 0,
        right: window.innerWidth,
        top: (header?.getBoundingClientRect().bottom ?? 0) + 8,
        bottom: (dock?.getBoundingClientRect().top ?? window.innerHeight) - 8,
      };
      const blocks = [...sheet.querySelectorAll(BLOCKS)].map(boxOf).filter((b) => b.right - b.left > 120);
      const controls = [...document.querySelectorAll(CONTROLS)].filter((el) => !layer.contains(el)).map(boxOf);
      const perch = pickPerch(blocks, controls, view, Math.random, calm ? 0 : 56);
      if (perch === null) return;
      const origin = layer.getBoundingClientRect();
      seq.current += 1;
      lastAt = performance.now();
      setStray({
        id: seq.current,
        x: perch.x - origin.left,
        y: perch.y - origin.top,
        dx: perch.dx,
        sprite: Math.floor(Math.random() * SPRITES.length),
        caught: false,
        align: 'center',
      });
    };

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (robot) return;
      timer = window.setTimeout(() => {
        spawn();
        schedule(nextDelayMs(calm, Math.random));
      }, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule(nextDelayMs(calm, Math.random));
      else {
        window.clearTimeout(timer);
        setStray((s) => (s && !s.caught ? null : s));
      }
    };

    // Parfois, quand on s'arrête de faire défiler.
    const onScroll = () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        const now = performance.now();
        if (robot || now - mountedAt < WARMUP_MS || now - lastAt < SCROLL_GAP_MS) return;
        if (Math.random() < (calm ? 0.08 : 0.2)) schedule(600 + Math.random() * 1200);
      }, 450);
    };

    schedule(Math.max(WARMUP_MS, nextDelayMs(calm, Math.random)));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(SPAWN_EVENT, spawn);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(scrollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener(SPAWN_EVENT, spawn);
    };
  }, [calm]);

  // Pendant la visite : une feuille, le clavier ou un onglet caché la font partir.
  useEffect(() => {
    if (stray === null) return;
    const id = stray.id;
    const end = () => setStray((s) => (s?.id === id ? null : s));
    const done = window.setTimeout(end, stray.caught ? CAUGHT_MS : WALK_MS + 600);
    const watch = stray.caught ? undefined : window.setInterval(() => busy() && end(), 400);
    return () => {
      window.clearTimeout(done);
      window.clearInterval(watch);
    };
  }, [stray]);

  const onCatch = (event: MouseEvent<HTMLButtonElement>) => {
    if (stray === null || stray.caught) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const align = rect.left < 90 ? 'start' : rect.right > window.innerWidth - 90 ? 'end' : 'center';
    const next = caught + 1;
    setCaught(next);
    writeCaught(next);
    setStray({ ...stray, caught: true, align });
    playCue('konpeito');
  };

  const sprite = stray ? SPRITES[stray.sprite] : undefined;
  return (
    <>
      <div ref={layerRef} className="susu-strays">
        {stray && sprite && (
          <button
            key={stray.id}
            type="button"
            tabIndex={-1}
            className={cx('susu-stray', calm && 'is-calm', stray.caught && 'is-caught', stray.dx < 0 && 'is-left')}
            style={{ left: stray.x, top: stray.y, ['--dx' as string]: `${stray.dx}px`, animationDuration: `${WALK_MS}ms` }}
            aria-label="Attraper la Noiraude"
            onClick={onCatch}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && !stray.caught) setStray(null);
            }}
          >
            <span className="susu-stray__body">
              <img className="susu-stray__img" src={sprite.src} alt="" draggable={false} />
            </span>
            {stray.caught && (
              <>
                <img className="susu-stray__gift" src={sprite.gift} alt="" draggable={false} />
                <span className={cx('susu-stray__tally', `is-${stray.align}`)}>{fr(`Noiraudes attrapées : ${caught}`)}</span>
              </>
            )}
          </button>
        )}
      </div>
      {caught > 0 && (
        <p className="susu-count" data-testid="susu-count">
          <img src={budgetTheme.susuwatari.sleeping} alt="" draggable={false} width={22} height={17} />
          {fr(`Noiraudes attrapées : ${caught}`)}
        </p>
      )}
    </>
  );
}
