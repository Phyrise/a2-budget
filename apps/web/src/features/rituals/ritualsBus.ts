/**
 * Petites demandes d'ouverture adressées à la barre des rituels depuis
 * ailleurs dans Maison (bandeau de la lanterne : « Voir dans le carnet »).
 * Hors de React : un simple abonnement, sans état global de l'app.
 */
import { useEffect } from 'react';

export type RitualRequest = { kind: 'carnet'; section?: 'lanterns' } | { kind: 'lantern-setup' };

const listeners = new Set<(r: RitualRequest) => void>();

export function requestRitual(r: RitualRequest): void {
  listeners.forEach((l) => l(r));
}

export function useRitualRequests(onRequest: (r: RitualRequest) => void): void {
  useEffect(() => {
    listeners.add(onRequest);
    return () => {
      listeners.delete(onRequest);
    };
  }, [onRequest]);
}
