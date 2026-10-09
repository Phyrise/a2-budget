/**
 * Registre des compagnons (V5.6) : SEULE source de ce qui distingue Jiji,
 * Calcifer, Teto et Hin dans l'interface. Chacun choisit le sien dans les
 * Réglages ; connecté (V5.7), le choix vit dans la fiche de son compte
 * (presence/companionChoices.ts), sinon dans les réglages
 * (`settings.personX.companion`) ; `companionsOf` de @a2/core résout le
 * choix (fiche > réglages > défaut du rôle, jamais deux fois le même).
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
 * Spécificités de chacun :
 * - SONS : `sounds` ci-dessous (app/sound/cues.ts, synthèse dans
 *   app/sound/companionVoices.ts ; Hin, V5.7 : son vrai « hin » du film,
 *   app/sound/samples.ts) ; sans son déclaré, rien ne joue.
 * - DÉMARCHES : `scurry` (Teto : bonds, arrêts nets) et `waddle` (Hin : lent,
 *   se couche souvent) dans presence/avatar/avatarModel.ts, animations
 *   `is-scurry` / `is-halt` / `is-waddle` dans avatar.css.
 * - RÉPLIQUES : features/maison/companionLines.ts (`linesFor`) ; rituels :
 *   features/rituals/voices.ts.
 * - Toucher : pose seulement pour Teto et Hin (pokeMoods), son du registre.
 */
import {
  COMPANION_IDS,
  chosenCompanion,
  companionsOf,
  type CompanionId,
  type CompanionRole,
} from '@a2/core';
import { useSyncExternalStore } from 'react';
import { useSync } from '../account/SyncContext';
import type { SoundCue } from '../app/sound/cues';
import { companionChoices, pickOwnCompanion, subscribeCompanionChoices, type CompanionChoices } from '../presence/companionChoices';
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
    sounds: { poke: 'chirp', upset: 'hiss', caress: 'trill' },
    gait: 'scurry',
  },
  // Vieux chien du Château ambulant : content au toucher, s'effondre, blasé.
  hin: {
    id: 'hin',
    name: 'Hin',
    touchLabel: 'Caresser Hin',
    pokeMoods: { poke: 'happy', upset: 'sleepy' },
    caressMood: 'happy',
    sounds: { poke: 'huff', upset: 'sigh', caress: 'snuffle' },
    gait: 'waddle',
  },
};

export function companionProfile(id: CompanionId): CompanionProfile {
  return COMPANIONS[id];
}

const NO_ACCOUNTS: CompanionChoices = {};

/** Compagnons choisis des deux personnes : fiches des comptes (connecté), réglages, défauts. */
export function useCompanionIds(): Record<CompanionRole, CompanionId> {
  const settings = useOptionalApp()?.appState?.budget.settings ?? null;
  const connected = useSync().mode === 'sync';
  const fiches = useSyncExternalStore(subscribeCompanionChoices, companionChoices, () => NO_ACCOUNTS);
  const accounts = connected ? fiches : NO_ACCOUNTS;
  const a = chosenCompanion(accounts.a, settings?.personA.companion);
  const b = chosenCompanion(accounts.b, settings?.personB.companion);
  // Mémo léger : mêmes choix → même objet (dépendances d'effets stables).
  return stableIds(a, b);
}

/**
 * Choisir le compagnon de `who` : réglages (invité ; repli des téléphones
 * d'avant V5.7) et, connecté, la fiche de son compte (source de vérité).
 */
export function useChooseCompanion(): (who: CompanionRole, id: CompanionId) => void {
  const app = useOptionalApp();
  const connected = useSync().mode === 'sync';
  return (who, id) => {
    app?.updatePersonSettings(who === 'a' ? 'A' : 'B', { companion: id });
    if (connected) pickOwnCompanion(who, id);
  };
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
