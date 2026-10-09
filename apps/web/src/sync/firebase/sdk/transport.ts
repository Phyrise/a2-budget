/**
 * Transport Firestore du pont (docs/SYNC_DESIGN.md §4) : implémente
 * `SyncTransport` avec le SDK (cache IndexedDB, file d'écritures hors ligne).
 *
 * - Démarrage : la vue vient du cache du SDK (gratuit), ou de tout relire
 *   sur le serveur quand il le faut (première fois, cache vidé, 25 jours).
 * - Écouteurs « delta », un par collection, jamais sur une collection
 *   entière : `orderBy('syncedAt') + startAfter(curseur − 2 min)`. Avec une
 *   borne (et non un filtre `where`), les écritures en attente (heure du
 *   serveur pas encore connue, rangée en dernier) restent dans le résultat :
 *   la vue montre ses propres gestes même hors ligne. Les curseurs avancent
 *   seulement avec ce que le serveur a confirmé.
 * - Écritures : plan d'envoi (writePlan.ts) → lots Firestore, visibles tout
 *   de suite dans la vue (LocalView) jusqu'à leur issue. Hors ligne, le SDK
 *   les garde (même au rechargement) et les envoie au retour du réseau.
 */
import {
  doc,
  getDocFromCache,
  getDocsFromCache,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS, docKey, type CollectionName, type DocData, type DocKey, type WriteOp } from '../../docs';
import { LocalView } from '../../localView';
import { aboveFloor } from '../../reset';
import { advanceCursor, listenFrom, type SyncCache } from '../../syncCache';
import type { DocChange, SyncTransport } from '../../transport';
import { planWrites } from '../../writePlan';
import { errorCode } from '../types';
import { addToBatch, collectionRef, fromFirestore, syncedAtOf } from './convert';

