/**
 * Dépenses communes du mois, éditables en place : renommer, montant,
 * retirer (annulable), ajouter. Une saisie invalide ne touche jamais l'état.
 * Univers Chihiro (écran Budget) : chaque dépense porte un kompeitō de
 * couleur stable (d'après son libellé) ; liste vide = Noiraude cachée.
 */
import type { MonthRecord } from '@a2/core';
import { useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { AmountInput, Button, IconButton, InlineTextField, TextField, cx, euro, fr, useToast } from '../../ui';
import { Konpeito, SusuwatariEmpty } from './chihiro/Susuwatari';

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
          <AmountInput
            id={`${idPrefix}-${e.id}-amount`}
            label={`Montant de ${e.label}`}
            labelVisible={false}
            appearance="inline"
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

export function ExpenseList({ month, totalCents }: { month: MonthRecord; totalCents: number }) {
  const { renameExpense, setExpenseAmount, removeExpense, addExpense } = useApp();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const key = month.monthKey;

  const remove = (id: string) => {
    const expense = month.expenses.find((e) => e.id === id);
    if (!expense) return;
    removeExpense(key, id);
    toast.show({
      message: fr(`Dépense retirée : ${expense.label}`),
      icon: 'trash',
      action: { label: 'Annuler', onClick: () => addExpense(key, expense.label, expense.amountCents) },
    });
  };

  return (
    <div className="sheet-section expenses">
      <div className="section-head">
        <h2 className="section-title">Dépenses communes</h2>
        <span className="section-head__meta amount">{euro(totalCents)}</span>
      </div>
      {month.expenses.length === 0 ? (
        <SusuwatariEmpty title="Aucune dépense ce mois-ci">
          {fr('Les Noiraudes attendent leurs kompeitō : ajoutez le loyer, les courses, les abonnements…')}
        </SusuwatariEmpty>
      ) : (
        <ExpenseEditorList
          idPrefix={`m-${key}`}
          expenses={month.expenses}
          onRename={(id, label) => renameExpense(key, id, label)}
          onAmount={(id, cents) => setExpenseAmount(key, id, cents)}
          onRemove={remove}
          konpeito
        />
      )}
      {adding ? (
        <ExpenseAddForm idPrefix={`m-${key}`} onAdd={(label, cents) => addExpense(key, label, cents)} onClose={() => setAdding(false)} />
      ) : (
        <Button variant="ghost" icon="plus" className="expenses__add" onClick={() => setAdding(true)}>
          Ajouter une dépense
        </Button>
      )}
    </div>
  );
}
