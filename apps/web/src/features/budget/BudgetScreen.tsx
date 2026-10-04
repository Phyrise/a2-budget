/**
 * Budget — « le Foyer ». Règle d'or : lisible en 2 secondes, rien ne bouge.
 * Premier écran (390 × 844) : mois, salaires des deux (+ compléments
 * repliables : heures sup, astreintes, gardes), à verser (AL, AC, ensemble),
 * dépenses, reste. Tous les chiffres viennent de @a2/core
 * (computeMonthSummary et son détail breakdownA/B) : aucun calcul ici.
 */
import type { MonthRecord, MonthSummary } from '@a2/core';
import { currentMonthKey, hasSharedRates, monthKeyToLabel, sharedRates } from '@a2/core';
import { useRef } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useApp } from '../../state/store';
import { AmountInput, Button, Disclosure, Icon, IconButton, cx, euro, percent, shiftMonthKey, useToast } from '../../ui';
import { SusuwatariRunner } from './chihiro/Susuwatari';
import { useMonthEdits } from './chihiro/useMonthEdits';
import { ExpenseList } from './ExpenseList';
import { Ledger } from './Ledger';
import { BreakdownLine, PersonCard } from './PersonCard';
import './budget.css';
import './chihiro/chihiro.css';

export function BudgetScreen() {
  const { currentMonth, currentSummary } = useApp();

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

  return <BudgetMonth currentMonth={currentMonth} s={currentSummary} />;
}

function BudgetMonth({ currentMonth, s }: { currentMonth: MonthRecord; s: MonthSummary }) {
  const { state, selectMonth, selectCurrentMonth, setReserve, setMonthSharedRates, restoreMonthRates, today } = useApp();
  const toast = useToast();
  const sheetRef = useRef<HTMLElement>(null);
  const { bowing, run, endRun } = useMonthEdits(currentMonth);

  const key = currentMonth.monthKey;
  const isCurrent = key === currentMonthKey(today);
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
  const monthShared = hasSharedRates(currentMonth);

  /** Action explicite, réversible : toast « Annuler » qui remet les taux d'avant. */
  const applyCommonRates = () => {
    if (common === null) return;
    const { personA: a, personB: b } = currentMonth;
    const previous = {
      a: { baseRateBps: a.baseRateBps, variableRateBps: a.variableRateBps },
      b: { baseRateBps: b.baseRateBps, variableRateBps: b.variableRateBps },
    };
    setMonthSharedRates(key, common.baseRateBps, common.variableRateBps);
    toast.show({
      message: `Taux communs appliqués à ${label}`,
      icon: 'check',
      action: { label: 'Annuler', onClick: () => restoreMonthRates(key, previous) },
    });
  };

  return (
    <>
      <div className="world-window world-window--banner budget-banner">
        <div className="month-bar">
          <div className="month-bar__titles">
            {isCurrent ? (
              <p className="eyebrow month-bar__eyebrow">
                <span className="month-bar__lantern" aria-hidden="true" />
                La maison de bains
              </p>
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

      <section ref={sheetRef} className="screen-sheet budget" aria-labelledby="budget-title">
        <ShellNotices />

        <div className="sheet-section">
          <div className="section-head">
            <h2 className="section-title">À verser ce mois</h2>
          </div>
          <div className="person-grid">
            <PersonCard key={`${key}-a`} person="A" month={currentMonth} contributionCents={s.contributionACents} />
            <PersonCard key={`${key}-b`} person="B" month={currentMonth} contributionCents={s.contributionBCents} />
          </div>

          <Ledger summary={s} reserveTargetCents={reserve} bowing={bowing} />

          <Disclosure summary="Détail du calcul" className="breakdown">
            <div className="breakdown__body">
              <BreakdownLine name={currentMonth.personA.name} breakdown={s.breakdownA} settings={currentMonth.personA} />
              <BreakdownLine name={currentMonth.personB.name} breakdown={s.breakdownB} settings={currentMonth.personB} />
              <p className="breakdown__help">
                Le salaire compte au taux de base, les compléments (heures sup, astreintes, gardes, souvent payés le mois
                suivant) au taux au-delà.{' '}
                {monthShared
                  ? 'Les taux sont communs à vous deux et se règlent dans les Réglages.'
                  : 'Ce mois garde des taux différents pour chacun, comme au moment où il a été créé.'}
              </p>
              {ratesDiffer && common !== null && (
                <div className="breakdown__rates">
                  <p className="breakdown__help">
                    {monthShared ? 'Ce mois garde ses taux d’origine. ' : ''}Les taux communs actuels sont {percent(common.baseRateBps)} et{' '}
                    {percent(common.variableRateBps)}.
                  </p>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="check"
                    onClick={applyCommonRates}
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
        <SusuwatariRunner run={run} areaRef={sheetRef} onDone={endRun} />
      </section>
    </>
  );
}
