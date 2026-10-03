/**
 * Budget — « le Foyer ». Règle d'or : lisible en 2 secondes, rien ne bouge.
 * Premier écran (390 × 844) : mois, salaires des deux, à verser (AL, AC,
 * ensemble), dépenses, reste. Tous les chiffres viennent de @a2/core
 * (computeMonthSummary, computeContributionBreakdown) : aucun calcul ici.
 */
import { computeContributionBreakdown, currentMonthKey, monthKeyToLabel, type MonthRecord } from '@a2/core';
import { ShellNotices } from '../../app/ShellNotices';
import { useApp } from '../../state/store';
import { AmountInput, Companion, Disclosure, IconButton, cx, euro, euroMinus, euroShort, percent, shiftMonthKey } from '../../ui';
import { ExpenseList } from './ExpenseList';
import './budget.css';

function PersonCard({ person, month, contributionCents }: { person: 'A' | 'B'; month: MonthRecord; contributionCents: number }) {
  const { setSalary } = useApp();
  const who = person === 'A' ? 'a' : 'b';
  const settings = person === 'A' ? month.personA : month.personB;
  const salary = person === 'A' ? month.salaryACents : month.salaryBCents;
  return (
    <article className={cx('person-card', `person-card--${who}`)} aria-label={`${settings.name}`}>
      <header className="person-card__head">
        <Companion who={who} size={34} />
        <h3 className="person-card__name">{settings.name}</h3>
      </header>
      <AmountInput
        id={`salary-${who}`}
        label={`Salaire de ${settings.name}`}
        labelVisible={false}
        appearance="large"
        valueCents={salary}
        onCommit={(cents) => setSalary(month.monthKey, person, cents)}
        className="person-card__salary"
      />
      <p className="person-card__caption" aria-hidden="true">
        Salaire du mois
      </p>
      <div className="person-card__gives">
        <span className="person-card__gives-label">verse</span>
        <strong className="amount person-card__contribution" data-testid={`contribution-${who}`}>
          {euro(contributionCents)}
        </strong>
      </div>
    </article>
  );
}

function BreakdownLine({ name, salary, settings }: { name: string; salary: number; settings: MonthRecord['personA'] }) {
  const b = computeContributionBreakdown(salary, settings);
  return (
    <p className="breakdown__line">
      <span className="breakdown__who">{name}&nbsp;:</span>{' '}
      <span className="num">
        {percent(settings.baseRateBps)} × {euroShort(b.baseIncomeCents)}
        {b.variableIncomeCents > 0 && (
          <>
            {' '}
            + {percent(settings.variableRateBps)} × {euroShort(b.variableIncomeCents)}
          </>
        )}
      </span>{' '}
      <span className="breakdown__eq">= {euroShort(b.contributionCents)}</span>
    </p>
  );
}

export function BudgetScreen() {
  const { currentMonth, currentSummary, selectMonth, selectCurrentMonth, setReserve, today } = useApp();

  if (currentMonth === null || currentSummary === null) {
    return (
      <>
        <div className="world-window world-window--banner" />
        <section className="screen-sheet" aria-busy="true" aria-labelledby="budget-title">
          <h1 id="budget-title" tabIndex={-1} className="visually-hidden">
            Budget
          </h1>
        </section>
      </>
    );
  }

  const key = currentMonth.monthKey;
  const isCurrent = key === currentMonthKey(today);
  const s = currentSummary;
  const deficit = s.remainingCents < 0;
  const reserve = currentMonth.reserveTargetCents;

  return (
    <>
      <div className="world-window world-window--banner budget-banner">
        <div className="month-bar">
          <div className="month-bar__titles">
            <p className="eyebrow month-bar__eyebrow">Le foyer</p>
            <h1 id="budget-title" tabIndex={-1} className="month-bar__label display">
              <span className="visually-hidden">Budget, </span>
              {monthKeyToLabel(key)}
            </h1>
          </div>
          <div className="month-bar__nav">
            <IconButton icon="chevron-left" label="Mois précédent" variant="glass" onClick={() => selectMonth(shiftMonthKey(key, -1))} />
            <IconButton icon="chevron-right" label="Mois suivant" variant="glass" onClick={() => selectMonth(shiftMonthKey(key, 1))} />
          </div>
        </div>
        {!isCurrent && (
          <button type="button" className="chip chip--glass month-bar__today" onClick={selectCurrentMonth}>
            Revenir au mois courant
          </button>
        )}
      </div>

      <section className="screen-sheet budget" aria-labelledby="budget-title">
        <ShellNotices />

        <div className="sheet-section">
          <div className="section-head">
            <h2 className="section-title">À verser ce mois</h2>
          </div>
          <div className="person-grid">
            <PersonCard person="A" month={currentMonth} contributionCents={s.contributionACents} />
            <PersonCard person="B" month={currentMonth} contributionCents={s.contributionBCents} />
          </div>

          <div className={cx('ledger', deficit && 'ledger--deficit')} aria-label="Équilibre du mois">
            <div className="ledger__row ledger__row--total">
              <span className="ledger__label">À verser ensemble</span>
              <strong className="amount ledger__value" data-testid="household-total">
                {euro(s.householdContributionCents)}
              </strong>
            </div>
            <div className="ledger__row">
              <span className="ledger__label">Dépenses communes</span>
              <span className="amount ledger__value ledger__value--minus" data-testid="expenses-total">
                {euroMinus(s.expensesTotalCents)}
              </span>
            </div>
            <div className="ledger__rule" aria-hidden="true" />
            <div className="ledger__row ledger__row--rest">
              <span className="ledger__label">{deficit ? 'Déficit' : 'Reste'}</span>
              <strong className="amount ledger__value ledger__rest" data-testid="remaining">
                {deficit ? euroMinus(-s.remainingCents) : euro(s.remainingCents)}
              </strong>
            </div>
            {deficit && (
              <p className="ledger__note" role="note">
                Les dépenses dépassent ce que vous versez ensemble. Ajustez un salaire, un taux ou une dépense.
              </p>
            )}
          </div>

          <Disclosure summary="Détail du calcul" className="breakdown">
            <div className="breakdown__body">
              <BreakdownLine name={currentMonth.personA.name} salary={currentMonth.salaryACents} settings={currentMonth.personA} />
              <BreakdownLine name={currentMonth.personB.name} salary={currentMonth.salaryBCents} settings={currentMonth.personB} />
              <p className="breakdown__help">
                Jusqu’au salaire de base, chacun verse son taux de base&#8239;; au-delà, le taux variable. Les taux se règlent dans
                les Réglages.
              </p>
            </div>
          </Disclosure>
        </div>

        {reserve > 0 && (
          <div className="sheet-section">
            <div className="section-head">
              <h2 className="section-title">Réserve</h2>
            </div>
            <div className="card reserve">
              <AmountInput
                id={`reserve-${key}`}
                label="Réserve visée ce mois"
                appearance="field"
                valueCents={reserve}
                onCommit={(cents) => setReserve(key, cents)}
              />
              <p className={cx('reserve__status', !s.reserveCovered && 'is-short')}>
                {s.reserveCovered ? (
                  <>
                    Réserve couverte · loisirs <strong className="amount">{euro(s.leisureCents)}</strong>
                  </>
                ) : (
                  <>
                    Il manque <strong className="amount">{euro(s.reserveShortfallCents)}</strong> pour la réserve
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <ExpenseList month={currentMonth} totalCents={s.expensesTotalCents} />
      </section>
    </>
  );
}
