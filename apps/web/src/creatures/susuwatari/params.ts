/**
 * Apparence des Noiraudes dessinées par le code : TOUTES les constantes
 * visuelles du rendu (corps, fourrure, yeux, membres, ombre, frisottis,
 * lueur des fonds sombres, couleurs) dans un seul objet, `SootSpriteParams`.
 * Le rendu (fur.ts, sprites.ts, draw.ts, limbs.ts) ne lit que cet objet ;
 * le Labo le règle au doigt et le copie en TypeScript prêt à coller.
 *
 * Unités :
 * - R = rayon nominal d'une Noiraude, la moitié de son diamètre affiché
 *   (`size`) : yeux, membres, ombre sont en « × R » ;
 * - Rd = rayon du disque noir (`body.radius` × R) : la fourrure est en
 *   « × Rd » (elle part du contour du disque).
 *
 * Modèle par défaut (d'après le film, réglé avec Arthur) : un corps de suie
 * un peu moins noir que les poils et au contour FLOU (duveteux) ; des poils
 * RECTILIGNES d'épaisseur constante, longs et variés, bien noirs, dont une
 * partie est dessinée PAR-DESSUS le corps (on les voit y rentrer) ; de grands
 * yeux ronds clairs qui LOUCHENT un peu vers le nez ; de longues jambes
 * arquées en « ( ) », en miroir ; pieds et mains = trois bouts très fins.
 * Les anciens modèles et les réglages collés sans ces champs restent lisibles
 * (champs manquants = valeurs par défaut ; voir presets.ts).
 */

export interface SootSpriteParams {
  body: {
    /** Rayon du disque (× R). */
    radius: number;
    /** Ovalité : hauteur / largeur du disque (1 : cercle). */
    ratio: number;
    /** Irrégularité du contour (amplitude des bosses, × Rd). */
    wobble: number;
    /** Noirceur du disque (0 : gris de suie, 1 : noir presque pur). */
    darkness: number;
    /** Reflet doux en haut à gauche (volume), 0–1. */
    sheen: number;
    /** Flou du contour (× Rd) : 0 net, ~0,15 duveteux comme dans le film. */
    blur: number;
  };
  hair: {
    /** Nombre de poils (fixe : même silhouette à toutes les tailles). */
    count: number;
    /** Racine la plus extérieure (× Rd, sous le bord du disque si < 1). */
    rootOut: number;
    /** Épaisseur du halo : bande des racines, entre rootOut − depth et rootOut (× Rd). */
    depth: number;
    /** Longueur des poils (× Rd). */
    lenMin: number;
    lenMax: number;
    /** Écart d'angle autour de la normale au contour (± rad). */
    jitter: number;
    /** Largeur à la base (× Rd). */
    width: number;
    /** Effilement : 1 pointe fine (ancien rendu), 0 trait droit d'épaisseur constante. */
    taper: number;
    /** Bout des poils non effilés : 0 coupé net, 1 arrondi. */
    cap: number;
    /** Part des poils dessinés PAR-DESSUS le corps (0–1) : on les voit y rentrer. */
    over: number;
    /** Jusqu'où ces poils rentrent : racine la plus profonde (× Rd depuis le centre). */
    inner: number;
    /** Noirceur des poils et des membres (même échelle que body.darkness). */
    ink: number;
    opacity: number;
    /** Courbure (flèche signée au hasard, × longueur du poil ; 0 : droits). */
    bend: number;
    /** Épis : les pointes convergent en touffes (0 : aucune touffe). */
    tufts: number;
    /** Dessous tassé : poils plus courts sous le corps (0–1), jamais sous lenMin. */
    under: number;
    /** Duvet : poils fins translucides entre les poils (× count). */
    fuzz: number;
    /** Longueur du duvet (× longueur des poils). */
    fuzzLen: number;
    /** Opacité du duvet (× opacity). */
    fuzzAlpha: number;
    /** Écart de teinte entre poils (0 : tous du noir du disque). */
    tone: number;
  };
  eyes: {
    /** Demi-largeur du blanc (× R). */
    size: number;
    /** Hauteur / largeur du blanc. */
    aspect: number;
    /** Écart du centre de chaque œil à l'axe (× R). */
    gap: number;
    /** Hauteur des yeux au-dessus du centre (× R). */
    lift: number;
    /** Rayon des pupilles (× R). */
    pupil: number;
    /** Fréquence des clignements (× ; 0 : jamais). */
    blink: number;
    /** Ombre de la paupière en bas du blanc (0–1). */
    lid: number;
    /** Déplacement des yeux avec le regard (× R). */
    turn: number;
    /** Strabisme : pupilles tirées vers le nez (0–1 de leur course). */
    cross: number;
  };
  limbs: {
    /** Longueur d'un segment de jambe, cuisse ou tibia (× R). */
    legs: number;
    /** Longueur d'un segment de bras (× R). */
    arms: number;
    /** Épaisseur des jambes (× R) ; les bras font 80 %. */
    width: number;
    /** Demi-longueur d'un pied, ou longueur des orteils si toes > 0 (× R). */
    feet: number;
    /** Rayon d'une main, ou longueur des doigts si toes > 0 (× R). */
    hands: number;
    /** Écart des hanches et des épaules (× Rd). */
    hip: number;
    shoulder: number;
    /** Arc des jambes (× ; 0 : droites, 1 : genou plié de tout le mou). */
    bow: number;
    /** 0 : les deux genoux du même côté (vers l'avant) ; 1 : en miroir, « ( ) » vers l'extérieur. */
    mirror: number;
    /** Écart des pieds au-delà des hanches (× segment de jambe). */
    stance: number;
    /** Doigts et orteils : 0 petits pieds ronds et paumes, 1–5 bouts très fins. */
    toes: number;
    /** Éventail des doigts et orteils (rad). */
    spread: number;
    /** Épaisseur des doigts et orteils (× épaisseur des membres). */
    fine: number;
  };
  shadow: {
    /** Opacité de l'ombre au sol (multipliée par celle du calque). */
    opacity: number;
    /** Largeur (× R) et aplatissement (hauteur / largeur). */
    width: number;
    height: number;
  };
  anim: {
    /** Vitesse du frisottis (×). */
    furSpeed: number;
    /** Ondulation des poils d'une image de frisottis à l'autre (×). */
    wave: number;
    /** Part de chaque cycle où la fourrure reste posée (0–0,9). */
    hold: number;
    /** Rebond : hauteur des sauts et écrasement (×). */
    bounce: number;
  };
  /** Fonds sombres (`rim` du calque) : lueur derrière le corps, pointes et membres éclairés. */
  glow: {
    halo: number;
    /** Flou de la lueur (× R). */
    blur: number;
    tips: number;
    limbs: number;
  };
  palette: {
    /** Blanc de l'œil : reflet, milieu, bord. */
    eye: [string, string, string];
    pupil: string;
    /** Pointes éclairées (fonds sombres). */
    rim: string;
    /** Lueur derrière le corps et les membres (fonds sombres). */
    halo: string;
    /** Lueur des yeux la nuit. */
    night: string;
  };
}

