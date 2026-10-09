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
 *
 * V5.6 : le compagnon est celui que l'autre a choisi ; sa démarche (`gait`)
 * et sa pose de caresse viennent du registre (ui/companions.ts), passées à
 * `arrive` (défaut : Jiji trotte pour `a`, Calcifer flotte pour `b`).
 * - scurry (Teto) : petits bonds vifs, arrêts nets (`halted`), un regard de
 *   côté une fois sur deux, puis il repart ;
 * - waddle (Hin) : très lent, de courts trajets, et il se couche souvent
 *   (`lie` : pose endormie quelques secondes, puis il reprend).
 */
import type { Gait } from '../../ui/companions';

export type AvatarWho = 'a' | 'b';
export type AvatarPhase = 'enter' | 'walk' | 'sit' | 'look' | 'yawn' | 'lie' | 'sleep' | 'exit' | 'gone';
/** Réactions courtes : toucher (saut + ♡), caresse, coucou reçu. */
export type AvatarReact = 'hop' | 'purr' | 'wave';
export type AvatarMood = 'idle' | 'happy' | 'proud' | 'sleepy' | 'curious';

/** Ce qui distingue le compagnon dans l'automate (registre ui/companions.ts). */
export interface AvatarBody {
  gait: Gait;
  /** Pose pendant une caresse. */
  caressMood: AvatarMood;
}

/** Compagnons par défaut des rôles (Jiji, Calcifer). */
export const DEFAULT_BODY: Record<AvatarWho, AvatarBody> = {
  a: { gait: 'trot', caressMood: 'happy' },
  b: { gait: 'float', caressMood: 'proud' },
};

