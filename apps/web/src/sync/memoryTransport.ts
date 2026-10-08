/**
 * Faux serveur et faux transport en mémoire : simulent DEUX téléphones sans
 * aucun compte (tests du pont). Ce qu'ils reproduisent de Firestore :
 * - un lot est appliqué d'un bloc, avec les règles essentielles (faits non
 *   modifiables hors annulation, annulés une fois et par leur auteur, jalons
 *   jamais en baisse) ; refusé, il est retiré de la file et la vue revient à
 *   l'état du serveur ;
 * - le téléphone découpe ses écritures comme le transport Firestore
 *   (writePlan.ts : créer si absent, annulations à part) ;
 * - chaque écriture reçoit l'heure du serveur (`syncedAt`, compteur) et son
 *   auteur (`updatedBy`) ;
 * - hors ligne, les lots attendent dans l'ordre ; la vue locale les montre
 *   tout de suite ; à la reconnexion, rattrapage puis envoi de la file.
 * L'ordre d'arrivée au serveur = l'ordre des reconnexions : les tests le font
 * varier.
 */

import type { Role } from '@a2/core';
import { applyBatch } from './apply';
import type { DocData, DocKey, DocStore, WriteOp } from './docs';
import { LocalView } from './localView';
import type { DocChange, SyncTransport } from './transport';
import { planWrites } from './writePlan';

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
    const r = applyBatch(this.docs, ops, { rules: true, author, stamp: { syncedAt: this.clock + 1, updatedBy: author } });
    if (!r.ok) {
      this.rejected.push(r.reason);
      return false;
    }
    this.clock += 1;
    this.docs = r.docs;
    this.commits += 1;
    const changes = r.changed.map((key) => ({ key, data: this.docs.get(key) ?? null }));
    for (const client of this.clients) client.receive(changes);
    return true;
  }
}

export class MemoryTransport implements SyncTransport {
  private readonly local = new LocalView();
  /** Lots en file (numéro de la vue, écritures), dans l'ordre. */
  private queue: { id: number; ops: readonly WriteOp[] }[] = [];
  private online = false;
  private tokens = 0;

  constructor(private readonly server: MemoryServer, private readonly role: Role, opts: { online?: boolean } = {}) {
    if (opts.online !== false) this.setOnline(true);
  }

  get isOnline(): boolean {
    return this.online;
  }

  /** Lots en attente d'envoi. */
  get pendingBatches(): number {
    return this.queue.length;
  }

  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    if (!online) {
      this.server.detach(this);
      return;
    }
    this.server.attach(this);
    this.local.reset(this.server.snapshot);
    this.flush();
  }

  /** Comme le transport Firestore : plan d'envoi (writePlan.ts), puis un lot par groupe. */
  write(ops: readonly WriteOp[]): void {
    const batches = planWrites(ops, { view: this.local.docs, newId: () => `${this.role}-creation-${(this.tokens += 1)}` });
    for (const batch of batches) this.queue.push({ id: this.local.add(batch), ops: batch });
    if (this.online) this.flush();
  }

  subscribe(listener: (changes: readonly DocChange[]) => void): () => void {
    return this.local.subscribe(listener);
  }

  /** Changements diffusés par le serveur. */
  receive(changes: readonly DocChange[]): void {
    this.local.receive(changes);
  }

  private flush(): void {
    while (this.online && this.queue.length > 0) {
      const { id, ops } = this.queue.shift()!;
      this.server.commit(ops, this.role);
      this.local.settle(id);
    }
  }
}
