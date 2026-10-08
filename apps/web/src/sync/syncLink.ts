/**
 * Lien entre le store et la synchronisation (docs/SYNC_DESIGN.md §3.1), sans
 * Firebase ni React : il vit dans le bundle principal, le moteur et le
 * transport arrivent plus tard par le chunk Firebase.
 *
 * - Le store lui confie chaque transition locale `prev → next` ; les états
 *   projetés (gestes de l'autre, rejeu de la forêt) lui reviennent par
 *   `listen`.
 * - Le premier affichage vient de la copie locale (`initial`), avant même
 *   que le SDK soit chargé. Les gestes faits d'ici là sont gardés : quand la
 *   synchronisation est prête (`attach`), la différence entre l'état de
 *   départ et le dernier état part en une fois.
 * - Décocher : seulement ses propres gestes (`canUndo`).
 */

import type { AppState, Role } from '@a2/core';

/** Ce que le lien attend de la synchronisation en marche (SyncRuntime). */
export interface LinkTarget {
  subscribe(listener: (state: AppState) => void): () => void;
  commit(prev: AppState, next: AppState): void;
  refresh(): void;
  canUndo(collection: 'completions' | 'skips', taskId: string, dueDate: string): boolean;
}

let links = 0;

export class SyncLink {
  /** Numéro du lien (le store est remonté quand il change). */
  readonly id = (links += 1);
  private target: LinkTarget | null = null;
  private stop: (() => void) | null = null;
  /** Gestes faits avant `attach` : état de départ et dernier état. */
  private base: AppState | null = null;
  private latest: AppState | null = null;
  private listener: ((state: AppState) => void) | null = null;
  /** Dernier état projeté reçu (rendu à un store qui écoute après coup). */
  private last: AppState | null = null;

  constructor(
    /** Rôle du compte connecté ('a' = AL, 'b' = AC) : « qui ? » est connu. */
    readonly role: Role,
    /** Copie locale du dernier état synchronisé (premier affichage). */
    readonly initial: AppState,
  ) {}

  /** La synchronisation est-elle branchée ? */
  get attached(): boolean {
    return this.target !== null;
  }

  /** Branche la synchronisation prête : gestes gardés envoyés, états projetés relayés. */
  attach(target: LinkTarget): void {
    this.detach();
    this.target = target;
    const [base, latest] = [this.base, this.latest];
    this.base = null;
    this.latest = null;
    if (base !== null && latest !== null && base !== latest) this.send(base, latest);
    this.stop = target.subscribe((state) => {
      this.last = state;
      this.listener?.(state);
    });
  }

  detach(): void {
    this.stop?.();
    this.stop = null;
    this.target = null;
  }

  /** Transition locale du store. */
  commit(prev: AppState, next: AppState): void {
    if (prev === next) return;
    if (this.target !== null) {
      this.send(prev, next);
      return;
    }
    this.base ??= prev;
    this.latest = next;
  }

  /** Un geste qui ne part pas ne doit jamais casser l'app (il reste affiché, la projection suivante tranche). */
  private send(prev: AppState, next: AppState): void {
    try {
      this.target?.commit(prev, next);
    } catch (error) {
      console.error('A² Home — synchronisation : geste non envoyé', error);
    }
  }

  /** Changement de jour (la forêt avance). */
  refresh(): void {
    this.target?.refresh();
  }

  canUndo(collection: 'completions' | 'skips', taskId: string, dueDate: string): boolean {
    return this.target?.canUndo(collection, taskId, dueDate) ?? true;
  }

  /** Le store écoute les états projetés (un seul écouteur : le store monté). */
  listen(listener: (state: AppState) => void): () => void {
    this.listener = listener;
    if (this.last !== null) listener(this.last);
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }
}
