/**
 * Présence de l'autre (V5.1), logique pure : où il est, s'il est « là »,
 * les coucous, et ce que tout cela coûte en lectures / écritures Firestore.
 *
 * Chaque téléphone connecté publie dans `memberState/{son rôle}` :
 * `{ tab, visible, at, pokeAt? }` (heures du serveur) — à chaque changement
 * d'onglet, à la mise en arrière-plan (visible: false) et un battement
 * toutes les 60 s tant que l'app est visible (rien quand elle est cachée).
 * L'autre est « là » s'il est visible et que son dernier signe a moins de
 * 2,5 min (un battement manqué est toléré).
 */
import { isModuleId, type ModuleId } from '../app/prefs';
import type { MemberRole } from '../sync/allowlist';

export const HEARTBEAT_MS = 60_000;
export const HERE_WINDOW_MS = 150_000;
/** Anti-rafale des coucous envoyés. */
export const POKE_COOLDOWN_MS = 5_000;
/** Un coucou plus vieux que ça n'est plus joué (retour d'arrière-plan, rechargement). */
export const POKE_FRESH_MS = 20_000;
/** Horloges des téléphones un peu en avance sur le serveur : tolérance. */
const SKEW_MS = 60_000;

export interface PresenceInfo {
  /** Onglet affiché (null : inconnu). */
  tab: ModuleId | null;
  visible: boolean;
  /** Dernier signe (heure du serveur, ms). */
  at: number | null;
  /** Dernier coucou envoyé (heure du serveur, ms). */
  pokeAt: number | null;
}

export function partnerOf(role: MemberRole): MemberRole {
  return role === 'a' ? 'b' : 'a';
}

const millis = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Lit la fiche de l'autre (champs de présence) ; null si elle n'en a pas. */
export function parsePresence(data: unknown): PresenceInfo | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const at = millis(d.at);
  const pokeAt = millis(d.pokeAt);
  if (at === null && pokeAt === null) return null;
  return { tab: isModuleId(d.tab) ? d.tab : null, visible: d.visible === true, at, pokeAt };
}

/** L'autre a l'app ouverte (visible, signe récent). */
export function isHere(p: PresenceInfo | null, now: number): boolean {
  if (p === null || !p.visible || p.at === null) return false;
  const age = now - p.at;
  return age < HERE_WINDOW_MS && age > -SKEW_MS;
}

/** Onglet où il se trouve, s'il est là. */
export function hereTab(p: PresenceInfo | null, now: number): ModuleId | null {
  return isHere(p, now) ? (p?.tab ?? null) : null;
}

/** Un coucou peut partir (anti-rafale 5 s). */
export function canPoke(lastSent: number | null, now: number): boolean {
  return lastSent === null || now - lastSent >= POKE_COOLDOWN_MS;
}

/** Un coucou nouveau et récent est arrivé (à jouer une seule fois). */
export function freshPoke(lastSeen: number, pokeAt: number | null, now: number): boolean {
  return pokeAt !== null && pokeAt > lastSeen && now - pokeAt < POKE_FRESH_MS && now - pokeAt > -SKEW_MS;
}

/** Usage d'une journée, pour une personne. */
export interface DayUsage {
  /** Minutes avec l'app visible. */
  visibleMinutes: number;
  /** Ouvertures de l'app (retour au premier plan). */
  openings: number;
  /** Changements d'onglet. */
  tabChanges: number;
  /** Coucous envoyés. */
  pokes: number;
  /** Gestes du bocal (soins, virements, Noiraudes, kompeitō lâchés). */
  playGestures: number;
}

export interface DayCost {
  writes: number;
  reads: number;
}

/**
 * Coût d'une journée à deux (majorant) : écritures de chacun ; lectures =
 * chaque écriture de l'autre reçue par l'écouteur (au plus) + relecture à
 * chaque ouverture (fiche de l'autre, deux documents du bocal).
 */
export function dayCost(a: DayUsage, b: DayUsage): DayCost {
  const writes = (u: DayUsage) =>
    Math.ceil(u.visibleMinutes / (HEARTBEAT_MS / 60_000)) + u.openings * 2 + u.tabChanges + u.pokes + u.playGestures;
  const reads = (me: DayUsage, other: DayUsage) => writes(other) + me.playGestures + me.openings * 3;
  return { writes: writes(a) + writes(b), reads: reads(a, b) + reads(b, a) };
}
