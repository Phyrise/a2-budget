import type { PersistedState } from '@a2/core';

/**
 * Contrat de stockage minimal, asynchrone.
 *
 * V1 ne fournit que LocalStorageAdapter. Une future ApiStorageAdapter (V2)
 * implémentera la même interface. Cette abstraction ne résolve pas à elle
 * seule la synchronisation multi-appareils ni la résolution de conflits.
 */
export interface StorageAdapter {
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
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
 * - N'appelle JAMAIS localStorage.clear() : seul sa propre clé est écrite
 *   (ou retirée).
 * - Les écritures sont sérialisées sur une seule chaîne de promesses.
 * - load() résout null si la clé est absente, si le JSON est illisible ou si
 *   le stockage est refusé. La validation du contenu est faite par
 *   validatePersistedState (@a2/core) côté store.
 * - save() rejette en cas d'échec (quota, stockage désactivé) : le store
 *   doit alors indiquer que les modifications ne sont pas sauvegardées.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private chain: Promise<void> = Promise.resolve();

  load(): Promise<PersistedState | null> {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return Promise.resolve(null);
      }
      const parsed: unknown = JSON.parse(raw);
      return Promise.resolve(parsed as PersistedState);
    } catch {
      return Promise.resolve(null);
    }
  }

  save(state: PersistedState): Promise<void> {
    const attempt = this.chain.then(() => this.doSave(state));
    // La chaîne reste vivante même si cette écriture échoue : les
    // sauvegardes suivantes doivent quand même être tentées.
    this.chain = attempt.catch(() => undefined);
    return attempt;
  }

  private doSave(state: PersistedState): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Échec de la sauvegarde locale'));
      }
    });
  }
}
