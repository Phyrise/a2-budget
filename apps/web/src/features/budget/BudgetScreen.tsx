/**
 * Budget — « le Foyer ». Règle d'or : lisible en 2 secondes, rien ne bouge.
 * Premier écran (390 × 844) : mois, salaires des deux, à verser (AL, AC,
 * ensemble), dépenses, reste. Tous les chiffres viennent de @a2/core
 * (computeMonthSummary, computeContributionBreakdown) : aucun calcul ici.
 */
import { currentMonthKey, hasSharedRates, monthKeyToLabel, sharedRates } from '@a2/core';
import { ShellNotices } from '../../app/ShellNotices';
import { useApp } from '../../state/store';
import { AmountInput, Button, Disclosure, Icon, IconButton, cx, euro, euroMinus, percent, shiftMonthKey } from '../../ui';
import { ExpenseList } from './ExpenseList';
import { BreakdownLine, PersonCard } from './PersonCard';
import './budget.css';

export function BudgetScreen() {
  const { state, currentMonth, currentSummary, selectMonth, selectCurrentMonth, setReserve, setMonthSharedRates, today } = useApp();

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
  const label = monthKeyToLabel(key);
  const split = label.lastIndexOf(' ');
  const monthName = split > 0 ? label.slice(0, split) : label;
  const year = split > 0 ? label.slice(split + 1) : '';
  // Taux du mois ≠ taux communs des réglages : proposé, jamais imposé.
  const common = state ? sharedRates(state.settings) : null;
  const monthRates = sharedRates(currentMonth);
  const ratesDiffer =
    common !== null &&
    (!hasSharedRates(currentMonth) ||
      monthRates.baseRateBps !== common.baseRateBps ||
      monthRates.variableRateBps !== common.variableRateBps);

  return (
    <>
      <div className="world-window world-window--banner budget-banner">
        <div className="month-bar">
          <div className="month-bar__titles">
            {isCurrent ? (
              <p className="eyebrow month-bar__eyebrow">Le foyer</p>
            ) : (
              <button type="button" className="chip chip--glass month-bar__today" onClick={selectCurrentMonth}>
                <Icon name="undo" size={15} strokeWidth={1.9} />
                Revenir au mois courant
              </button>
            )}
            <h1 id="budget-title" tabIndex={-1} className="month-bar__label display">
              <span className="visually-hidden">Budget, </span>
              <span className="month-bar__month">{monthName}</span>
              {year && (
                <>
                  {' '}
                  <span className="month-bar__year">{year}</span>
                </>
              )}
            </h1>
          </div>
          <div className="month-bar__nav">
            <IconButton icon="chevron-left" label="Mois précédent" variant="glass" onClick={() => selectMonth(shiftMonthKey(key, -1))} />
            <IconButton icon="chevron-right" label="Mois suivant" variant="glass" onClick={() => selectMonth(shiftMonthKey(key, 1))} />
          </div>
        </div>
      </div>

      <section className="screen-sheet budget" aria-labelledby="budget-title">
        <ShellNotices />

        <div className="sheet-section">
          <div className="section-head">
            <h2 className="section-title">À verser ce mois</h2>
          </div>
          <div className="person-grid">
            <PersonCard key={`${key}-a`} person="A" month={currentMonth} contributionCents={s.contributionACents} />
            <PersonCard key={`${key}-b`} person="B" month={currentMonth} contributionCents={s.contributionBCents} />
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
              <BreakdownLine name={currentMonth.personA.name} breakdown={s.breakdownA} settings={currentMonth.personA} />
              <BreakdownLine name={currentMonth.personB.name} breakdown={s.breakdownB} settings={currentMonth.personB} />
              <p className="breakdown__help">
                Le salaire compte au taux de base, les compléments (heures sup, astreintes, gardes, souvent payés le mois
                suivant) au taux au-delà. Les taux sont communs à vous deux et se règlent dans les Réglages.
              </p>
              {ratesDiffer && common !== null && (
                <div className="breakdown__rates">
                  <p className="breakdown__help">
                    Ce mois garde ses taux d’origine. Les taux communs actuels sont {percent(common.baseRateBps)} et{' '}
                    {percent(common.variableRateBps)}.
                  </p>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="check"
                    onClick={() => setMonthSharedRates(key, common.baseRateBps, common.variableRateBps)}
                  >
                    Appliquer les taux communs à ce mois
                  </Button>
                </div>
              )}
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
