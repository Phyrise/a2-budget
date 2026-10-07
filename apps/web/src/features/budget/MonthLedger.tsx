/**
 * « Ce mois-ci » (V4.1) : UN seul bloc qui remplace « Dépenses communes » et
 * « À payer ce mois ». D'abord les deux virements (case « fait »), puis
 * chaque dépense sur une ligne : case « payé », libellé renommable, montant
 * (toucher → AmountPad), retirer (annulable). « Ajouter une dépense » en bas.
 * En-tête : total des dépenses et progression discrète « 3 sur 7 payés ».
 *
 * Cocher = le Sans-Visage mange les pépites (useFeeding, inchangé). Montants
 * des virements et des cases : `monthFlows` (@a2/core), les mêmes que ceux
 * qu'additionne le solde. Une dépense à 0 € n'a rien à payer : pas de case.
 */
import type { MonthFlows, MonthRecord } from '@a2/core';
import { formatEuros, isExpensePaid, isTransferPaid, monthKeyToLabel } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../state/store';
import { AmountField, Button, Checkbox, IconButton, InlineTextField, NBSP, cx, fr, useToast } from '../../ui';
import { expenseShortcuts, type ShortcutSource } from './amountShortcuts';
import { Konpeito, SusuwatariEmpty } from './chihiro/Susuwatari';
import type { Feeding } from './chihiro/feeding';
import { LedgerAddForm } from './LedgerAddForm';
import { paymentProgress } from './paymentItems';
import './ledger.css';

function of(name: string): string {
  return /^[aeiouyhâàéèêîïôûAEIOUYHÂÀÉÈÊÎÏÔÛ]/u.test(name) ? `d’${name}` : `de${NBSP}${name}`;
}

export function MonthLedger({
  month,
  flows,
  feed,
  source,
}: {
  month: MonthRecord;
  /** Montants affichés du mois (euros entiers, totaux cohérents). */
  flows: MonthFlows;
  feed: Feeding['feed'];
  source: ShortcutSource;
}) {
  const { setTransferPaid, setExpensePaid, renameExpense, setExpenseAmount, removeExpense, addExpense, restoreExpense } = useApp();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const key = month.monthKey;
  const monthLabel = monthKeyToLabel(key);
  const { done, total } = paymentProgress(month);
  const allDone = total > 0 && done === total;

  const toggle = (kind: 'transfer' | 'expense', write: (paid: boolean) => boolean, paid: boolean, origin: { x: number; y: number }) => {
    const next = !paid;
    if (!write(next) || !next) return;
    feed(origin, { count: kind === 'transfer' ? 5 : 3, allPaid: done + 1 === total });
  };

  const remove = (id: string) => {
    const index = month.expenses.findIndex((e) => e.id === id);
    const expense = month.expenses[index];
    if (!expense) return;
    // Annuler la remet à l'identique : même id, même place, cochée si elle l'était.
    const paid = isExpensePaid(month, id);
    removeExpense(key, id);
    toast.show({
      message: fr(`Dépense retirée : ${expense.label}`),
      icon: 'trash',
      action: { label: 'Annuler', onClick: () => restoreExpense(key, expense, index, paid) },
    });
  };

  const transfers = [
    { who: 'A' as const, tone: 'a' as const, name: month.personA.name, cents: flows.transferACents },
    { who: 'B' as const, tone: 'b' as const, name: month.personB.name, cents: flows.transferBCents },
  ];

  return (
    <div className="sheet-section ledger" data-testid="ledger">
      <div className="section-head ledger__head">
        <h2 className="section-title">Ce mois-ci</h2>
        <span className="ledger__total">
          Dépenses{' '}
          <strong className="amount" data-testid="ledger-expenses-total">
            {formatEuros(flows.expensesTotalCents)}
          </strong>
        </span>
      </div>
      <div className="ledger__progress">
        <div className="payments__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${total === 0 ? 0 : done / total})` }} />
        </div>
        <span className={cx('payments__progress', allDone && 'is-done')} data-testid="payments-progress" aria-live="polite">
          {allDone ? 'Tout est payé' : `${done}${NBSP}sur${NBSP}${total} payés`}
        </span>
      </div>

      <ul className="ledger-list" aria-label="Virements au compte commun">
        {transfers.map((t) => {
          const paid = isTransferPaid(month, t.who);
          return (
            <li
              key={t.who}
              className={cx('ledger-row', 'ledger-row--transfer', `ledger-row--${t.tone}`, paid && 'is-paid')}
              data-testid={`pay-transfer-${t.tone}`}
            >
              <Checkbox
                checked={paid}
                label={`Virement ${of(t.name)} fait`}
                tone={t.tone}
                size="sm"
                onToggle={(origin) => toggle('transfer', (p) => setTransferPaid(key, t.who, p), paid, origin)}
              />
              <span className="ledger-row__name">
                <span className="ledger-row__dot" aria-hidden="true" />
                <span className="ledger-row__label">Virement {of(t.name)}</span>
              </span>
              <span className="ledger-row__amount ledger-row__amount--static amount">{formatEuros(t.cents)}</span>
            </li>
          );
        })}
      </ul>

      {month.expenses.length === 0 ? (
        <SusuwatariEmpty title="Aucune dépense ce mois-ci">
          {fr('Les Noiraudes attendent leurs kompeitō : ajoutez le loyer, les courses, les abonnements…')}
        </SusuwatariEmpty>
      ) : (
        <ul className="ledger-list ledger-list--expenses" aria-label="Dépenses du mois">
          {month.expenses.map((e) => {
            const paid = isExpensePaid(month, e.id);
            // Une dépense à 0 € n'a rien à payer (sauf si elle a déjà été cochée).
            const payable = e.amountCents > 0 || paid;
            return (
              <li key={e.id} className={cx('ledger-row', 'ledger-row--expense', paid && 'is-paid')} data-testid={`pay-expense-${e.id}`}>
                {payable ? (
                  <Checkbox
                    checked={paid}
                    label={`${e.label} payé`}
                    size="sm"
                    onToggle={(origin) => toggle('expense', (p) => setExpensePaid(key, e.id, p), paid, origin)}
                  />
                ) : (
                  <span className="ledger-row__nocheck" aria-hidden="true" title="Rien à payer" />
                )}
                <span className="ledger-row__name">
                  <Konpeito label={e.label} />
                  <InlineTextField
                    id={`m-${key}-${e.id}-label`}
                    label={`Libellé de la dépense ${e.label}`}
                    value={e.label}
                    onCommit={(label) => renameExpense(key, e.id, label)}
                    className="ledger-row__field"
                  />
                </span>
                <AmountField
                  id={`m-${key}-${e.id}-amount`}
                  accessibleLabel={`Montant de ${e.label}`}
                  padDescription={monthLabel}
                  valueCents={flows.expenseCents[e.id] ?? e.amountCents}
                  onCommit={(cents) => setExpenseAmount(key, e.id, cents)}
                  shortcuts={expenseShortcuts(source, month, e.id)}
                  size="sm"
                  layout="bare"
                  className="ledger-row__amount"
                />
                <IconButton icon="close" label={`Retirer ${e.label}`} variant="ghost" className="ledger-row__remove" onClick={() => remove(e.id)} />
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <LedgerAddForm
          idPrefix={`m-${key}`}
          monthLabel={monthLabel}
          onAdd={(label, cents) => addExpense(key, label, cents)}
          onClose={() => setAdding(false)}
        />
      ) : (
        <Button variant="ghost" icon="plus" className="ledger__add" onClick={() => setAdding(true)}>
          Ajouter une dépense
        </Button>
      )}
    </div>
  );
}
