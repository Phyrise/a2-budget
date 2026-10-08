/**
 * Vue d'un téléphone (docs/SYNC_DESIGN.md §4) : les documents reçus (cache
 * local, serveur) + ses propres lots pas encore confirmés, appliqués par
 * dessus (« dernier qui écrit gagne », comme le cache de Firestore).
 *
 * Un lot écrit est visible tout de suite (le moteur projette dans le même
 * tour : le geste suivant voit le précédent) et le reste jusqu'à son issue
 * (accepté ou refusé par le serveur). Réappliquer un lot déjà reçu ne change
 * rien (créer si absent, mêmes champs). Sans Firebase, sans React.
 */

import { applyOptimistic } from './apply';
import { jsonEqual, type DocData, type DocKey, type DocStore, type WriteOp } from './docs';
import type { DocChange } from './transport';

export class LocalView {
  private base = new Map<DocKey, DocData>();
  private readonly pending = new Map<number, readonly WriteOp[]>();
  private view = new Map<DocKey, DocData>();
  private readonly listeners = new Set<(changes: readonly DocChange[]) => void>();
  private seq = 0;

  /** Documents vus (reçus + lots en attente). */
  get docs(): DocStore {
    return this.view;
  }

  /** Documents reçus seulement (sans les lots en attente). */
  get received(): DocStore {
    return this.base;
  }

  /** Lots en attente d'une issue. */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** Documents reçus (null : il n'existe plus). */
  receive(changes: readonly DocChange[]): void {
    if (changes.length === 0) return;
    for (const { key, data } of changes) {
      if (data === null) this.base.delete(key);
      else this.base.set(key, data);
    }
    this.refresh();
  }

  /** Remplace tout ce qui a été reçu (resynchronisation complète). */
  reset(docs: ReadonlyMap<DocKey, DocData>): void {
    this.base = new Map(docs);
    this.refresh();
  }

  /** Lot écrit par ce téléphone : visible tout de suite. Renvoie son numéro. */
  add(ops: readonly WriteOp[]): number {
    this.seq += 1;
    this.pending.set(this.seq, [...ops]);
    this.refresh();
    return this.seq;
  }

  /** Le lot a son issue (confirmé, ou refusé : la vue revient au reçu). */
  settle(id: number): void {
    if (this.pending.delete(id)) this.refresh();
  }

  /** D'abord tout ce qui est vu, puis les changements. */
  subscribe(listener: (changes: readonly DocChange[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.view].map(([key, data]) => ({ key, data })));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private refresh(): void {
    const next = applyOptimistic(this.base, [...this.pending.values()]);
    const changes: DocChange[] = [];
    for (const [key, data] of next) if (!jsonEqual(this.view.get(key), data)) changes.push({ key, data });
    for (const key of this.view.keys()) if (!next.has(key)) changes.push({ key, data: null });
    this.view = next;
    if (changes.length > 0) for (const listener of this.listeners) listener(changes);
  }
}
