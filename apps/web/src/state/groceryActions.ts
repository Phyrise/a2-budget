/**
 * Actions des Courses du store. Même sémantique que les autres actions :
 * transition PURE via `transact` (id et horloge capturés avant, sûr en
 * StrictMode), résultat synchrone, écriture sérialisée par le store.
 * V5 : en mode synchronisé, un ajout sans auteur est signé du compte
 * connecté (`me`).
 */
import { useCallback, useMemo } from 'react';
import {
  addGroceryItem,
  clearDoneGroceries as coreClearDoneGroceries,
  clearedGroceries,
  forgetGroceryCategory,
  rememberGroceryCategory,
  removeGroceryItem,
  restoreGroceryItem,
  toggleGroceryItem,
  undoClearGroceries as coreUndoClearGroceries,
  updateGroceryItem,
  type ClearedGrocery,
  type GroceryAuthor,
  type GroceryItem,
  type GroceryItemPatch,
  type Role,
} from '@a2/core';
import type { Transact } from './careActions';
import { newId } from './ids';

/** Résultat synchrone d'un ajout aux courses. */
export interface AddGroceryResult {
  /** Faux si la saisie était vide ou si l'article était déjà dans la liste. */
  added: boolean;
  /** Article ajouté, ou l'article existant (doublon), ou null (saisie vide). */
  item: GroceryItem | null;
}

/** Article retiré (à passer à `restoreGrocery` pour annuler). */
export interface RemovedGrocery {
  item: GroceryItem;
  index: number;
}

export interface GroceryActions {
  /**
   * Ajout rapide (« 2 pommes », « lait x2 », « 500 g de farine ») : quantité
   * extraite, rayon automatique, pas de doublon d'un article non coché.
   */
  addGrocery: (label: string, addedBy?: GroceryAuthor) => AddGroceryResult;
  /** Met au panier / sort du panier (doneAt horodaté). */
  toggleGrocery: (id: string) => void;
  /** Retire un article (sans l'archiver). Retourne de quoi annuler, ou null si inconnu. */
  removeGrocery: (id: string) => RemovedGrocery | null;
  /** Annule un retrait (remet l'article à sa place). */
  restoreGrocery: (removed: RemovedGrocery) => void;
  /**
   * Renomme / change la quantité / change le rayon (null = rayon automatique).
   * V4 : un rayon choisi est mémorisé pour ce libellé (prochains ajouts du
   * même article) ; null l'oublie.
   */
  updateGrocery: (id: string, patch: GroceryItemPatch) => void;
  /**
   * « Vider le panier » : archive les articles cochés dans l'historique.
   * Retourne les articles rangés (vide : rien à vider), à passer à
   * `undoClearGroceries` pour annuler.
   */
  clearDoneGroceries: () => ClearedGrocery[];
  /**
   * Annule un vidage : les articles reviennent cochés à leur place (ids
   * neufs), leurs achats quittent l'historique. Faux si rien à annuler.
   */
  undoClearGroceries: (cleared: readonly ClearedGrocery[]) => boolean;
}

export function useGroceryActions(transact: Transact, me: Role | null): GroceryActions {
  const addGrocery = useCallback(
    (label: string, addedBy?: GroceryAuthor): AddGroceryResult => {
      const now = new Date();
      const id = newId();
      return transact<AddGroceryResult>(
        (s) => {
          const memory = s.groceries.categoryMemory;
          const by = addedBy ?? me ?? undefined;
          const r = addGroceryItem(s.groceries.items, label, { id, now, addedBy: by, ...(memory ? { memory } : {}) });
          return {
            state: r.items === s.groceries.items ? s : { ...s, groceries: { ...s.groceries, items: r.items } },
            result: { added: r.added, item: r.item },
          };
        },
        { added: false, item: null },
      );
    },
    [transact, me],
  );

  const toggleGrocery = useCallback(
    (id: string) => {
      const now = new Date();
      transact((s) => {
        const items = toggleGroceryItem(s.groceries.items, id, now);
        return {
          state: items === s.groceries.items ? s : { ...s, groceries: { ...s.groceries, items } },
          result: undefined,
        };
      }, undefined);
    },
    [transact],
  );

  const removeGrocery = useCallback(
    (id: string): RemovedGrocery | null =>
      transact<RemovedGrocery | null>((s) => {
        const index = s.groceries.items.findIndex((item) => item.id === id);
        if (index === -1) return { state: s, result: null };
        const items = removeGroceryItem(s.groceries.items, id);
        return {
          state: { ...s, groceries: { ...s.groceries, items } },
          result: { item: s.groceries.items[index]!, index },
        };
      }, null),
    [transact],
  );

  const restoreGrocery = useCallback(
    (removed: RemovedGrocery) => {
      transact((s) => {
        const items = restoreGroceryItem(s.groceries.items, removed.item, removed.index);
        return {
          state: items === s.groceries.items ? s : { ...s, groceries: { ...s.groceries, items } },
          result: undefined,
        };
      }, undefined);
    },
    [transact],
  );

  const updateGrocery = useCallback(
    (id: string, patch: GroceryItemPatch) => {
      transact((s) => {
        const before = s.groceries.categoryMemory;
        const items = updateGroceryItem(s.groceries.items, id, patch, before);
        // V4 — mémoire des rayons : un rayon choisi est retenu pour ce
        // libellé ; « rayon automatique » (null) l'oublie.
        const item = items.find((x) => x.id === id);
        let memory = before;
        if (item !== undefined && patch.category === null) {
          memory = forgetGroceryCategory(before, item.label);
        } else if (item !== undefined && patch.category !== undefined && item.category === patch.category) {
          memory = rememberGroceryCategory(before, item.label, patch.category);
        }
        if (items === s.groceries.items && memory === before) return { state: s, result: undefined };
        const groceries = { ...s.groceries, items };
        if (memory !== undefined) groceries.categoryMemory = memory;
        return { state: { ...s, groceries }, result: undefined };
      }, undefined);
    },
    [transact],
  );

  const clearDoneGroceries = useCallback((): ClearedGrocery[] => {
    const now = new Date();
    return transact<ClearedGrocery[]>((s) => {
      const groceries = coreClearDoneGroceries(s.groceries, now);
      return groceries === s.groceries
        ? { state: s, result: [] }
        : { state: { ...s, groceries }, result: clearedGroceries(s.groceries) };
    }, []);
  }, [transact]);

  const undoClearGroceries = useCallback(
    (cleared: readonly ClearedGrocery[]): boolean => {
      const ids = cleared.map(() => newId());
      return transact((s) => {
        const groceries = coreUndoClearGroceries(s.groceries, cleared, ids);
        return groceries === s.groceries ? { state: s, result: false } : { state: { ...s, groceries }, result: true };
      }, false);
    },
    [transact],
  );

  return useMemo(
    () => ({ addGrocery, toggleGrocery, removeGrocery, restoreGrocery, updateGrocery, clearDoneGroceries, undoClearGroceries }),
    [addGrocery, toggleGrocery, removeGrocery, restoreGrocery, updateGrocery, clearDoneGroceries, undoClearGroceries],
  );
}
