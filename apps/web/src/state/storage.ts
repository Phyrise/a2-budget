import type { AppState } from '@a2/core';

/**
 * Résultat d'une lecture de stockage.
 *
 * - `absent` : aucune clé (premier lancement).
 * - `ok` : contenu lisible et parsable (la validation du contenu est faite
 *   par le store via migrateState).
 * - `error` : contenu illisible (JSON corrompu) ou accès au stockage refusé.
 *   `raw` préserve le contenu brut quand il est disponible : il ne doit
 *   jamais être perdu ni écrasé sans action explicite.
 */
export type LoadResult =
  | { status: 'absent' }
  | { status: 'ok'; state: unknown }
  | { status: 'error'; raw: string | null; reason: 'parse' | 'access' };

/**
 * Contrat de stockage minimal, asynchrone.
 *
 * V1 ne fournit que LocalStorageAdapter. Une future ApiStorageAdapter (V2)
 * implémentera la même interface. Cette abstraction ne résolve pas à elle
 * seule la synchronisation multi-appareils ni la résolution de conflits.
 */
export interface StorageAdapter {
  load(): Promise<LoadResult>;
  save(state: AppState): Promise<void>;
  /** Supprime uniquement la clé de cette application (jamais localStorage.clear()). */
  clear(): Promise<void>;
}

/**
 * Clé dédiée et préfixée. D'autres projets sous phyrise.github.io partagent
 * la même origine : le préfixe évite les collisions, il ne constitue pas une
 * isolation de sécurité.
 */
export const STORAGE_KEY = 'a2-budget:state:v1';

/**
 * Copie brute des données d'avant V3.1 (salaire + compléments). Écrite une
 * seule fois, avant la première réécriture au nouveau format, et jamais
 * effacée automatiquement : un build antérieur (retour en arrière du
 * déploiement, onglet resté ouvert) ignore les compléments et pourrait les
 * perdre. Restauration manuelle : copier cette valeur dans STORAGE_KEY.
 */
export const BACKUP_PRE_V31_KEY = 'a2-budget:backup-pre-v31';

/** Vrai si des mois du budget n'ont pas encore de compléments (ancien format). */
export function isPreV31(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const root = parsed as { budget?: { months?: unknown }; months?: unknown };
  const months = root.budget?.months ?? root.months;
  if (!Array.isArray(months)) return false;
  return months.some((m: unknown) => {
    if (typeof m !== 'object' || m === null) return false;
    const r = m as Record<string, unknown>;
    return typeof r.bonusACents !== 'number' || typeof r.bonusBCents !== 'number';
  });
}

/** Écrit la copie de sécurité si elle n'existe pas encore. Silencieux en cas d'échec (quota). */
function backupOnce(raw: string): void {
  try {
    if (window.localStorage.getItem(BACKUP_PRE_V31_KEY) === null) {
      window.localStorage.setItem(BACKUP_PRE_V31_KEY, raw);
    }
  } catch {
    // Pas de copie possible : le chargement continue normalement.
  }
}

/**
 * Adaptateur basé sur localStorage.
 *
 * - N'appelle JAMAIS localStorage.clear() : seule sa propre clé est écrite
 *   (ou supprimée).
 * - Distingue l'absence de clé, le contenu lisible et l'échec (JSON corrompu
 *   ou accès refusé) ; le contenu brut est préservé dans `raw`.
 * - Les écritures sont sérialisées sur une seule chaîne de promesses.
 * - save() rejette en cas d'échec (quota, stockage désactivé) : le store
 *   doit alors indiquer que les modifications ne sont pas sauvegardées.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private chain: Promise<void> = Promise.resolve();

  load(): Promise<LoadResult> {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return Promise.resolve({ status: 'error', raw: null, reason: 'access' });
    }
    if (raw === null) {
      return Promise.resolve({ status: 'absent' });
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isPreV31(parsed)) backupOnce(raw);
      return Promise.resolve({ status: 'ok', state: parsed });
    } catch {
      return Promise.resolve({ status: 'error', raw, reason: 'parse' });
    }
  }

  save(state: AppState): Promise<void> {
    const attempt = this.chain.then(() => this.doSave(state));
    // La chaîne reste vivante même si cette écriture échoue : les
    // sauvegardes suivantes doivent quand même être tentées.
    this.chain = attempt.catch(() => undefined);
    return attempt;
  }

  clear(): Promise<void> {
    const attempt = this.chain.then(() => this.doClear());
    this.chain = attempt.catch(() => undefined);
    return attempt;
  }

  private doSave(state: AppState): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Échec de la sauvegarde locale'));
      }
    });
  }

  private doClear(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Échec de la suppression locale'));
      }
    });
  }
}