export interface TransportHooks {
  /** Curseurs avancés (à garder dans la copie locale). */
  onCursors?: (cursors: SyncCache['cursors']) => void;
  /** Toutes les collections viennent d'être confirmées par le serveur. */
  onInSync?: () => void;
  /** Quelque chose a changé pour l'indicateur (en attente, à jour, refus). */
  onActivity?: () => void;
}

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class FirestoreTransport implements SyncTransport {
  private readonly local = new LocalView();
  private stops: Unsubscribe[] = [];
  private readonly inSync = new Set<CollectionName>();
  private queued: DocChange[] = [];
  private flushing = false;
  private inflight = 0;
  /** Écouteur refusé (règles) : la synchronisation ne peut pas suivre. */
  failure: string | null = null;
  /** Heure de démarrage des écouteurs (relancés après une longue absence). */
  listeningSince = 0;
  /** Remise à zéro (reset.ts) : les documents d'avant `resetAt` (ms) ne sont plus montrés. */
  floor = 0;

  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private cursors: SyncCache['cursors'],
    private readonly hooks: TransportHooks = {},
  ) {}

  /** Lots partis, pas encore confirmés. */
  get pending(): number {
    return this.inflight;
  }

  /** Toutes les collections sont à jour avec le serveur. */
  get upToDate(): boolean {
    return this.inSync.size === COLLECTIONS.length;
  }

  get docs(): ReadonlyMap<DocKey, DocData> {
    return this.local.docs;
  }

  /** Charge la vue (cache, ou tout relire sur le serveur), puis écoute. */
  async start(full: boolean): Promise<void> {
    const all = new Map<DocKey, DocData>();
    for (const name of COLLECTIONS) {
      const ref = collectionRef(this.db, name);
      const snap = full ? await getDocsFromServer(ref) : await getDocsFromCache(ref);
      const times: number[] = [];
      for (const d of snap.docs) {
        if (!this.kept(d.data(), d.metadata.hasPendingWrites)) continue;
        all.set(docKey(name, d.id), fromFirestore(d.data({ serverTimestamps: 'estimate' })));
        const t = syncedAtOf(d.data());
        if (full && t !== undefined && !d.metadata.hasPendingWrites) times.push(t);
      }
      if (full) {
        const next = advanceCursor(undefined, times);
        if (next === undefined) delete this.cursors[name];
        else this.cursors[name] = next;
      }
    }
    this.local.reset(all);
    if (full) this.hooks.onCursors?.({ ...this.cursors });
    this.listen();
  }

  /** (Re)lance les écouteurs delta à partir des curseurs. */
  listen(): void {
    this.stopListening();
    this.listeningSince = Date.now();
    for (const name of COLLECTIONS) {
      const q = query(collectionRef(this.db, name), orderBy('syncedAt'), startAfter(Timestamp.fromMillis(listenFrom(this.cursors, name))));
      this.stops.push(
        onSnapshot(
          q,
          { includeMetadataChanges: true },
          (snap) => this.onSnapshot(name, snap),
          (error) => {
            this.failure = `écoute ${name} : ${String(errorCode(error) ?? error)}`;
            this.hooks.onActivity?.();
          },
        ),
      );
    }
  }

  stopListening(): void {
    for (const stop of this.stops) stop();
    this.stops = [];
    this.inSync.clear();
  }

  write(ops: readonly WriteOp[]): void {
    for (const group of planWrites(ops, { view: this.local.docs, newId: newToken })) {
      const id = this.local.add(group);
      let commit: Promise<void>;
      try {
        const batch = writeBatch(this.db);
        for (const op of group) addToBatch(batch, this.db, op, this.uid);
        commit = batch.commit();
      } catch (error) {
        // Donnée refusée par le SDK lui-même (jamais attendu) : rien ne part.
        commit = Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      this.inflight += 1;
      this.hooks.onActivity?.();
      commit.then(
        () => this.settled(id),
        (error: unknown) => {
          // Mois déjà créé par l'autre (« créer si absent »), annulation déjà posée : attendu.
          const expected = group.length === 1 && errorCode(error) === 'permission-denied' &&
            (group[0]!.kind === 'create' || group[0]!.kind === 'update' || group[0]!.kind === 'raise');
          if (!expected) console.warn('A² Home — lot refusé', errorCode(error) ?? error, group);
          for (const op of group) void this.reread(op.collection, op.id);
          this.settled(id);
        },
      );
    }
  }

  subscribe(listener: (changes: readonly DocChange[]) => void): () => void {
    return this.local.subscribe(listener);
  }

  dispose(): void {
    this.stopListening();
  }

  private settled(id: number): void {
    this.inflight -= 1;
    this.local.settle(id);
    this.hooks.onActivity?.();
  }

  private onSnapshot(name: CollectionName, snap: QuerySnapshot): void {
    for (const change of snap.docChanges({ includeMetadataChanges: true })) {
      // Sorti du résultat : un lot refusé l'a ramené en arrière (rien n'est jamais vraiment supprimé).
      if (change.type === 'removed') void this.reread(name, change.doc.id);
      else if (!this.kept(change.doc.data(), change.doc.metadata.hasPendingWrites)) this.queue({ key: docKey(name, change.doc.id), data: null });
      else this.queue({ key: docKey(name, change.doc.id), data: fromFirestore(change.doc.data({ serverTimestamps: 'estimate' })) });
    }
    if (snap.metadata.fromCache) {
      this.inSync.delete(name);
    } else {
      const times = snap.docs.filter((d) => !d.metadata.hasPendingWrites && this.kept(d.data(), false)).flatMap((d) => syncedAtOf(d.data()) ?? []);
      const next = advanceCursor(this.cursors[name], times);
      if (next !== undefined && next !== this.cursors[name]) {
        this.cursors[name] = next;
        this.hooks.onCursors?.({ ...this.cursors });
      }
      const was = this.upToDate;
      this.inSync.add(name);
      if (!was && this.upToDate) this.hooks.onInSync?.();
    }
    this.hooks.onActivity?.();
  }

  /** Les changements de toutes les collections d'un même tour partent ensemble (une projection). */
  private queue(change: DocChange): void {
    this.queued.push(change);
    if (this.flushing) return;
    this.flushing = true;
    queueMicrotask(() => {
      this.flushing = false;
      const changes = this.queued;
      this.queued = [];
      this.local.receive(changes);
    });
  }

  /** Au-dessus du plancher de la dernière remise à zéro (sinon : comme supprimé). */
  private kept(data: DocumentData | undefined, pending: boolean): boolean {
    return data !== undefined && aboveFloor(syncedAtOf(data), pending, this.floor);
  }

  /** Relit un document dans le cache du SDK (vérité locale après un refus). */
  private async reread(name: CollectionName, id: string): Promise<void> {
    try {
      const snap = await getDocFromCache(doc(collectionRef(this.db, name), id));
      const live = snap.exists() && this.kept(snap.data(), snap.metadata.hasPendingWrites);
      this.queue({ key: docKey(name, id), data: live ? fromFirestore(snap.data({ serverTimestamps: 'estimate' })!) : null });
    } catch {
      this.queue({ key: docKey(name, id), data: null });
    }
  }
}
