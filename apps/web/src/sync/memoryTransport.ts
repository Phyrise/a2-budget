/**
 * Faux serveur et faux transport en mémoire : simulent DEUX téléphones sans
 * aucun compte (tests du pont). Ce qu'ils reproduisent de Firestore :
 * - un lot est appliqué d'un bloc, avec les règles essentielles (faits non
 *   modifiables hors annulation, jalons jamais en baisse) ; refusé, il est
 *   retiré de la file et la vue revient à l'état du serveur ;
 * - chaque écriture reçoit l'heure du serveur (`syncedAt`, compteur) et son
 *   auteur (`updatedBy`) ;
 * - hors ligne, les lots attendent dans l'ordre ; la vue locale les montre
 *   tout de suite ; à la reconnexion, rattrapage puis envoi de la file.
 * L'ordre d'arrivée au serveur = l'ordre des reconnexions : les tests le font
 * varier.
 */

import type { Role } from '@a2/core';
import { applyBatch, applyOptimistic } from './apply';
import { jsonEqual, type DocData, type DocKey, type DocStore, type WriteOp } from './docs';
import type { DocChange, SyncTransport } from './transport';

export class MemoryServer {
  private docs = new Map<DocKey, DocData>();
  private clock = 0;
  private readonly clients = new Set<MemoryTransport>();
  /** Lots refusés par les règles (raisons). */
  readonly rejected: string[] = [];
  /** Nombre de lots acceptés. */
  commits = 0;

  get snapshot(): DocStore {
    return this.docs;
  }

  attach(client: MemoryTransport): void {
    this.clients.add(client);
  }

  detach(client: MemoryTransport): void {
    this.clients.delete(client);
  }

  /** Applique un lot (règles comprises) et le diffuse aux téléphones en ligne. */
  commit(ops: readonly WriteOp[], author: Role): boolean {
    const r = applyBatch(this.docs, ops, { rules: true, stamp: { syncedAt: (this.clock += 1), updatedBy: author } });
    if (!r.ok) {
      this.rejected.push(r.reason);
      return false;
    }
    this.docs = r.docs;
    this.commits += 1;
    const changes = r.changed.map((key) => ({ key, data: this.docs.get(key) ?? null }));
    for (const client of this.clients) client.receive(changes);
    return true;
  }
}

export class MemoryTransport implements SyncTransport {
  private cache = new Map<DocKey, DocData>();
  private pending: (readonly WriteOp[])[] = [];
  private view = new Map<DocKey, DocData>();
  private readonly listeners = new Set<(changes: readonly DocChange[]) => void>();
  private online = false;

  constructor(private readonly server: MemoryServer, private readonly role: Role, opts: { online?: boolean } = {}) {
    if (opts.online !== false) this.setOnline(true);
  }

  get isOnline(): boolean {
    return this.online;
  }

  /** Lots en attente d'envoi. */
  get pendingBatches(): number {
    return this.pending.length;
  }

  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    if (!online) {
      this.server.detach(this);
      return;
    }
    this.server.attach(this);
    this.cache = new Map(this.server.snapshot);
    this.refresh();
    this.flush();
  }

  write(ops: readonly WriteOp[]): void {
    if (ops.length === 0) return;
    this.pending.push([...ops]);
    this.refresh();
    if (this.online) this.flush();
  }

  subscribe(listener: (changes: readonly DocChange[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.view].map(([key, data]) => ({ key, data })));
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Changements diffusés par le serveur. */
  receive(changes: readonly DocChange[]): void {
    for (const { key, data } of changes) {
      if (data === null) this.cache.delete(key);
      else this.cache.set(key, data);
    }
    this.refresh();
  }

  private flush(): void {
    while (this.online && this.pending.length > 0) {
      this.server.commit(this.pending[0]!, this.role);
      this.pending.shift();
      this.refresh();
    }
  }

  private refresh(): void {
    const next = applyOptimistic(this.cache, this.pending);
    const changes: DocChange[] = [];
    for (const [key, data] of next) if (!jsonEqual(this.view.get(key), data)) changes.push({ key, data });
    for (const key of this.view.keys()) if (!next.has(key)) changes.push({ key, data: null });
    this.view = next;
    if (changes.length > 0) for (const listener of this.listeners) listener(changes);
  }
}
