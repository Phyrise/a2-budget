/**
 * V5.7 — compagnons liés aux COMPTES (mode connecté ; docs/SYNC_DESIGN.md §24).
 *
 * Le choix de chacun vit dans SA fiche `memberState/{rôle}.companion`,
 * écrite par lui seul (fusion) : aucune réécriture des réglages partagés
 * (autre téléphone, ancienne version de l'app, remise à zéro) ne l'efface.
 * Ici, sans Firebase ni React : ce que ce téléphone sait des deux fiches.
 *
 * - Lu : ma fiche une fois à l'ouverture du canal (et au retour sur l'app),
 *   celle de l'autre par l'écoute de présence déjà ouverte (LiveContext).
 * - Mon choix : affiché tout de suite (ici), envoyé par le canal dès qu'il
 *   est ouvert ; en attendant (chargement, hors ligne avant le SDK), il est
 *   gardé, copie locale comprise, et part à l'ouverture. Le SDK garde
 *   ensuite l'écriture hors ligne jusqu'au retour du réseau.
 * - Copie locale `a2-budget:companions:v1` : premier affichage juste après
 *   un rechargement, avant la lecture des fiches. Confort seulement : la
 *   fiche du serveur fait foi.
 * - Invité : rien de tout cela (ui/companions.ts ne lit ce module qu'en
 *   mode connecté) ; le choix reste dans les réglages locaux.
 */
import { isCompanionId, type CompanionId } from '@a2/core';
import type { MemberRole } from '../sync/allowlist';

export const COMPANIONS_KEY = 'a2-budget:companions:v1';

export type CompanionChoices = Readonly<Partial<Record<MemberRole, CompanionId>>>;

interface Saved {
  choices: CompanionChoices;
  /** Mon choix pas encore confié au canal. */
  pending?: { role: MemberRole; companion: CompanionId };
}

function read(): Saved {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(COMPANIONS_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return { choices: {} };
    const r = raw as { choices?: Record<string, unknown>; pending?: { role?: unknown; companion?: unknown } };
    const choices: Partial<Record<MemberRole, CompanionId>> = {};
    for (const role of ['a', 'b'] as const) {
      const id = r.choices?.[role];
      if (isCompanionId(id)) choices[role] = id;
    }
    const p = r.pending;
    const role = p?.role;
    const pending: Saved['pending'] = (role === 'a' || role === 'b') && isCompanionId(p?.companion) ? { role, companion: p.companion } : undefined;
    return pending ? { choices, pending } : { choices };
  } catch {
    return { choices: {} };
  }
}

let saved: Saved = typeof window === 'undefined' ? { choices: {} } : read();
const listeners = new Set<() => void>();
/**
 * Dernier choix confié au canal (ms) : une lecture de ma fiche commencée
 * moins de 30 s après peut ne pas le contenir encore (périmée).
 */
let wroteAt: number | null = null;
export const SETTLE_MS = 30_000;
/** Écriture dans MA fiche (canal ouvert), ou null. */
let writer: { role: MemberRole; write: (id: CompanionId) => void } | null = null;

function commit(next: Saved): void {
  saved = next;
  try {
    window.localStorage.setItem(COMPANIONS_KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé : l'affichage suit quand même (mémoire), la fiche fait foi.
  }
  for (const listener of listeners) listener();
}

/** Choix connus des fiches (même objet tant que rien ne change). */
export function companionChoices(): CompanionChoices {
  return saved.choices;
}

export function subscribeCompanionChoices(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Choix lu d'une fiche (la mienne ou celle de l'autre) ; inconnu ou absent : rien ne change. */
export function receiveCompanion(role: MemberRole, id: unknown): void {
  if (!isCompanionId(id) || saved.choices[role] === id) return;
  // Mon choix en attente d'envoi passe avant une lecture (plus ancienne) de ma fiche.
  if (saved.pending?.role === role) return;
  commit({ ...saved, choices: { ...saved.choices, [role]: id } });
}

/**
 * Choix lu de MA fiche, lecture commencée à `readAt` (ms) : ignoré si un
 * choix fait ici a pu ne pas encore y arriver (en attente, ou envoyé peu
 * avant ou pendant la lecture).
 */
export function receiveOwnCompanion(role: MemberRole, id: unknown, readAt: number): void {
  if (wroteAt !== null && wroteAt > readAt - SETTLE_MS) return;
  receiveCompanion(role, id);
}

/** Je choisis mon compagnon : affiché tout de suite, envoyé dès que possible. */
export function pickOwnCompanion(role: MemberRole, id: CompanionId): void {
  const choices = { ...saved.choices, [role]: id };
  if (writer !== null && writer.role === role) {
    wroteAt = Date.now();
    writer.write(id);
    commit({ choices });
    return;
  }
  commit({ choices, pending: { role, companion: id } });
}

/** Canal ouvert : il écrit dans MA fiche ; un choix en attente part maintenant. Renvoie l'arrêt. */
export function attachCompanionWriter(role: MemberRole, write: (id: CompanionId) => void): () => void {
  const mine = { role, write };
  writer = mine;
  const pending = saved.pending;
  if (pending !== undefined && pending.role === role) {
    wroteAt = Date.now();
    write(pending.companion);
    commit({ choices: saved.choices });
  } else if (pending !== undefined) {
    // Choix laissé par l'autre compte sur ce téléphone (changement de compte) :
    // jamais envoyé d'ici, et il ne doit plus masquer la fiche de son rôle.
    commit({ choices: saved.choices });
  }
  return () => {
    if (writer === mine) writer = null;
  };
}

/** Un choix en attente d'envoi pour ce rôle ? */
export function hasPendingCompanion(role: MemberRole): boolean {
  return saved.pending?.role === role;
}

/** Tests : état vierge. */
export function resetCompanionChoicesForTests(): void {
  saved = read();
  writer = null;
  wroteAt = null;
  listeners.clear();
}
