/**
 * Pont de synchronisation (V5), sans dépendance Firebase : docs/SYNC_DESIGN.md.
 *
 * Le mode local (invité) n'exécute rien d'ici : le mode d'aujourd'hui reste
 * strictement inchangé. Le transport Firestore (`firebase/sdk/transport.ts`)
 * implémente `SyncTransport` dans le chunk chargé à la demande ; le store
 * n'en voit que `SyncLink`.
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
export { householdContent, migrationBatches, migrationDocs, migrationOps, parseMigrationMark } from './migration';
export type { MigrationMark } from './migration';
export { BATCH_LIMIT, CREATION_FIELD, planWrites } from './writePlan';
export { LocalView } from './localView';
export { SyncCore } from './syncCore';
export { SyncLink } from './syncLink';
export type { LinkTarget } from './syncLink';
export type { DocChange, SyncTransport } from './transport';
export { MemoryServer, MemoryTransport } from './memoryTransport';
export { SyncEngine } from './engine';
export type { SyncEngineOptions, SyncOrigin } from './engine';
export {
  SYNC_STORAGE_KEY,
  advanceCursor,
  listenFrom,
  needsFullResync,
  parseSyncCache,
  readSyncCache,
  serializeSyncCache,
  writeSyncCache,
} from './syncCache';
export type { SyncCache } from './syncCache';
