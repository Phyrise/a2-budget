import { useRef, useState, type FormEvent } from 'react';
import type { Expense } from '@a2/core';
import { AmountInput } from './AmountInput';

/**
 * Liste de dépenses modifiable (renommer, montant, retirer) + formulaire
 * d'ajout. Utilisée pour les dépenses d'un mois et les dépenses récurrentes.
 *
 * Le montant de la nouvelle dépense reste local au formulaire (chaîne
 * d'édition séparée de l'état) : il n'entre dans l'état qu'à l'ajout.
 */
export function ExpenseEditor({
  items,
  onRename,
  onAmount,
  onRemove,
  onAdd,
  addLabel,
  idPrefix = 'expense',
}: {
  items: Expense[];
  onRename: (id: string, label: string) => void;
  onAmount: (id: string, cents: number) => void;
  onRemove: (id: string) => void;
  onAdd: (label: string, cents: number) => void;
  addLabel: string;
  /** Préfixe d'ids pour éviter les collisions si deux listes coexistent. */
  idPrefix?: string;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState(0);
  const [newAmountValid, setNewAmountValid] = useState(true);
  const [amountResetKey, setAmountResetKey] = useState(0);
  const newAmountValidRef = useRef(true);
  const newLabelRef = useRef<HTMLInputElement>(null);

  const setAmountValidity = (valid: boolean) => {
    // Le blur précède le submit au clic : garder aussi une valeur synchrone.
    newAmountValidRef.current = valid;
    setNewAmountValid(valid);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const label = newLabel.trim();
    if (label === '' || !newAmountValidRef.current) {
      return;
    }
    onAdd(label, newAmount);
    // Déclencher le blur avant la remise à zéro : il peut encore valider
    // une notation équivalente (par exemple « 12.34 » au lieu de « 12,34 »).
    newLabelRef.current?.focus();
    setNewLabel('');
    setNewAmount(0);
    setAmountValidity(true);
    // Réinitialise aussi le brouillon après un ajout via Entrée, sans blur.
    setAmountResetKey((key) => key + 1);
  };

  return (
    <>
      <ul className="expense-list">
        {items.length === 0 && <li className="expense-list__empty">Aucune dépense.</li>}
        {items.map((expense) => (
          <li key={expense.id} className="expense-row">
            <input
              className="expense-row__label"
              type="text"
              value={expense.label}
              onChange={(event) => onRename(expense.id, event.target.value)}
              aria-label="Nom de la dépense"
            />
            <AmountInput
              id={`${idPrefix}-amount-${expense.id}`}
              label={`Montant de la dépense ${expense.label}`}
              labelVisible={false}
              valueCents={expense.amountCents}
              onCommit={(cents) => onAmount(expense.id, cents)}
              className="expense-row__amount"
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Retirer la dépense ${expense.label}`}
              onClick={() => onRemove(expense.id)}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M5 7h14" />
                <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
                <path d="M7 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h5.2a1.5 1.5 0 0 0 1.5-1.4L17 7" />
                <path d="M10.2 11v5.5M13.8 11v5.5" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <form className="expense-add" onSubmit={handleSubmit}>
        <input
          ref={newLabelRef}
          className="expense-add__label"
          type="text"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder={addLabel}
          aria-label={addLabel}
        />
        <AmountInput
          key={amountResetKey}
          id={`${idPrefix}-add-amount`}
          label="Montant de la nouvelle dépense"
          labelVisible={false}
          valueCents={newAmount}
          onCommit={setNewAmount}
          onValidityChange={setAmountValidity}
          className="expense-add__amount"
        />
        <button
          type="submit"
          className="btn btn--primary expense-add__submit"
          disabled={newLabel.trim() === '' || !newAmountValid}
        >
          Ajouter
        </button>
      </form>
    </>
  );
}
