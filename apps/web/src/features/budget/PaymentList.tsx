/**
 * « À payer ce mois » (V4) : une case pour le virement d'AL, celui d'AC et
 * chaque dépense. Les cases repartent de zéro chaque mois (core). Cocher =
 * petite animation et le Sans-Visage mange les pépites (useFeeding) ;
 * décocher reste possible, sans bruit. Progression discrète « 3 sur 8 ».
 *
 * Lecture : `isTransferPaid` / `isExpensePaid` (@a2/core) ; écriture :
 * `setTransferPaid` / `setExpensePaid` (store). Montants : `formatEuros`.
 */
import type { MonthRecord } from '@a2/core';
import { formatEuros, isExpensePaid, isTransferPaid } from '@a2/core';
import { useApp } from '../../state/store';
import { Checkbox, NBSP, cx, type CheckTone } from '../../ui';
import { Konpeito } from './chihiro/Susuwatari';
import type { Feeding } from './chihiro/feeding';
import './payments.css';

interface PayItem {
  key: string;
  kind: 'transfer' | 'expense';
  label: string;
  /** Nom accessible de la case. */
  checkLabel: string;
  cents: number;
  paid: boolean;
  tone: CheckTone;
  toggle: (paid: boolean) => boolean;
}

export function PaymentList({
  month,
  transferACents,
  transferBCents,
  feed,
}: {
  month: MonthRecord;
  /** Virements arrondis ensemble (roundEurosConsistent) : A + B = total affiché. */
  transferACents: number;
  transferBCents: number;
  feed: Feeding['feed'];
}) {
  const { setTransferPaid, setExpensePaid } = useApp();
  const key = month.monthKey;
  const nameA = month.personA.name;
  const nameB = month.personB.name;

  const items: PayItem[] = [
    {
      key: 'transfer-a',
      kind: 'transfer',
      label: `Virement d’${nameA}`,
      checkLabel: `Virement d’${nameA} fait`,
      cents: transferACents,
      paid: isTransferPaid(month, 'A'),
      tone: 'a',
      toggle: (paid) => setTransferPaid(key, 'A', paid),
    },
    {
      key: 'transfer-b',
      kind: 'transfer',
      label: `Virement d’${nameB}`,
      checkLabel: `Virement d’${nameB} fait`,
      cents: transferBCents,
      paid: isTransferPaid(month, 'B'),
      tone: 'b',
      toggle: (paid) => setTransferPaid(key, 'B', paid),
    },
    // Une dépense à 0 € n'a rien à payer (sauf si elle a déjà été cochée).
    ...month.expenses
      .filter((e) => e.amountCents > 0 || isExpensePaid(month, e.id))
      .map(
        (e): PayItem => ({
          key: `expense-${e.id}`,
          kind: 'expense',
          label: e.label,
          checkLabel: `${e.label} payé`,
          cents: e.amountCents,
          paid: isExpensePaid(month, e.id),
          tone: 'neutral',
          toggle: (paid) => setExpensePaid(key, e.id, paid),
        }),
      ),
  ];

  const total = items.length;
  const done = items.filter((i) => i.paid).length;
  const allDone = total > 0 && done === total;

  const onToggle = (item: PayItem, origin: { x: number; y: number }) => {
    const next = !item.paid;
    if (!item.toggle(next) || !next) return;
    feed(origin, { count: item.kind === 'transfer' ? 5 : 3, allPaid: done + 1 === total });
  };

  return (
    <div className="sheet-section payments" data-testid="payments">
      <div className="section-head">
        <h2 className="section-title">À payer ce mois</h2>
        <span className={cx('payments__progress', allDone && 'is-done')} data-testid="payments-progress" aria-live="polite">
          {allDone ? 'Tout est payé' : `${done}${NBSP}sur${NBSP}${total} payés`}
        </span>
      </div>
      <div className="payments__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${total === 0 ? 0 : done / total})` }} />
      </div>
      <ul className="pay-list">
        {items.map((item, index) => (
          <li
            key={item.key}
            className={cx('pay-row', `pay-row--${item.kind}`, item.paid && 'is-paid', index === 1 && 'is-last-transfer')}
            data-testid={`pay-${item.key}`}
          >
            <Checkbox
              checked={item.paid}
              label={item.checkLabel}
              tone={item.tone}
              size="sm"
              onToggle={(origin) => onToggle(item, origin)}
            />
            {item.kind === 'expense' ? <Konpeito label={item.label} /> : <span className="pay-row__dot" aria-hidden="true" />}
            <span className="pay-row__label">{item.label}</span>
            <span className="pay-row__amount amount">{formatEuros(item.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
