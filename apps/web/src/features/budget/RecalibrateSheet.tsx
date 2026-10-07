/**
 * « Recaler sur le compte » (V4.2.1) : le vrai solde du compte commun, saisi
 * au pavé comme les salaires (AmountPad : aucun clavier système, rien ne se
 * cache sous un clavier), prérempli avec l'estimation actuelle. Euros
 * entiers, jamais négatif. Seule précision : le dernier recalage (montant
 * saisi, date), figé à l'ouverture.
 *
 * Écriture : `recordBalanceCorrection(..., { asOf: 'now' })` du store,
 * toujours sur le **mois courant** (la feuille n'est proposée que là). Même
 * un montant inchangé confirme le solde. « Annuler » (toast) remet la
 * correction précédente à l'identique ou la retire.
 */
import type { BalanceCorrection } from '@a2/core';
import { BALANCE_ANCHOR_NOTE } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../state/store';
import { AmountPad, euro, euroMinus, fr, useToast } from '../../ui';

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function signed(cents: number): string {
  return cents < 0 ? euroMinus(-cents) : euro(cents);
}

/** Dernier vrai recalage (l'ancrage automatique n'en est pas un). */
function lastRecalibration(corrections: readonly BalanceCorrection[]): BalanceCorrection | undefined {
  let last: BalanceCorrection | undefined;
  for (const c of corrections) {
    if (c.note === BALANCE_ANCHOR_NOTE) continue;
    if (last === undefined || c.recordedAt > last.recordedAt) last = c;
  }
  return last;
}

/** « Dernier recalage : 1 500 €, le 6 octobre » (sans montant pour un recalage d'avant V4.2.1). */
function lastLine(corrections: readonly BalanceCorrection[]): string | undefined {
  const c = lastRecalibration(corrections);
  if (c === undefined) return undefined;
  const at = new Date(c.recordedAt);
  const now = new Date();
  const when =
    at.toDateString() === now.toDateString()
      ? 'aujourd’hui'
      : `le ${(at.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear).format(at)}`;
  return fr(c.observedCents === undefined ? `Dernier recalage ${when}` : `Dernier recalage : ${signed(c.observedCents)}, ${when}`);
}

export function RecalibrateSheet({
  open,
  onClose,
  monthKey,
  nowCents,
  corrections,
}: {
  open: boolean;
  onClose: () => void;
  monthKey: string;
  /** Solde estimé en ce moment (point de départ de la saisie). */
  nowCents: number;
  corrections: readonly BalanceCorrection[];
}) {
  const { recordBalanceCorrection, removeBalanceCorrection, restoreBalanceCorrection } = useApp();
  const toast = useToast();
  // Figé à l'ouverture : la ligne ne change pas pendant la fermeture.
  const [last, setLast] = useState(() => lastLine(corrections));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setLast(lastLine(corrections));
  }

  const commit = (cents: number) => {
    const previous = corrections.find((c) => c.monthKey === monthKey);
    if (!recordBalanceCorrection(monthKey, cents / 100, undefined, { asOf: 'now' })) {
      toast.show({ message: 'Ce solde n’a pas pu être enregistré.', icon: 'info' });
      return;
    }
    toast.show({
      message: fr(`Compte recalé : ${euro(cents)}`),
      icon: 'check',
      action: {
        label: 'Annuler',
        onClick: () => {
          if (previous) restoreBalanceCorrection(previous);
          else removeBalanceCorrection(monthKey);
        },
      },
    });
  };

  return (
    <AmountPad
      open={open}
      onClose={onClose}
      title="Recaler sur le compte"
      description={last}
      valueCents={Math.max(0, nowCents)}
      onCommit={commit}
      commitUnchanged
      confirmLabel="Recaler"
      idPrefix="recalibrate"
      className="recalibrate"
    />
  );
}
