/**
 * « Recaler sur le compte » (V4) : on regarde le vrai solde du compte commun
 * et on l'écrit ici, en euros entiers (négatif permis : « −120 » ou la case
 * « À découvert »), avec une note facultative. L'estimation repart de ce
 * chiffre à partir de ce mois ; les mois passés ne sont jamais réécrits.
 * Historique des recalages replié (Disclosure), chacun retirable.
 *
 * Saisie : `parseEurosInput` (@a2/core) tranche ; seul le signe est lu ici.
 * Écriture : `recordBalanceCorrection(..., { asOf: 'now' })` du store.
 */
import type { BalanceCorrection } from '@a2/core';
import { BALANCE_NOTE_MAX, monthKeyToLabel, parseEurosInput, roundToEuroCents } from '@a2/core';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { Button, Disclosure, Sheet, Switch, TextField, euro, euroMinus, fr, useToast } from '../../ui';
import { EURO_ERROR_MESSAGES } from '../../ui/AmountInput';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** « 1 234 », « −120 », « - 1 200 € » → euros entiers signés. */
export function parseSignedEuros(raw: string): { ok: true; euros: number } | { ok: false; reason: string } {
  const text = raw.trim();
  const negative = /^[-−–]/u.test(text);
  const result = parseEurosInput(negative ? text.slice(1) : text);
  if (!result.ok) return { ok: false, reason: result.reason };
  const euros = result.cents / 100;
  return { ok: true, euros: negative && euros !== 0 ? -euros : euros };
}

function signed(cents: number): string {
  return cents < 0 ? euroMinus(-cents) : euro(cents);
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
  const { recordBalanceCorrection, removeBalanceCorrection } = useApp();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [overdrawn, setOverdrawn] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // À l'ouverture : l'estimation actuelle sert de point de départ.
  useEffect(() => {
    if (!open) return;
    const rounded = roundToEuroCents(nowCents) / 100;
    setAmount(String(Math.abs(rounded)));
    setOverdrawn(rounded < 0);
    setNote('');
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parseSignedEuros(amount);
  const euros = parsed.ok ? (overdrawn ? -Math.abs(parsed.euros) : parsed.euros) : null;

  const save = () => {
    if (!parsed.ok || euros === null) {
      setError(parsed.ok ? null : (EURO_ERROR_MESSAGES[parsed.reason] ?? 'Écrivez le solde en euros, par exemple 1 234.'));
      return;
    }
    const previous = corrections.find((c) => c.monthKey === monthKey);
    const trimmed = note.trim();
    if (!recordBalanceCorrection(monthKey, euros, trimmed === '' ? undefined : trimmed, { asOf: 'now' })) {
      setError('Ce solde n’a pas pu être enregistré.');
      return;
    }
    onClose();
    toast.show({
      message: fr(`Compte recalé : ${signed(euros * 100)}`),
      icon: 'check',
      action: {
        label: 'Annuler',
        onClick: () => {
          if (previous) recordBalanceCorrection(monthKey, roundToEuroCents(previous.balanceCents) / 100, previous.note);
          else removeBalanceCorrection(monthKey);
        },
      },
    });
  };

  const remove = (c: BalanceCorrection) => {
    if (!removeBalanceCorrection(c.monthKey)) return;
    toast.show({
      message: fr(`Recalage de ${monthKeyToLabel(c.monthKey)} retiré`),
      icon: 'undo',
      action: {
        label: 'Annuler',
        onClick: () => recordBalanceCorrection(c.monthKey, roundToEuroCents(c.balanceCents) / 100, c.note),
      },
    });
  };

  const history = [...corrections].sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Recaler sur le compte"
      description={fr('Regardez le solde de votre compte commun et écrivez-le ici : l’estimation repart de ce chiffre, sans changer les mois passés.')}
      size="auto"
      className="recalibrate"
      initialFocusRef={amountRef}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="check" onClick={save}>
            Recaler
          </Button>
        </>
      }
    >
      <form
        className="recalibrate__form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <TextField
          ref={amountRef}
          id="recalibrate-amount"
          label="Solde du compte en ce moment, en euros"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            if (error) setError(null);
          }}
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          error={error}
          hint="En euros entiers, sans centimes."
          onFocus={(event) => event.currentTarget.select()}
        />
        <Switch checked={overdrawn} onChange={setOverdrawn} label="À découvert (solde négatif)" className="recalibrate__overdrawn" />
        <TextField
          id="recalibrate-note"
          label="Note"
          value={note}
          onChange={setNote}
          maxLength={BALANCE_NOTE_MAX}
          placeholder="Ex. relevé du 6 octobre"
          hint="Facultatif"
          enterKeyHint="done"
        />
      </form>
      {history.length > 0 && (
        <Disclosure summary="Recalages précédents" meta={String(history.length)} className="recalibrate__history">
          <ul className="recalibrate__list">
            {history.map((c) => (
              <li key={c.id} className="recalibrate__item" data-testid="correction">
                <span className="recalibrate__item-text">
                  <span className="recalibrate__item-month">{monthKeyToLabel(c.monthKey)}</span>
                  <span className="recalibrate__item-detail">
                    {fr(`début du mois : ${signed(c.balanceCents)}`)}
                    {c.note ? ` · ${c.note}` : ''}
                  </span>
                  <span className="recalibrate__item-date">noté le {dateFormatter.format(new Date(c.recordedAt))}</span>
                </span>
                <Button variant="quiet" size="sm" onClick={() => remove(c)} aria-label={`Retirer le recalage de ${monthKeyToLabel(c.monthKey)}`}>
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </Sheet>
  );
}
