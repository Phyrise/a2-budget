/**
 * Cœur de la synchronisation en marche, sans Firebase : le moteur
 * (SyncEngine) sur un transport, avec plusieurs écouteurs et la règle
 * « on ne décoche que ses propres gestes ». Le runtime Firestore
 * (firebase/sdk/runtime.ts) l'habille ; les tests le branchent sur le faux
 * transport en mémoire.
 */

import { liveFactsOfOccurrence, type AppState, type Role } from '@a2/core';
import { docsOf } from './docs';
import { SyncEngine } from './engine';
import type { LinkTarget } from './syncLink';
import type { SyncTransport } from './transport';

export interface SyncCoreOptions {
  role: Role;
  selectedMonth: string;
  now?: () => Date;
  newId?: () => string;
  /** Chaque état projeté (copie locale, par exemple). */
  onState?: (state: AppState) => void;
}

export class SyncCore implements LinkTarget {
  readonly engine: SyncEngine;
  private readonly listeners = new Set<(state: AppState) => void>();

  constructor(transport: SyncTransport, private readonly opts: SyncCoreOptions) {
    this.engine = new SyncEngine(transport, {
      role: opts.role,
      selectedMonth: opts.selectedMonth,
      ...(opts.now !== undefined ? { now: opts.now } : {}),
      ...(opts.newId !== undefined ? { newId: opts.newId } : {}),
      onState: (state) => {
        opts.onState?.(state);
        for (const listener of this.listeners) listener(state);
      },
    });
  }

  get role(): Role {
    return this.opts.role;
  }

  get state(): AppState | null {
    return this.engine.state;
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    const current = this.engine.state;
    if (current !== null) listener(current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  commit(prev: AppState, next: AppState): void {
    this.engine.commit(next, prev);
  }

  refresh(): void {
    this.engine.refresh();
  }

  /** Faux seulement si l'occurrence a des gestes vivants, et aucun de ce téléphone. */
  canUndo(collection: 'completions' | 'skips', taskId: string, dueDate: string): boolean {
    const facts = docsOf(this.engine.knownDocs, collection).map(([id, data]) => ({ ...data, id }) as {
      id: string; taskId: string; dueDate: string; role?: unknown; undoneAt?: string;
    });
    const live = liveFactsOfOccurrence(facts, taskId, dueDate);
    return live.length === 0 || live.some((f) => f.role === this.opts.role);
  }

  dispose(): void {
    this.listeners.clear();
    this.engine.dispose();
  }
}
