/**
 * Pont de synchronisation (V5), sans dépendance Firebase : docs/SYNC_DESIGN.md.
 *
 * Rien ici n'est importé par l'app en mode local (invité) : le mode
 * d'aujourd'hui reste strictement inchangé. Le transport Firestore (étape
 * suivante) implémentera `SyncTransport` dans un chunk chargé à la demande.
 */

export type {
  CollectionName,
  DocData,
  DocKey,
  DocStore,
  FieldPath,
  FieldWrite,
  WriteOp,
} from './docs';
export { COLLECTIONS, DELETE_FIELD, FACT_COLLECTIONS, docKey, isDeleteField, splitDocKey } from './docs';
export { applyBatch, applyOptimistic } from './apply';
export type { ApplyOptions, ApplyResult } from './apply';
export { entityDocs } from './entities';
export { diffFields, diffToOps } from './diff';
export type { DiffContext } from './diff';
export { projectState } from './project';
export type { ProjectOptions, ProjectResult } from './project';
export { migrationDocs, migrationOps } from './migration';
export type { DocChange, SyncTransport } from './transport';
export { MemoryServer, MemoryTransport } from './memoryTransport';
export { SyncEngine } from './engine';
export type { SyncEngineOptions, SyncOrigin } from './engine';
export { SYNC_STORAGE_KEY, parseSyncCache, serializeSyncCache } from './syncCache';
export type { SyncCache } from './syncCache';