export type ParamGroup = Exclude<keyof SootSpriteParams, 'palette'>;

/** Le modèle par défaut (d'après le film ; voir presets.ts pour les autres). */
export const DEFAULT_SOOT_PARAMS: SootSpriteParams = {
  body: { radius: 0.52, ratio: 0.98, wobble: 0.02, darkness: 0.8, sheen: 0.08, blur: 0.14 },
  hair: {
    count: 46,
    rootOut: 0.85,
    depth: 0.15,
    lenMin: 0.4,
    lenMax: 0.75,
    jitter: 0.06,
    width: 0.032,
    opacity: 1,
    bend: 0,
    tufts: 0,
    under: 0.25,
    fuzz: 1.2,
    fuzzLen: 0.4,
    fuzzAlpha: 0.6,
    tone: 0.03,
    taper: 0,
    cap: 1,
    over: 0.55,
    inner: 0.35,
    ink: 1,
  },
  eyes: { size: 0.175, aspect: 1.1, gap: 0.26, lift: 0.01, pupil: 0.044, blink: 1, lid: 0.05, turn: 0.06, cross: 0.55 },
  limbs: {
    legs: 0.48,
    arms: 0.6,
    width: 0.03,
    feet: 0.1,
    hands: 0.08,
    hip: 0.55,
    shoulder: 0.9,
    bow: 0.5,
    mirror: 1,
    stance: 0.1,
    toes: 3,
    spread: 1.9,
    fine: 0.45,
  },
  shadow: { opacity: 1, width: 2, height: 0.22 },
  anim: { furSpeed: 1, wave: 1, hold: 0.5, bounce: 1 },
  glow: { halo: 0.24, blur: 0.22, tips: 0.15, limbs: 0.24 },
  palette: { eye: ['#f8eed8', '#f2e6cb', '#e2d2b0'], pupil: '#1a120f', rim: '#c9b894', halo: '#ecdebe', night: '#ffeec4' },
};

