/**
 * Listes de dépenses éditables en place des Réglages (dépenses récurrentes) :
 * renommer, montant (− / + à l'euro, toucher pour saisir), retirer, ajouter.
 * Une saisie invalide ne touche jamais l'état.
 * Le Budget utilise désormais « Ce mois-ci » (MonthLedger, montants au pavé).
 */
import type { MonthRecord } from '@a2/core';
import { useRef, useState } from 'react';
import { AmountInput, Button, EuroStepper, IconButton, InlineTextField, TextField, cx } from '../../ui';
import { Konpeito } from './chihiro/Susuwatari';

export function ExpenseEditorList({
  idPrefix,
  expenses,
  onRename,
  onAmount,
  onRemove,
  konpeito = false,
}: {
  idPrefix: string;
  expenses: MonthRecord['expenses'];
  onRename: (id: string, label: string) => void;
  onAmount: (id: string, cents: number) => void;
  onRemove: (id: string) => void;
  /** Pastille kompeitō devant chaque libellé (écran Budget uniquement). */
  konpeito?: boolean;
}) {
  return (
    <ul className={cx('expense-list', konpeito && 'expense-list--konpeito')}>
      {expenses.map((e) => (
        <li key={e.id} className="expense-row">
          {konpeito && <Konpeito label={e.label} />}
          <InlineTextField
            id={`${idPrefix}-${e.id}-label`}
            label={`Libellé de la dépense ${e.label}`}
            value={e.label}
            onCommit={(label) => onRename(e.id, label)}
            className="expense-row__label"
          />
          <EuroStepper
            id={`${idPrefix}-${e.id}-amount`}
            label={`Montant de ${e.label}`}
            valueCents={e.amountCents}
            onCommit={(cents) => onAmount(e.id, cents)}
            className="expense-row__amount"
          />
          <IconButton icon="close" label={`Retirer ${e.label}`} variant="ghost" className="expense-row__remove" onClick={() => onRemove(e.id)} />
        </li>
      ))}
    </ul>
  );
}

/** Formulaire d'ajout : libellé + montant (vide refusé, « 0 » accepté). */
export function ExpenseAddForm({
  idPrefix,
  onAdd,
  onClose,
}: {
  idPrefix: string;
  onAdd: (label: string, cents: number) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [cents, setCents] = useState(0);
  const [amountValid, setAmountValid] = useState(true);
  const [amountKey, setAmountKey] = useState(0);
  const labelRef = useRef<HTMLInputElement>(null);
  const canAdd = label.trim() !== '' && amountValid;

  const submit = () => {
    if (!canAdd) return;
    onAdd(label.trim(), cents);
    setLabel('');
    setCents(0);
    setAmountValid(true);
    setAmountKey((k) => k + 1);
    labelRef.current?.focus();
  };

  return (
    <form
      className="expense-add"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        ref={labelRef}
        id={`${idPrefix}-add-label`}
        label="Libellé"
        value={label}
        onChange={setLabel}
        placeholder="Ex. Mutuelle"
        maxLength={80}
        autoFocus
        enterKeyHint="next"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById(`${idPrefix}-add-amount`)?.focus();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        className="expense-add__label"
      />
      <AmountInput
        key={amountKey}
        id={`${idPrefix}-add-amount`}
        label="Montant"
        valueCents={cents}
        onCommit={setCents}
        onValidityChange={setAmountValid}
        onEnter={submit}
        className="expense-add__amount"
      />
      <div className="expense-add__actions">
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        <Button type="submit" variant="primary" icon="plus" disabled={!canAdd} className="expense-add__submit">
          Ajouter
        </Button>
      </div>
    </form>
  );
}
