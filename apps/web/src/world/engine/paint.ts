/**
 * Peintures de saison : quelle image, quelle LUT de nuit, quel « regard »
 * (brume, vent, mousse, fougères) pour la saison affichée. Pur, sans GPU :
 * importé aussi par <LivingForest> (repli <img>) sans tirer le moteur.
 *
 * La base du manifest = été / saison des pluies. Une saison sans variante
 * dans `manifest.seasons` garde la base (et l'ancienne teinte procédurale).
 * Rien n'est chargé ici : seules les URL utiles sont résolues, le moteur
 * charge la seule peinture affichée (et précharge la suivante au repos).
 */
import type { GrowthStage, SceneImage, Season, WorldManifest } from '../types';

/** Durée du fondu de saison (dissolution bruitée), en direct. */
export const SEASON_FADE_SECONDS = 2.6;

/**
 * Intensité des LUT d'humeur (calculées sur la peinture d'été) appliquées
 * aux autres saisons : assez pour que l'humeur se lise, pas au point de
 * verdir les ors d'automne ou de salir la neige. Nuit de saison : pleine.
 */
export const MOOD_LUT_AMOUNT: Record<Season, number> = {
  summer: 1,
  spring: 0.55,
  autumn: 0.45,
  winter: 0.4,
};

/** Saison réellement peinte : la saison demandée si sa variante existe, sinon la base (été). */
export function paintSeason(m: WorldManifest, season: Season): Season {
  return season !== 'summer' && m.seasons?.[season] ? season : 'summer';
}

/** Image d'un stade pour une saison (repli : la base). */
export function stageImage(m: WorldManifest, stage: GrowthStage, season: Season): SceneImage {
  const s = season === 'summer' ? undefined : m.seasons?.[season];
  return s?.stages[stage] ?? m.stages[stage];
}

/** LUT de nuit de la saison peinte (repli : nuit de base). */
export function nightLutUrl(m: WorldManifest, season: Season): string | null {
  const s = season === 'summer' ? undefined : m.seasons?.[season];
  return s?.nightLut ?? m.luts.night;
}

/**
 * URL propres à une saison (peintures, profondeurs distinctes de la base,
 * nuit) — pour un préchargement ou une purge du cache par la coquille.
 * `stages` limite la liste (ex. stade courant et suivant). Vide pour l'été.
 */
export function seasonUrls(m: WorldManifest, season: Season, stages?: readonly GrowthStage[]): string[] {
  const s = season === 'summer' ? undefined : m.seasons?.[season];
  if (!s) return [];
  const base = new Set<string>(Object.values(m.stages).flatMap((st) => [st.color, st.depth ?? '']));
  const list = stages ?? ([1, 2, 3, 4, 5, 6, 7] as GrowthStage[]);
  const urls = list.flatMap((n) => [s.stages[n].color, s.stages[n].depth ?? '']).filter((u) => u && !base.has(u));
  if (s.nightLut) urls.push(s.nightLut);
  return [...new Set(urls)];
}

/**
 * Regard de saison : réglages continus que le moteur interpole pendant le
 * fondu (jamais de saut de brume ni de vent au changement de peinture).
 */
export interface SeasonLook {
  /** Multiplicateur de la couleur de brume de jour. */
  fogTint: [number, number, number];
  /** Vent sur le feuillage (masque G) et balancement des fougères. */
  wind: number;
  fgSway: number;
  /** Mousse lumineuse (la neige la recouvre). */
  moss: number;
  /** Pluie fine (l'hiver : la neige la remplace). */
  rain: number;
  /** Fougères du premier plan (couche de base, verte) : x roux, y givre et neige, z vert tendre. */
  fg: [number, number, number];
  /** Scintillement des gouttes. */
  sparkle: number;
}

const NEUTRAL: SeasonLook = { fogTint: [1, 1, 1], wind: 1, fgSway: 1, moss: 1, rain: 1, fg: [0, 0, 0], sparkle: 1 };

const LOOKS: Record<Season, SeasonLook> = {
  summer: NEUTRAL,
  spring: { fogTint: [1.05, 1.03, 1.02], wind: 1, fgSway: 1, moss: 0.9, rain: 0.8, fg: [0, 0, 0.6], sparkle: 1 },
  autumn: { fogTint: [1.14, 0.98, 0.8], wind: 1.05, fgSway: 1, moss: 0.55, rain: 0.7, fg: [0.85, 0, 0], sparkle: 0.8 },
  // Feuillage enneigé : il bouge à peine ; la neige remplace la pluie.
  winter: { fogTint: [1.06, 1.1, 1.17], wind: 0.35, fgSway: 0.5, moss: 0.25, rain: 0, fg: [0, 0.9, 0], sparkle: 0.45 },
};

/** Regard de la saison peinte (été ou saison sans variante : neutre). */
export function seasonLook(painted: Season): SeasonLook {
  return LOOKS[painted] ?? NEUTRAL;
}

export function cloneLook(l: SeasonLook): SeasonLook {
  return { ...l, fogTint: [l.fogTint[0], l.fogTint[1], l.fogTint[2]], fg: [l.fg[0], l.fg[1], l.fg[2]] };
}

/** Rapproche `cur` de `target` (constante de temps tau, s). k = 1 : immédiat. */
export function approachLook(cur: SeasonLook, target: SeasonLook, dt: number, tau: number, immediate = false) {
  const k = immediate ? 1 : 1 - Math.exp(-dt / Math.max(1e-3, tau));
  for (const key of ['wind', 'fgSway', 'moss', 'rain', 'sparkle'] as const) cur[key] += (target[key] - cur[key]) * k;
  const lerp3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  cur.fogTint = lerp3(cur.fogTint, target.fogTint);
  cur.fg = lerp3(cur.fg, target.fg);
}
