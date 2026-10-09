/**
 * Contrat du canal « en direct » (V5.1) entre l'app et le chunk Firebase
 * (`sync/firebase/sdk/live.ts`) : présence de l'autre, coucous, bocal de
 * kompeitō partagé. Types seulement (aucun Firebase). Mode connecté
 * seulement : en invité, rien de tout cela n'est ouvert.
 */
import type { CompanionId } from '@a2/core';
import type { ModuleId } from '../app/prefs';
import type { MemberRole } from '../sync/allowlist';
import type { PresenceInfo } from './presenceModel';

/** Compteurs du bocal d'UN rôle (`play/{rôle}`), jamais en baisse. */
export interface PlayCounts {
  /** Kompeitō donnés au bocal (soins, virements, Noiraudes attrapées, dev). */
  given: number;
  /** Kompeitō lâchés aux Noiraudes. */
  spent: number;
  /** Noiraudes attrapées (dorées comprises). */
  caught: number;
  golden: number;
}

export type PlayDocs = Partial<Record<MemberRole, PlayCounts & { migrated: boolean }>>;

export interface LiveChannel {
  readonly role: MemberRole;
  /** Onglet affiché et visibilité (battement : à l'appelant). */
  publish(tab: ModuleId, visible: boolean): void;
  /** Un coucou à l'autre (heure du serveur dans `pokeAt`). */
  poke(): void;
  /**
   * Fiche de l'autre (null : pas encore de présence connue) ; V5.7 :
   * `companion` brut de sa fiche (son compagnon choisi, à valider).
   */
  watchPartner(listener: (presence: PresenceInfo | null, companion: unknown) => void): () => void;
  /**
   * V5.7 — compagnon de MA fiche, lu du serveur ; `fromServer` faux si lu
   * du cache (hors ligne) ou fiche incomplète. null : fiche illisible.
   */
  readMyCompanion(): Promise<{ companion: unknown; fromServer: boolean } | null>;
  /** V5.7 — mon compagnon, dans MA fiche (fusion ; hors ligne : part au retour du réseau). */
  setCompanion(id: CompanionId): void;
  /** Les deux documents du bocal ; `confirmed` : vus du serveur (pas seulement du cache). */
  watchPlay(listener: (docs: PlayDocs, confirmed: boolean) => void): () => void;
  /** Incréments de MES compteurs (gestes faits ici seulement). */
  addPlay(delta: Partial<PlayCounts>): void;
  /** Migration unique de l'état local vers `play/{mon rôle}` (exige le réseau). */
  migratePlay(local: PlayCounts): Promise<void>;
  dispose(): void;
}
