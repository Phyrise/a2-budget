/**
 * La scène des Noiraudes d'un écran : UNE toile sur toute la fenêtre (portail
 * dans <body> : aucune transformation d'ancêtre ne capture le
 * `position: fixed`), sous le bandeau et la navigation, au-dessus de la
 * feuille ; et la couche des cibles du doigt (seules les Noiraudes perchées
 * reçoivent des touchers). Montée une fois par écran (Budget, Courses,
 * Calendrier).
 * - Calme (prefers-reduced-motion, forêt « immobile ») : mouvements doux,
 *   apparitions plus rares, ni procession ni portage.
 * - Nuit (maison en pause, bouton lune) : on ne voit plus que leurs yeux.
 * - Attributs `data-*` de la scène : combien de Noiraudes par rôle (tests).
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery, useShell } from '../../app/ShellContext';
import { useWorld } from '../../world/WorldContext';
import { SootDirector, type SootScreen } from './director';
import { startRhythm } from './rhythm';
import { attachSoot, detachSoot } from './stage';
import './soot.css';

/** La toile porte son chef d'orchestre (tests, captures). */
export type SootCanvas = HTMLCanvasElement & { noiraudes?: SootDirector };

const ROLES = ['stray', 'porter', 'herd', 'parade', 'runner'] as const;

export function SootStage({ screen }: { screen: SootScreen }) {
  const { prefs } = useShell();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const calm = reduced || prefs.forestMotion === 'still';
  const night = useWorld().state?.paused === true;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<HTMLDivElement>(null);
  const directorRef = useRef<SootDirector | null>(null);
  const mood = useRef({ calm, night });
  mood.current = { calm, night };

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current as SootCanvas | null;
    const hits = hitsRef.current;
    if (!root || !canvas || !hits) return;
    let d: SootDirector;
    try {
      d = new SootDirector(canvas, hits, screen);
    } catch {
      return; // Pas de toile 2D : pas de Noiraudes, rien d'autre ne change.
    }
    d.setCalm(mood.current.calm);
    d.setNight(mood.current.night);
    d.onCast = () => {
      for (const role of ROLES) {
        const n = d.count(role);
        if (n > 0) root.dataset[role] = String(n);
        else delete root.dataset[role];
      }
      const run = d.actors.find((a) => a.role === 'runner' && !a.leaving);
      if (run?.load) root.dataset.runnerTone = run.load.tone;
      else delete root.dataset.runnerTone;
    };
    attachSoot(d);
    const stop = startRhythm(d);
    directorRef.current = d;
    canvas.noiraudes = d;
    return () => {
      stop();
      detachSoot(d);
      d.destroy();
      directorRef.current = null;
      delete canvas.noiraudes;
    };
  }, [screen]);

  useEffect(() => directorRef.current?.setCalm(calm), [calm]);
  useEffect(() => directorRef.current?.setNight(night), [night]);

  return createPortal(
    <div ref={rootRef} className="soot-stage" data-screen={screen}>
      <canvas ref={canvasRef} className="soot-stage__canvas" aria-hidden="true" />
      <div ref={hitsRef} className="soot-stage__hits" />
    </div>,
    document.body,
  );
}
