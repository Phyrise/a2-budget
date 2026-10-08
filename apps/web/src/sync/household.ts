/**
 * Le foyer unique `households/a2home` et la fiche de chaque membre
 * (`memberState/{rôle}`), tels que les écrit le premier passage d'un membre
 * connecté (docs/SYNC_DESIGN.md §2, §5.1). Module pur : les écritures
 * Firestore elles-mêmes sont dans `firebase/sdk/household.ts`.
 *
 * `syncedAt` (heure du serveur) et `updatedBy` (UID) sont ajoutés par le SDK,
 * comme pour toute écriture (règles : `stamped()`).
 */
import type { MemberRole } from './allowlist';

/** Version du modèle de données synchronisé (resynchronisation complète si elle change). */
export const HOUSEHOLD_SCHEMA = 1;
/** Plus petite version d'app autorisée à écrire (§10 : ancien build en cache). */
export const MIN_APP = 1;
/** Noms affichés des deux rôles (ceux des réglages par défaut de l'app). */
export const HOUSEHOLD_NAMES: Readonly<Record<MemberRole, string>> = Object.freeze({ a: 'AL', b: 'AC' });

export interface HouseholdDoc {
  names: Record<MemberRole, string>;
  schema: number;
  minApp: number;
  createdAt: string;
  createdByRole: MemberRole;
}

export interface MemberDoc {
  uid: string;
  joinedAt: string;
}

/** Le document du foyer, écrit une seule fois par le premier membre connecté. */
export function newHouseholdDoc(role: MemberRole, now: Date): HouseholdDoc {
  return {
    names: { ...HOUSEHOLD_NAMES },
    schema: HOUSEHOLD_SCHEMA,
    minApp: MIN_APP,
    createdAt: now.toISOString(),
    createdByRole: role,
  };
}

/**
 * Fiche du membre à écrire, ou null si elle est déjà à jour. L'UID change
 * si le compte Google a été recréé : la date d'arrivée est gardée.
 */
export function memberDocUpdate(existing: Partial<MemberDoc> | null, uid: string, now: Date): MemberDoc | null {
  if (existing !== null && existing.uid === uid && typeof existing.joinedAt === 'string') return null;
  return { uid, joinedAt: typeof existing?.joinedAt === 'string' ? existing.joinedAt : now.toISOString() };
}
