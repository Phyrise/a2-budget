/**
 * V5.10 — « Qui l'a fait ? » sans feuille : après une coche (Maison,
 * Calendrier) ou « Vider le panier » (Courses), un toast « Fait par toi »
 * propose les autres choix (« C'était AC », « Ensemble ») et « Annuler ».
 * Corriger change l'auteur de CE fait (reassignHomeCompletion : soin gardé,
 * luciole recolorée, kompeitō pas redonné) et remontre le toast à jour ;
 * ne rien toucher laisse la prédiction.
 */
import type { ChoreDoer } from '@a2/core';
import { useCallback } from 'react';
import { useApp } from '../../state/store';
import { Companion, useToast } from '../../ui';
import { doneMessage, otherChoices, type DoneSubject } from './doneToastText';

export interface DoneToastOptions {
  completionId: string;
  who: ChoreDoer;
  /** « Annuler » : défait le geste (et, pour Courses, tout le vidage). */
  undo: () => void;
  subject?: DoneSubject;
  /** Après une correction acceptée (réaction du compagnon…). */
  onReassign?: (who: ChoreDoer) => void;
}

export function useDoneToast(): (opts: DoneToastOptions) => void {
  const { appState, me, reassignHomeCompletion } = useApp();
  const toast = useToast();
  const nameA = appState?.budget.settings.personA.name ?? 'AL';
  const nameB = appState?.budget.settings.personB.name ?? 'AC';

  return useCallback(
    function showDone(opts: DoneToastOptions) {
      const names = { a: nameA, b: nameB };
      toast.show({
        message: doneMessage(opts.who, me, names, opts.subject),
        visual: (
          <span className="done-toast__who" data-who={opts.who}>
            <Companion who={opts.who} size={opts.who === 'both' ? 24 : 28} mood="happy" />
          </span>
        ),
        actions: [
          ...otherChoices(opts.who, me, names).map((c) => ({
            label: c.label,
            ariaLabel: c.ariaLabel,
            id: `who-${c.who}`,
            onClick: () => {
              if (!reassignHomeCompletion(opts.completionId, c.who)) return;
              opts.onReassign?.(c.who);
              showDone({ ...opts, who: c.who });
            },
          })),
          { label: 'Annuler', id: 'undo', onClick: opts.undo },
        ],
      });
    },
    [toast, me, nameA, nameB, reassignHomeCompletion],
  );
}
