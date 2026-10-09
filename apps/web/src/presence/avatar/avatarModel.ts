/**
 * L'avatar de l'autre (V5.2), petit automate pur et déterministe (graine).
 *
 * Le serveur ne dit qu'une chose : l'autre est sur le même onglet, ou non.
 * Tout le reste vit ici, sur ce téléphone, sans rien transmettre : son
 * compagnon ENTRE par un bord (Jiji trottine, Calcifer flotte), va et vient
 * sur le haut de la barre du bas, s'assoit, regarde ton doigt ou ton
 * compagnon, baille, s'endort s'il ne se passe rien, et SORT par le bord le
 * plus proche quand l'autre s'en va.
 *
 * Position `x` : fraction de la largeur de la scène (0 à 1, hors écran
 * au-delà). Calme (« Immobile », mouvement réduit) : aucun déplacement, il
 * apparaît assis et disparaît d'un coup ; seules les poses changent.
 */

export type AvatarWho = 'a' | 'b';
export type AvatarPhase = 'enter' | 'walk' | 'sit' | 'look' | 'yawn' | 'sleep' | 'exit' | 'gone';
/** Réactions courtes : toucher (saut + ♡), caresse, coucou reçu. */
export type AvatarReact = 'hop' | 'purr' | 'wave';
export type AvatarMood = 'idle' | 'happy' | 'proud' | 'sleepy' | 'curious';

export interface AvatarState {
  who: AvatarWho;
  phase: AvatarPhase;
  x: number;
  target: number;
  /** 1 : tourné vers la droite ; -1 : vers la gauche. */
  facing: 1 | -1;
  /** Fin de la pose en cours (sit, look, yawn). */
  until: number;
  /** Dernière interaction (le sommeil vient après SLEEP_AFTER_MS sans rien). */
  lastActive: number;
  seed: number;
  react: AvatarReact | null;
  reactUntil: number;
  /** Compteur de réactions (clé d'animation). */
  reactN: number;
}

/** Hors écran, de chaque côté. */
export const OFF_LEFT = -0.15;
export const OFF_RIGHT = 1.15;
/** Zone où il se promène. */
export const ROAM = [0.1, 0.9] as const;
/** Vitesses (largeur de scène par seconde). */
export const SPEED: Record<AvatarWho, { enter: number; walk: number }> = {
  a: { enter: 0.42, walk: 0.13 },
  b: { enter: 0.26, walk: 0.09 },
};
export const SLEEP_AFTER_MS = 75_000;
export const REACT_MS: Record<AvatarReact, number> = { hop: 900, purr: 1_400, wave: 1_400 };
const YAWN_MS = 1_800;
const LOOK_MS = 2_600;

