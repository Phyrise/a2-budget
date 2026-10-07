/**
 * Transport abstrait du pont (docs/SYNC_DESIGN.md §3–4) : écrire des lots,
 * recevoir des documents. Le transport Firestore (étape suivante, import
 * dynamique) et le faux transport en mémoire des tests l'implémentent ; le
 * reste du pont n'en sait pas plus.
 */

import type { DocData, DocKey, WriteOp } from './docs';

/** Un document de la vue du téléphone a changé (null : il n'existe plus). */
export interface DocChange {
  key: DocKey;
  data: DocData | null;
}

export interface SyncTransport {
  /**
   * Envoie un lot (appliqué d'un bloc). Hors ligne, il est gardé en file
   * (dans l'ordre) et part à la reconnexion ; la vue locale le montre tout de
   * suite (comme le cache de Firestore).
   */
  write(ops: readonly WriteOp[]): void;
  /**
   * Reçoit la vue du téléphone : dernier état connu du serveur + écritures
   * en attente. D'abord tout ce qui est connu, puis les changements.
   * Renvoie de quoi se désabonner.
   */
  subscribe(listener: (changes: readonly DocChange[]) => void): () => void;
}
