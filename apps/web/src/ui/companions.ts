/**
 * Registre des compagnons (V5.6) : SEULE source de ce qui distingue Jiji,
 * Calcifer, Teto et Hin dans l'interface. Chacun choisit le sien dans les
 * Réglages (`settings.personX.companion`, synchronisé) ; `companionsOf` de
 * @a2/core résout le choix (défaut du rôle, jamais deux fois le même).
 *
 * - Sprites : `manifest.companions[id][mood]` (world/manifest.ts, 5 poses).
 * - Repli dessiné (companionArt.tsx) : Jiji et Calcifer seulement ; Teto et
 *   Hin retombent sur leur idle, sinon sur le dessin du défaut du rôle.
 * - Couleurs de personne (--who-a / --who-b) : toujours liées au rôle.
 * - Classes : `.companion--<id>` (réactions propres au compagnon) à côté de
 *   `.companion--a|b` (rôle : place, couleur).
 *
 * Lecture : `useCompanionId(who)` / `useCompanionIds()` dans React (tolérant
 * hors du store : défauts) ; `companionProfile(id)` partout ailleurs (les
 * appelants hors React reçoivent l'id en paramètre).
 *
 * À COMPLÉTER (agents suivants) :
 * - SONS de Teto et Hin : `sounds` ci-dessous (nouveaux SoundCue dans
 *   app/sound/cues.ts + synthèse dans app/sound/companionVoices.ts). Sans son
 *   déclaré, rien ne joue (companionPoke.ts, caresse de PartnerAvatar.tsx).
 * - DÉMARCHES (faites) : `scurry` (Teto : bonds, arrêts nets) et `waddle`
 *   (Hin : lent, se couche souvent) dans presence/avatar/avatarModel.ts,
 *   animations `is-scurry` / `is-halt` / `is-waddle` dans avatar.css.
 * - RÉPLIQUES de Teto et Hin : features/maison/companionLines.ts (`linesFor`) ;
 *   en attendant, celles du compagnon par défaut du rôle.
 * - ANIMATIONS au toucher de Teto et Hin : ui/companionPoke.css
 *   (`.companion--teto.is-poke`, `.companion--hin.is-upset`…) ; en attendant,
 *   seule la pose change (pokeMoods).
 */
import {
  COMPANION_IDS,
  companionsOf,
  type CompanionId,
  type CompanionRole,
} from '@a2/core';
import type { SoundCue } from '../app/sound/cues';
import { useOptionalApp } from '../state/store';
import type { CompanionMood } from '../world/types';

export { COMPANION_IDS, type CompanionId, type CompanionRole };

/** Façon de se déplacer (avatar de l'autre). */
export type Gait = 'trot' | 'float' | 'scurry' | 'waddle';

/** Réaction au toucher (companionPoke.ts). */
export type CompanionReaction = 'poke' | 'upset';

export interface CompanionProfile {
  id: CompanionId;
  /** Prénom affiché (« Jiji »). */
  name: string;
  /** Nom accessible du compagnon touchable. */
  touchLabel: string;
  /** Pose peinte pendant la réaction au toucher (aucune pose « fâché » sur les planches). */
  pokeMoods: Record<CompanionReaction, CompanionMood>;
  /** Pose pendant une caresse (avatar de l'autre). */
  caressMood: CompanionMood;
  /** Sons (petits sons permis) ; absent = silence. */
  sounds?: { poke?: SoundCue; upset?: SoundCue; caress?: SoundCue };
  gait: Gait;
}

export const COMPANIONS: Record<CompanionId, CompanionProfile> = {
  // Chat noir de Kiki : penche la tête, boude (se détourne) ; ronronne à la caresse.
  jiji: {
    id: 'jiji',
    name: 'Jiji',
    touchLabel: 'Caresser Jiji',
    pokeMoods: { poke: 'curious', upset: 'idle' },
    caressMood: 'happy',
    sounds: { caress: 'purr' },
    gait: 'trot',
  },
  // Flamme du Château ambulant : crépite, s'énerve (grogne, fumée).
  calcifer: {
    id: 'calcifer',
    name: 'Calcifer',
    touchLabel: 'Taquiner Calcifer',
    pokeMoods: { poke: 'happy', upset: 'proud' },
    caressMood: 'proud',
    sounds: { poke: 'crackle', upset: 'grumble', caress: 'crackle' },
    gait: 'float',
  },
  // Renard-écureuil de Nausicaä : curieux au toucher, se renfrogne si on insiste.
  teto: {
    id: 'teto',
    name: 'Teto',
    touchLabel: 'Caresser Teto',
    pokeMoods: { poke: 'curious', upset: 'idle' },
    caressMood: 'happy',
    gait: 'scurry',
  },
  // Vieux chien du Château ambulant : content au toucher, s'effondre, blasé.
  hin: {
    id: 'hin',
    name: 'Hin',
    touchLabel: 'Caresser Hin',
    pokeMoods: { poke: 'happy', upset: 'sleepy' },
    caressMood: 'happy',
    gait: 'waddle',
  },
};

export function companionProfile(id: CompanionId): CompanionProfile {
  return COMPANIONS[id];
}

/** Compagnons choisis des deux personnes (défauts hors du store). */
export function useCompanionIds(): Record<CompanionRole, CompanionId> {
  const settings = useOptionalApp()?.appState?.budget.settings ?? null;
  const a = settings?.personA.companion;
  const b = settings?.personB.companion;
  // Mémo léger : mêmes choix → même objet (dépendances d'effets stables).
  return stableIds(a, b);
}

/** Compagnon choisi par `who` (AL = 'a', AC = 'b'). */
export function useCompanionId(who: CompanionRole): CompanionId {
  return useCompanionIds()[who];
}

export function useCompanionProfile(who: CompanionRole): CompanionProfile {
  return COMPANIONS[useCompanionId(who)];
}

const resolved = new Map<string, Record<CompanionRole, CompanionId>>();
function stableIds(a: CompanionId | undefined, b: CompanionId | undefined): Record<CompanionRole, CompanionId> {
  const key = `${a ?? ''}|${b ?? ''}`;
  let ids = resolved.get(key);
  if (ids === undefined) {
    ids = companionsOf({ personA: { companion: a }, personB: { companion: b } });
    resolved.set(key, ids);
  }
  return ids;
}
