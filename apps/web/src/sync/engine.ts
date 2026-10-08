/**
 * SyncEngine : le pont entre le store (AppState, actions inchangées) et un
 * transport (docs/SYNC_DESIGN.md §3.1). Sans React, sans Firebase.
 *
 * - Transition locale `avant → après` : `commit` la traduit en écritures
 *   minimales (diffToOps) et les confie au transport.
 * - Documents reçus (vue du transport) : projetés en AppState (projectState)
 *   et rendus au store avec l'origine `remote` ; ils ne repassent jamais par
 *   diffToOps (pas d'écho).
 * - La forêt affichée est toujours le rejeu des faits, relevé aux jalons.
 * - Le mois affiché reste celui du téléphone.
 * - Une projection invalide n'est jamais propagée : l'état précédent reste,
 *   les raisons sont gardées dans `issues`.
 */

import type { AppState, Role } from '@a2/core';
import { diffToOps } from './diff';
import type { DocData, DocKey } from './docs';
import { projectState } from './project';
import type { DocChange, SyncTransport } from './transport';

export type SyncOrigin = 'local' | 'remote';

export interface SyncEngineOptions {
  /** Rôle de ce téléphone ('a' = AL, 'b' = AC). */
  role: Role;
  /** Mois affiché sur ce téléphone. */
  selectedMonth: string;
  now?: () => Date;
  newId?: () => string;
  /** Chaque nouvel état projeté. */
  onState?: (state: AppState, origin: SyncOrigin) => void;
}

function defaultId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class SyncEngine {
  private readonly docs = new Map<DocKey, DocData>();
  private current: AppState | null = null;
  private selectedMonth: string;
  private writing = false;
  private problems: string[] = [];
  private readonly unsubscribe: () => void;

  constructor(private readonly transport: SyncTransport, private readonly opts: SyncEngineOptions) {
    this.selectedMonth = opts.selectedMonth;
    this.unsubscribe = transport.subscribe((changes) => this.receive(changes));
  }

  /** Dernier état projeté (null tant qu'aucun document valide n'est connu). */
  get state(): AppState | null {
    return this.current;
  }

  /** Documents ignorés ou projection refusée, à la dernière projection. */
  get issues(): readonly string[] {
    return this.problems;
  }

  /** Documents connus (vue locale). */
  get knownDocs(): ReadonlyMap<DocKey, DocData> {
    return this.docs;
  }

  /**
   * Transition locale. `prev` : l'état d'où part la transition (par défaut le
   * dernier état projeté). Renvoie l'état projeté après écriture.
   */
  commit(next: AppState, prev: AppState | null = this.current): AppState | null {
    if (prev === null) return this.current;
    this.selectedMonth = next.budget.selectedMonth;
    const ops = diffToOps(prev, next, {
      docs: this.docs,
      role: this.opts.role,
      now: this.now(),
      newId: this.opts.newId ?? defaultId,
    });
    if (ops.length === 0) {
      if (this.current !== null && this.current.budget.selectedMonth !== this.selectedMonth) this.reproject('local');
      return this.current;
    }
    this.writing = true;
    try {
      this.transport.write(ops);
    } finally {
      this.writing = false;
    }
    return this.current;
  }

  /** Recalcule (changement de jour : la forêt avance). */
  refresh(): AppState | null {
    this.reproject('local');
    return this.current;
  }

  dispose(): void {
    this.unsubscribe();
  }

  private now(): Date {
    return this.opts.now?.() ?? new Date();
  }

  private receive(changes: readonly DocChange[]): void {
    for (const { key, data } of changes) {
      if (data === null) this.docs.delete(key);
      else this.docs.set(key, data);
    }
    this.reproject(this.writing ? 'local' : 'remote');
  }

  private reproject(origin: SyncOrigin): void {
    if (this.docs.size === 0) return;
    const r = projectState(this.docs, { selectedMonth: this.selectedMonth, today: this.now() });
    this.problems = r.issues;
    if (!r.ok) return;
    this.current = r.state;
    this.opts.onState?.(r.state, origin);
  }
}