/** Copie profonde (les paramètres sont de simples nombres et chaînes). */
export function cloneParams(p: SootSpriteParams): SootSpriteParams {
  return JSON.parse(JSON.stringify(p)) as SootSpriteParams;
}

/** Clé des sprites : seuls corps, fourrure, yeux pré-rendus, lueur et couleurs les changent. */
export function spriteKey(p: SootSpriteParams): string {
  return JSON.stringify([p.body, p.hair, p.eyes.size, p.eyes.aspect, p.eyes.lid, p.anim.wave, p.glow.halo, p.glow.blur, p.glow.tips, p.palette]);
}

/** Proportions dont la physique d'une Noiraude a besoin (× diamètre S). */
export interface SootRig {
  /** Hauteur du centre au repos, pattes rentrées. */
  rest: number;
  /** Hauteur gagnée pattes sorties. */
  lift: number;
  /** Longueur d'un pas. */
  stride: number;
  bounce: number;
  furSpeed: number;
  blink: number;
}

export function rigOf(p: SootSpriteParams): SootRig {
  return {
    rest: p.body.radius * Math.min(1.4, p.body.ratio) * 0.5 * 0.97,
    lift: p.limbs.legs * 0.5,
    stride: p.limbs.legs * 0.55,
    bounce: p.anim.bounce,
    furSpeed: p.anim.furSpeed,
    blink: p.eyes.blink,
  };
}

export const DEFAULT_RIG: SootRig = rigOf(DEFAULT_SOOT_PARAMS);

/** Noir de suie selon la noirceur (0 : gris chaud, 1 : presque noir), éclairci de `lift`. */
export function sootColor(darkness: number, lift = 0): string {
  const d = Math.max(0, Math.min(1, darkness - lift));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * d);
  return `rgb(${mix(70, 6)}, ${mix(60, 5)}, ${mix(54, 4)})`;
}

/** Couleur « #rrggbb » → « rgba(r, g, b, a) ». */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${alpha})`;
}

/** Bornes de sûreté (un objet collé ne doit pas geler le téléphone). */
const SAFE: Partial<Record<string, [number, number]>> = {
  'hair.count': [0, 2000],
  'hair.fuzz': [0, 4],
  'body.radius': [0.2, 1.3],
  'body.ratio': [0.4, 1.8],
  'hair.lenMin': [0, 1.5],
  'hair.lenMax': [0, 1.5],
  'limbs.toes': [0, 6],
};

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/**
 * Objet quelconque (collé, relu du stockage) → paramètres complets : chaque
 * valeur reconnue et valide remplace celle de `base`, le reste est gardé.
 */
export function normalizeParams(input: unknown, base: SootSpriteParams = DEFAULT_SOOT_PARAMS): SootSpriteParams {
  const out = cloneParams(base);
  if (typeof input !== 'object' || input === null) return out;
  const src = input as Record<string, unknown>;
  for (const group of Object.keys(out) as (keyof SootSpriteParams)[]) {
    const from = src[group];
    if (typeof from !== 'object' || from === null) continue;
    const target = out[group] as unknown as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      const v = (from as Record<string, unknown>)[key];
      const current = target[key];
      if (typeof current === 'number' && typeof v === 'number' && Number.isFinite(v)) {
        const [lo, hi] = SAFE[`${group}.${key}`] ?? [-20, 20];
        target[key] = Math.max(lo, Math.min(hi, v));
      } else if (typeof current === 'string' && isColor(v)) {
        target[key] = v;
      } else if (Array.isArray(current) && Array.isArray(v) && v.length === current.length && v.every(isColor)) {
        target[key] = [...v];
      }
    }
  }
  out.hair.count = Math.round(out.hair.count);
  out.limbs.toes = Math.round(out.limbs.toes);
  if (out.hair.lenMin > out.hair.lenMax) [out.hair.lenMin, out.hair.lenMax] = [out.hair.lenMax, out.hair.lenMin];
  return out;
}

/** Vrai si l'objet porte au moins un groupe de paramètres connu. */
export function looksLikeParams(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false;
  return Object.keys(DEFAULT_SOOT_PARAMS).some((g) => typeof (input as Record<string, unknown>)[g] === 'object');
}