export interface AvatarState {
  who: AvatarWho;
  gait: Gait;
  caressMood: AvatarMood;
  phase: AvatarPhase;
  x: number;
  target: number;
  /** 1 : tourné vers la droite ; -1 : vers la gauche. */
  facing: 1 | -1;
  /** Fin de la pose en cours (sit, look, yawn, lie). */
  until: number;
  /** Scurry : fin du bond (ou de l'arrêt) en cours ; 0 = à lancer. */
  burst: number;
  /** Scurry : arrêt net au milieu d'un trajet. */
  halted: boolean;
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
/**
 * Vitesses par démarche (largeur de scène par seconde), avec leurs
 * animations (avatar.css). Scurry : vitesse PENDANT un bond (les arrêts
 * ramènent sa moyenne près du trot) ; waddle : le plus lent de tous.
 */
export const GAIT_SPEED: Record<Gait, { enter: number; walk: number }> = {
  trot: { enter: 0.42, walk: 0.13 },
  float: { enter: 0.26, walk: 0.09 },
  scurry: { enter: 0.62, walk: 0.3 },
  waddle: { enter: 0.17, walk: 0.045 },
};
/** Scurry : durée d'un bond, d'un arrêt (ms). */
export const SCURRY_DASH_MS = [260, 720] as const;
export const SCURRY_HALT_MS = [380, 1_100] as const;
/** Waddle : longueur max d'un trajet (fraction de scène), durée couché (ms). */
export const WADDLE_REACH = 0.22;
export const LIE_MS = [5_000, 11_000] as const;
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
export function arrive(who: AvatarWho, now: number, seed: number, calm: boolean, body: AvatarBody = DEFAULT_BODY[who]): AvatarState {
  const [side, s1] = rand(seed);
  const [target, s2] = between(s1, 0.25, 0.75);
  const x = calm ? target : side < 0.5 ? OFF_LEFT : OFF_RIGHT;
  const base: AvatarState = {
    who,
    gait: body.gait,
    caressMood: body.caressMood,
    phase: calm ? 'sit' : 'enter',
    x,
    target,
    facing: calm ? 1 : toward(x, target),
    until: now + 6_000,
    burst: 0,
    halted: false,
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
  return { ...s, phase: 'exit', target, facing: toward(s.x, target), react: null, burst: 0, halted: false };
}

/** L'autre revient pendant la sortie : il fait demi-tour. */
export function comeBack(s: AvatarState, now: number): AvatarState {
  if (s.phase !== 'exit') return s;
  const [target, seed] = between(s.seed, 0.25, 0.75);
  return { ...s, phase: 'walk', target, facing: toward(s.x, target), seed, lastActive: now, burst: 0, halted: false };
}

const onTheWay = (s: AvatarState): boolean => s.phase === 'enter' || s.phase === 'walk' || s.phase === 'exit';

/** Il se déplace (la boucle tourne à chaque image ; pas pendant un arrêt net). */
export function isMoving(s: AvatarState): boolean {
  return onTheWay(s) && s.react === null && !s.halted;
}

/** Prochain réveil de la boucle hors déplacement (minuteur de useAvatar). */
export function wakeAt(s: AvatarState, now: number): number {
  const pose = s.halted ? s.burst : s.until > now ? s.until : now + 50;
  return Math.min(s.react !== null ? s.reactUntil : Infinity, pose);
}

/** Prochaine destination : n'importe où (Hin : jamais loin d'où il est). */
function roamTarget(s: AvatarState, seed: number): [number, number] {
  if (s.gait !== 'waddle') return between(seed, ROAM[0], ROAM[1]);
  const lo = Math.max(ROAM[0], s.x - WADDLE_REACH);
  const hi = Math.min(ROAM[1], s.x + WADDLE_REACH);
  return between(seed, lo, hi);
}

/** Choisit la suite après une pose. */
function next(s: AvatarState, now: number, calm: boolean): AvatarState {
  if (now - s.lastActive >= SLEEP_AFTER_MS) {
    return s.phase === 'yawn' ? { ...s, phase: 'sleep' } : { ...s, phase: 'yawn', until: now + YAWN_MS };
  }
  const [r, s1] = rand(s.seed);
  // Hin se couche souvent et marche peu ; Teto ne tient pas en place.
  const lazy = s.gait === 'waddle';
  const walk = lazy ? 0.24 : s.gait === 'scurry' ? 0.55 : 0.42;
  if (r < walk && !calm) {
    const [target, s2] = roamTarget(s, s1);
    return { ...s, phase: 'walk', target, facing: toward(s.x, target), seed: s2, burst: 0, halted: false };
  }
  if (lazy && r < 0.58 && s.phase !== 'lie') {
    const [d, s2] = between(s1, LIE_MS[0], LIE_MS[1]);
    return { ...s, phase: 'lie', until: now + d, seed: s2 };
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
  if (onTheWay(cur)) {
    if (calm && cur.phase !== 'exit') return { ...cur, x: cur.target, phase: 'sit', until: now + 4_000, burst: 0, halted: false };
    if (calm) return { ...cur, phase: 'gone' };
    // Teto : bonds et arrêts nets (jamais en sortant : il file).
    if (cur.gait === 'scurry' && cur.phase !== 'exit') {
      if (cur.halted) {
        if (now < cur.burst) return cur;
        const [dash, seed] = between(cur.seed, SCURRY_DASH_MS[0], SCURRY_DASH_MS[1]);
        return { ...cur, halted: false, burst: now + dash, facing: toward(cur.x, cur.target), seed };
      }
      if (cur.burst === 0) {
        const [dash, seed] = between(cur.seed, SCURRY_DASH_MS[0], SCURRY_DASH_MS[1]);
        cur = { ...cur, burst: now + dash, seed };
      } else if (now >= cur.burst && Math.abs(cur.target - cur.x) > 0.06) {
        // Arrêt net ; une fois sur deux, un regard de côté (derrière lui).
        const [halt, s1] = between(cur.seed, SCURRY_HALT_MS[0], SCURRY_HALT_MS[1]);
        const [glance, seed] = rand(s1);
        const facing = glance < 0.5 ? (-cur.facing as 1 | -1) : cur.facing;
        return { ...cur, halted: true, burst: now + halt, facing, seed };
      }
    }
    const speed = cur.phase === 'walk' ? GAIT_SPEED[cur.gait].walk : GAIT_SPEED[cur.gait].enter;
    const d = cur.target - cur.x;
    const move = (speed * Math.max(0, dt)) / 1000;
    if (Math.abs(d) > move) return { ...cur, x: cur.x + Math.sign(d) * move };
    const there = { ...cur, x: cur.target, burst: 0, halted: false };
    if (cur.phase === 'exit') return { ...there, phase: 'gone' };
    // Hin, arrivé : souvent, il se couche là.
    if (cur.gait === 'waddle') {
      const [r, s1] = rand(cur.seed);
      if (r < 0.5) {
        const [d2, seed] = between(s1, LIE_MS[0], LIE_MS[1]);
        return { ...there, phase: 'lie', until: now + d2, seed };
      }
    }
    const [pause, seed] = between(cur.seed, 2_500, 6_000);
    return { ...there, phase: 'sit', until: now + pause, seed };
  }
  return now >= cur.until ? next(cur, now, calm) : cur;
}

/** Une interaction le réveille et le fait réagir (rien pendant qu'il s'en va). */
export function interact(s: AvatarState, kind: AvatarReact, now: number): AvatarState {
  if (s.phase === 'exit' || s.phase === 'gone') return s;
  const awake = s.phase === 'sleep' || s.phase === 'yawn' || s.phase === 'lie' ? { ...s, phase: 'sit' as const, until: now + 4_000 } : s;
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
      return s.caressMood;
    default:
  }
  if (s.phase === 'sleep' || s.phase === 'yawn' || s.phase === 'lie') return 'sleepy';
  if (s.phase === 'look' || (s.halted && onTheWay(s))) return 'curious';
  return 'idle';
}

export type AvatarMotion = 'trot' | 'float' | 'scurry' | 'waddle' | 'halt' | 'rest' | 'sleep';

/**
 * Façon de bouger (classes CSS `is-<motion>`) : trotte, flotte, détale
 * (Teto), se dandine (Hin), s'arrête net, respire, dort (couché aussi).
 */
export function avatarMotion(s: AvatarState): AvatarMotion {
  if (s.phase === 'sleep' || s.phase === 'lie') return 'sleep';
  if (s.halted && onTheWay(s) && s.react === null) return 'halt';
  if (isMoving(s)) return s.gait;
  return s.gait === 'float' ? 'float' : 'rest';
}
