/**
 * Contrat du canal « en direct » (V5.1) entre l'app et le chunk Firebase
 * (`sync/firebase/sdk/live.ts`) : présence de l'autre, coucous, bocal de
 * kompeitō partagé. Types seulement (aucun Firebase). Mode connecté
 * seulement : en invité, rien de tout cela n'est ouvert.
 */
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
  /** Fiche de l'autre (null : pas encore de présence connue). */
  watchPartner(listener: (presence: PresenceInfo | null) => void): () => void;
  /** Les deux documents du bocal ; `confirmed` : vus du serveur (pas seulement du cache). */
  watchPlay(listener: (docs: PlayDocs, confirmed: boolean) => void): () => void;
  /** Incréments de MES compteurs (gestes faits ici seulement). */
  addPlay(delta: Partial<PlayCounts>): void;
  /** Migration unique de l'état local vers `play/{mon rôle}` (exige le réseau). */
  migratePlay(local: PlayCounts): Promise<void>;
  dispose(): void;
}
