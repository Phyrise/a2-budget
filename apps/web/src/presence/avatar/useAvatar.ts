/**
 * Fait vivre l'avatar de l'autre : l'automate (avatarModel) tourne ici, en
 * local. Pendant un déplacement : une image par rafraîchissement
 * (requestAnimationFrame), la position écrite directement dans le style
 * (aucun rendu React par image). Au repos : un simple minuteur jusqu'à la
 * prochaine pose ; endormi : plus rien jusqu'au prochain geste. React ne
 * rend que quand la pose change.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  arrive,
  avatarMood,
  avatarMotion,
  comeBack,
  interact,
  isMoving,
  leave,
  lookAt,
  step,
  type AvatarMood,
  type AvatarPhase,
  type AvatarReact,
  type AvatarState,
  type AvatarWho,
} from './avatarModel';

export interface AvatarView {
  who: AvatarWho;
  phase: AvatarPhase;
  mood: AvatarMood;
  motion: ReturnType<typeof avatarMotion>;
  facing: 1 | -1;
  react: AvatarReact | null;
  reactN: number;
}

const viewOf = (s: AvatarState): AvatarView => ({
  who: s.who,
  phase: s.phase,
  mood: avatarMood(s),
  motion: avatarMotion(s),
  facing: s.facing,
  react: s.react,
  reactN: s.reactN,
});

const sameView = (a: AvatarView | null, b: AvatarView): boolean =>
  a !== null &&
  a.who === b.who &&
  a.phase === b.phase &&
  a.mood === b.mood &&
  a.motion === b.motion &&
  a.facing === b.facing &&
  a.react === b.react &&
  a.reactN === b.reactN;

export interface AvatarControls {
  view: AvatarView | null;
  /** Réaction locale (toucher, caresse, coucou reçu). */
  react: (kind: AvatarReact) => void;
  /** Ton doigt touche l'écran à `clientX`. */
  finger: (clientX: number) => void;
}

export function useAvatar(
  who: AvatarWho | null,
  calm: boolean,
  stageRef: RefObject<HTMLElement | null>,
  bodyRef: RefObject<HTMLElement | null>,
): AvatarControls {
  const state = useRef<AvatarState | null>(null);
  const [view, setView] = useState<AvatarView | null>(null);
  const timer = useRef<{ raf: number; to: number }>({ raf: 0, to: 0 });
  const last = useRef(0);
  const calmRef = useRef(calm);
  calmRef.current = calm;

  const place = useCallback(() => {
    const s = state.current;
    const el = bodyRef.current;
    const width = stageRef.current?.clientWidth ?? 0;
    if (s !== null && el !== null) el.style.transform = `translate3d(${(s.x * width).toFixed(1)}px, 0, 0)`;
  }, [bodyRef, stageRef]);

  const publish = useCallback(() => {
    const s = state.current;
    if (s === null || s.phase === 'gone') {
      state.current = null;
      setView(null);
      return;
    }
    const v = viewOf(s);
    setView((prev) => (sameView(prev, v) ? prev : v));
    place();
  }, [place]);

  const schedule = useCallback(() => {
    const t = timer.current;
    cancelAnimationFrame(t.raf);
    window.clearTimeout(t.to);
    const s = state.current;
    if (s === null) return;
    const tick = () => {
      const now = performance.now();
      const cur = state.current;
      if (cur === null) return;
      state.current = step(cur, now, Math.min(now - last.current, 100), calmRef.current);
      last.current = now;
      publish();
      schedule();
    };
    if (isMoving(s)) {
      t.raf = requestAnimationFrame(tick);
      return;
    }
    if (s.phase === 'sleep' && s.react === null) return;
    const now = performance.now();
    const wake = Math.min(s.react !== null ? s.reactUntil : Infinity, s.until > now ? s.until : now + 50);
    t.to = window.setTimeout(() => {
      last.current = performance.now();
      tick();
    }, Math.max(30, Math.min(wake - now, 4_000)));
  }, [publish]);

  // L'autre arrive, s'en va, revient.
  useEffect(() => {
    const now = performance.now();
    const cur = state.current;
    if (who !== null) {
      if (cur === null || cur.who !== who) state.current = arrive(who, now, (Math.random() * 2 ** 31) | 0, calm);
      else state.current = comeBack(cur, now);
    } else if (cur !== null) {
      state.current = leave(cur, calm);
    }
    last.current = now;
    publish();
    schedule();
    // `calm` lu au moment du changement seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, publish, schedule]);

  // Arrêt propre.
  useEffect(
    () => () => {
      cancelAnimationFrame(timer.current.raf);
      window.clearTimeout(timer.current.to);
    },
    [],
  );

  // Premier rendu de l'avatar (ou nouvelle pose) : position appliquée avant l'affichage.
  useLayoutEffect(() => place(), [view, place]);

  // La scène change de largeur (rotation) : on replace.
  useEffect(() => {
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [place]);

  const react = useCallback(
    (kind: AvatarReact) => {
      const cur = state.current;
      if (cur === null) return;
      state.current = interact(cur, kind, performance.now());
      last.current = performance.now();
      publish();
      schedule();
    },
    [publish, schedule],
  );

  const finger = useCallback(
    (clientX: number) => {
      const cur = state.current;
      const stage = stageRef.current;
      if (cur === null || stage === null) return;
      const box = stage.getBoundingClientRect();
      if (box.width <= 0) return;
      const next = lookAt(cur, (clientX - box.left) / box.width, performance.now());
      if (next === cur) return;
      state.current = next;
      publish();
      schedule();
    },
    [publish, schedule, stageRef],
  );

  return { view, react, finger };
}
