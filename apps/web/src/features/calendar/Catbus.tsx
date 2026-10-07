/**
 * Le Chatbus traverse l'écran quand on ajoute un événement : il file de
 * droite à gauche au-dessus de la grille, puis disparaît. Calque décoratif
 * (aria-hidden, sans clic), rendu dans <body> pour ne jamais élargir la
 * page : le conteneur est fixe, rogné, de la largeur de l'écran.
 *
 * V4.1, fluidité : traversée à vitesse constante en transform composé
 * (catbus.css), rebond sinusoïdal et inclinaison déphasée, images décodées
 * AVANT le départ (sinon le bus apparaît à mi-course, par à-coups).
 * Poses : si le thème fournit `catbusRun` (frames d'un cycle de galop),
 * elles défilent à 12 i/s, empilées (une seule opaque à la fois : aucun
 * clignotement), avec un rebond par cycle ; sinon « course » et « saut »
 * alternent, calées sur le rebond.
 * Mouvement réduit : pas de traversée, une seule image en fondu.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { calendarTheme } from '../../themes/manifest';
import './catbus.css';

/** Largeur du bus (px CSS), aussi dans catbus.css (--catbus-w). */
const BUS_W = 190;
const FRAMES_W = 200;
/** Vitesse de course (px/ms) et bornes de la traversée. */
const SPEED = 0.36;
const MIN_MS = 1400;
const MAX_MS = 2400;
/** Cadence du galop (frames du thème). */
const FRAME_MS = 1000 / 12;
/** Mouvement réduit : durée du fondu (apparition, pause, disparition). */
const STILL_MS = 1600;
/** Attente maximale du décodage des images avant de partir quand même. */
const DECODE_WAIT_MS = 300;

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Frames du cycle de course (contrat facultatif du thème), sinon null. */
function runFrames(): string[] | null {
  const frames = calendarTheme.catbusRun?.filter(Boolean) ?? [];
  return frames.length >= 2 ? frames : null;
}

function poseSources(still: boolean): string[] {
  const frames = runFrames();
  if (frames) return still ? frames.slice(0, 1) : frames;
  const { running, leap } = calendarTheme.catbus;
  return (still ? [running] : [running, leap]).filter(Boolean);
}

/* Images gardées en mémoire et décodées une seule fois par session. */
const decoded = new Map<string, Promise<void>>();
function warm(src: string): Promise<void> {
  let pending = decoded.get(src);
  if (!pending) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    pending = img.decode().catch(() => undefined);
    decoded.set(src, pending);
  }
  return pending;
}

function ready(sources: string[]): Promise<void> {
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, DECODE_WAIT_MS));
  return Promise.race([Promise.all(sources.map(warm)).then(() => undefined), timeout]);
}

interface Run {
  id: number;
  ms: number;
  span: number;
  still: boolean;
}

/** `run` change (compteur) à chaque ajout ; 0 = rien. */
export function CatbusRun({ run }: { run: number }) {
  const [active, setActive] = useState<Run | null>(null);

  // Décodage dès l'arrivée sur le Calendrier, pour un premier départ net.
  useEffect(() => {
    void Promise.all(poseSources(reducedMotion()).map(warm));
  }, []);

  useEffect(() => {
    if (run === 0 || !calendarTheme.catbus.running) return;
    const still = reducedMotion();
    let cancelled = false;
    let timer = 0;
    void ready(poseSources(still)).then(() => {
      if (cancelled) return;
      const span = window.innerWidth + (runFrames() ? FRAMES_W : BUS_W) + 24;
      const ms = still ? STILL_MS : Math.round(Math.min(MAX_MS, Math.max(MIN_MS, span / SPEED)));
      setActive({ id: run, ms, span, still });
      timer = window.setTimeout(() => setActive((current) => (current?.id === run ? null : current)), ms + 80);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [run]);

  if (!active) return null;
  const layer = active.still ? <CatbusStill key={active.id} ms={active.ms} /> : <CatbusCrossing key={active.id} ms={active.ms} span={active.span} />;
  return createPortal(layer, document.body);
}

/** Mouvement réduit : le bus apparaît en fondu au milieu, sans bouger. */
function CatbusStill({ ms }: { ms: number }) {
  const frames = runFrames();
  const src = frames?.[0] ?? calendarTheme.catbus.running;
  const style = { '--catbus-ms': `${ms}ms` } as CSSProperties;
  return (
    <div className={`cal-catbus cal-catbus--still${frames ? ' cal-catbus--frames' : ''}`} style={style} aria-hidden="true">
      <img className="cal-catbus__bus is-on" src={src} alt="" decoding="async" draggable={false} />
    </div>
  );
}

function CatbusCrossing({ ms, span }: { ms: number; span: number }) {
  const [frames] = useState(runFrames);
  const tiltRef = useRef<HTMLDivElement>(null);

  // Frames : une seule image opaque, choisie à 12 i/s sur l'horloge de la
  // page (sans rendu React) ; l'ancienne et la nouvelle basculent dans la
  // même image d'écran.
  useEffect(() => {
    if (!frames) return;
    const imgs = tiltRef.current ? [...tiltRef.current.querySelectorAll('img')] : [];
    if (imgs.length < 2) return;
    let raf = 0;
    let shown = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const index = Math.floor((now - t0) / FRAME_MS) % imgs.length;
      if (index !== shown) {
        imgs[index]?.classList.add('is-on');
        imgs[shown]?.classList.remove('is-on');
        shown = index;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames]);

  const style = {
    '--catbus-ms': `${ms}ms`,
    '--catbus-span': `${span}px`,
    // Un rebond par cycle de galop.
    ...(frames ? { '--catbus-stride': `${Math.round(frames.length * FRAME_MS)}ms` } : {}),
  } as CSSProperties;
  const { running, leap } = calendarTheme.catbus;
  return (
    <div className={`cal-catbus ${frames ? 'cal-catbus--frames' : leap ? 'cal-catbus--poses' : ''}`} style={style} aria-hidden="true">
      <div className="cal-catbus__track">
        <div className="cal-catbus__body">
          <div className="cal-catbus__tilt" ref={tiltRef}>
            {frames ? (
              frames.map((src, i) => (
                <img key={src} className={`cal-catbus__bus${i === 0 ? ' is-on' : ''}`} src={src} alt="" decoding="sync" draggable={false} />
              ))
            ) : (
              <>
                <img className="cal-catbus__bus cal-catbus__bus--run" src={running} alt="" decoding="async" draggable={false} />
                {leap && <img className="cal-catbus__bus cal-catbus__bus--leap" src={leap} alt="" decoding="async" draggable={false} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
