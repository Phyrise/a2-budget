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
const STORAGE_KEY = 'a2-budget:state:v1';

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