/** Générateur mulberry32 : [valeur dans [0, 1[, graine suivante]. */
export function rand(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

function between(seed: number, lo: number, hi: number): [number, number] {
  const [r, next] = rand(seed);
  return [lo + r * (hi - lo), next];
}

const toward = (from: number, to: number): 1 | -1 => (to >= from ? 1 : -1);

/** L'autre arrive sur l'onglet : son compagnon entre (ou apparaît assis, calme). */
export function arrive(who: AvatarWho, now: number, seed: number, calm: boolean): AvatarState {
  const [side, s1] = rand(seed);
  const [target, s2] = between(s1, 0.25, 0.75);
  const x = calm ? target : side < 0.5 ? OFF_LEFT : OFF_RIGHT;
  const base: AvatarState = {
    who,
    phase: calm ? 'sit' : 'enter',
    x,
    target,
    facing: calm ? 1 : toward(x, target),
    until: now + 6_000,
    lastActive: now,
    seed: s2,
    react: null,
    reactUntil: 0,
    reactN: 0,
  };
  return base;
}

/** L'autre s'en va : sortie par le bord le plus proche (calme : disparaît). */
export function leave(s: AvatarState, calm: boolean): AvatarState {
  if (s.phase === 'gone' || s.phase === 'exit') return s;
  if (calm) return { ...s, phase: 'gone', react: null };
  const target = s.x < 0.5 ? OFF_LEFT : OFF_RIGHT;
  return { ...s, phase: 'exit', target, facing: toward(s.x, target), react: null };
}

/** L'autre revient pendant la sortie : il fait demi-tour. */
export function comeBack(s: AvatarState, now: number): AvatarState {
  if (s.phase !== 'exit') return s;
  const [target, seed] = between(s.seed, 0.25, 0.75);
  return { ...s, phase: 'walk', target, facing: toward(s.x, target), seed, lastActive: now };
}

/** Il se déplace (la boucle tourne à chaque image). */
export function isMoving(s: AvatarState): boolean {
  return (s.phase === 'enter' || s.phase === 'walk' || s.phase === 'exit') && s.react === null;
}

/** Choisit la suite après une pose. */
function next(s: AvatarState, now: number, calm: boolean): AvatarState {
  if (now - s.lastActive >= SLEEP_AFTER_MS) {
    return s.phase === 'yawn' ? { ...s, phase: 'sleep' } : { ...s, phase: 'yawn', until: now + YAWN_MS };
  }
  const [r, s1] = rand(s.seed);
  if (r < 0.42 && !calm) {
    const [target, s2] = between(s1, ROAM[0], ROAM[1]);
    return { ...s, phase: 'walk', target, facing: toward(s.x, target), seed: s2 };
  }
  if (r < 0.7) {
    const [d, s2] = between(s1, 3_000, 7_000);
    return { ...s, phase: 'sit', until: now + d, seed: s2 };
  }
  if (r < 0.92) {
    // Regarde ton compagnon (en haut à gauche, dans l'en-tête).
    return { ...s, phase: 'look', facing: -1, until: now + LOOK_MS, seed: s1 };
  }
  return { ...s, phase: 'yawn', until: now + YAWN_MS, seed: s1 };
}

/** Avance l'automate de `dt` ms jusqu'à `now`. */
export function step(s: AvatarState, now: number, dt: number, calm: boolean): AvatarState {
  let cur = s;
  if (cur.react !== null && now >= cur.reactUntil) cur = { ...cur, react: null };
  if (cur.react !== null || cur.phase === 'gone' || cur.phase === 'sleep') return cur;
  if (cur.phase === 'enter' || cur.phase === 'walk' || cur.phase === 'exit') {
    if (calm && cur.phase !== 'exit') return { ...cur, x: cur.target, phase: 'sit', until: now + 4_000 };
    if (calm) return { ...cur, phase: 'gone' };
    const speed = cur.phase === 'walk' ? SPEED[cur.who].walk : SPEED[cur.who].enter;
    const d = cur.target - cur.x;
    const move = (speed * Math.max(0, dt)) / 1000;
    if (Math.abs(d) > move) return { ...cur, x: cur.x + Math.sign(d) * move };
    const there = { ...cur, x: cur.target };
    if (cur.phase === 'exit') return { ...there, phase: 'gone' };
    const [pause, seed] = between(cur.seed, 2_500, 6_000);
    return { ...there, phase: 'sit', until: now + pause, seed };
  }
  return now >= cur.until ? next(cur, now, calm) : cur;
}

/** Une interaction le réveille et le fait réagir (rien pendant qu'il s'en va). */
export function interact(s: AvatarState, kind: AvatarReact, now: number): AvatarState {
  if (s.phase === 'exit' || s.phase === 'gone') return s;
  const awake = s.phase === 'sleep' || s.phase === 'yawn' ? { ...s, phase: 'sit' as const, until: now + 4_000 } : s;
  return { ...awake, react: kind, reactUntil: now + REACT_MS[kind], reactN: s.reactN + 1, lastActive: now };
}

/** Ton doigt touche l'écran ailleurs : il tourne la tête vers lui (s'il est posé). */
export function lookAt(s: AvatarState, fingerX: number, now: number): AvatarState {
  if (s.react !== null || (s.phase !== 'sit' && s.phase !== 'look')) return s;
  return { ...s, phase: 'look', facing: toward(s.x, fingerX), until: now + LOOK_MS };
}

/** Pose peinte du moment. */
export function avatarMood(s: AvatarState): AvatarMood {
  switch (s.react) {
    case 'hop':
    case 'wave':
      return 'happy';
    case 'purr':
      return s.who === 'b' ? 'proud' : 'happy';
    default:
  }
  if (s.phase === 'sleep' || s.phase === 'yawn') return 'sleepy';
  if (s.phase === 'look') return 'curious';
  return 'idle';
}

/** Façon de bouger (classes CSS) : trotte, flotte, respire, dort. */
export function avatarMotion(s: AvatarState): 'trot' | 'float' | 'rest' | 'sleep' {
  if (s.phase === 'sleep') return 'sleep';
  if (isMoving(s)) return s.who === 'a' ? 'trot' : 'float';
  return s.who === 'b' ? 'float' : 'rest';
}
