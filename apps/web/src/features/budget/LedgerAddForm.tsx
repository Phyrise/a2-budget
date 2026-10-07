/**
 * Ajout d'une dépense dans « Ce mois-ci » : libellé (champ texte, le seul
 * endroit où le clavier du téléphone sert) + montant au pavé (AmountPad).
 * Entrée dans le libellé ouvre le pavé ; libellé vide refusé ; 0 € accepté.
 */
import { useRef, useState } from 'react';
import { AmountField, Button, TextField, type AmountFieldHandle } from '../../ui';

export function LedgerAddForm({
  idPrefix,
  monthLabel,
  onAdd,
  onClose,
}: {
  idPrefix: string;
  monthLabel: string;
  onAdd: (label: string, cents: number) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [cents, setCents] = useState(0);
  const labelRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<AmountFieldHandle>(null);
  const canAdd = label.trim() !== '';

  const submit = () => {
    if (!canAdd) return;
    onAdd(label.trim(), cents);
    setLabel('');
    setCents(0);
    labelRef.current?.focus();
  };

  return (
    <form
      className="paybook-add"
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
            amountRef.current?.open();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        className="paybook-add__label"
      />
      <AmountField
        ref={amountRef}
        id={`${idPrefix}-add-amount`}
        label="Montant"
        accessibleLabel={label.trim() === '' ? 'Montant de la nouvelle dépense' : `Montant de ${label.trim()}`}
        padDescription={monthLabel}
        valueCents={cents}
        onCommit={setCents}
        size="md"
        className="paybook-add__amount"
      />
      <div className="paybook-add__actions">
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        <Button type="submit" variant="primary" icon="plus" disabled={!canAdd} className="paybook-add__submit">
          Ajouter
        </Button>
      </div>
    </form>
  );
}
