/**
 * Petit ensemble d'identifiants en état React (articles en cours de coup de
 * balai, de retour…). Mises à jour fonctionnelles : plusieurs gestes rapides
 * ne s'écrasent pas. L'objet change d'identité à chaque modification (utile
 * comme dépendance de useMemo).
 */
import { useCallback, useMemo, useState } from 'react';

export interface IdSet {
  has: (id: string) => boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  size: number;
}

export function useIdSet(): IdSet {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const add = useCallback((id: string) => {
    setIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);
  const remove = useCallback((id: string) => {
    setIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  return useMemo(() => ({ has: (id: string) => ids.has(id), add, remove, size: ids.size }), [ids, add, remove]);
}
