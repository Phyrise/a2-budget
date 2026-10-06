/**
 * Budget — « le Foyer ». Règle d'or : lisible en 2 secondes.
 * Premier écran (390 × 844) : mois, à verser (AL, AC, ensemble, dépenses),
 * puis « Sur le compte commun » (solde estimé en ce moment, fin du mois,
 * recaler). Plus bas : « À payer ce mois » (cases du mois, le Sans-Visage
 * mange l'argent), revenus au curseur, dépenses en − / +.
 * V4 : euros entiers partout ; tous les chiffres viennent de @a2/core
 * (computeMonthSummary, currentBalanceEstimate, endOfMonthProjection…).
 */
import type { MonthRecord, MonthSummary } from '@a2/core';
import {
  currentBalanceEstimate,
  currentMonthKey,
  endOfMonthProjection,
  hasSharedRates,
  monthKeyToLabel,
  roundEurosConsistent,
  sharedRates,
} from '@a2/core';
import { useRef, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useApp } from '../../state/store';
import { AmountInput, Button, Disclosure, Icon, IconButton, cx, euro, percent, shiftMonthKey, useToast } from '../../ui';
import { BalanceCard } from './BalanceCard';
import { useFeeding } from './chihiro/feeding';
import { noFaceMood } from './chihiro/mood';
import { NoFaceVisitor } from './chihiro/NoFaceVisitor';
import { SusuwatariRunner } from './chihiro/Susuwatari';
import { useMonthEdits } from './chihiro/useMonthEdits';
import { ExpenseList } from './ExpenseList';
import { GiveCard } from './Ledger';
import { PaymentList, paymentProgress } from './PaymentList';
import { BreakdownLine, PersonCard } from './PersonCard';
import { RecalibrateSheet } from './RecalibrateSheet';
import './budget.css';
import './balance.css';
import './chihiro/chihiro.css';
import './chihiro/eating.css';

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
  const { state, appState, selectMonth, selectCurrentMonth, setReserve, setMonthSharedRates, restoreMonthRates, today } = useApp();
  const toast = useToast();
  const sheetRef = useRef<HTMLElement>(null);
  const { bowing, run, endRun } = useMonthEdits(currentMonth);
  const feeding = useFeeding();
  const [recalibrating, setRecalibrating] = useState(false);

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

  // Compte commun : estimation en ce moment, projection de fin de mois (core).
  const budget = appState?.budget;
  const nowCents = budget ? currentBalanceEstimate(budget, key) : 0;
  const projectionCents = budget ? endOfMonthProjection(budget, key) : 0;
  const corrections = budget?.balance?.corrections ?? [];
  const transfers = roundEurosConsistent(s.contributionACents, s.contributionBCents);
  const progress = paymentProgress(currentMonth);
  const paidShare = progress.total === 0 ? 0 : progress.done / progress.total;
  const greeting = bowing || feeding.bowing;

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

        <div className="sheet-section budget-top">
          <h2 className="visually-hidden">À verser ce mois</h2>
          <GiveCard month={currentMonth} summary={s} />
          <BalanceCard
            summary={s}
            reserveTargetCents={reserve}
            nowCents={nowCents}
            projectionCents={projectionCents}
            paidShare={paidShare}
            bowing={greeting}
            eating={feeding.eating && feeding.visit === null}
            noFaceRef={feeding.noFaceRef}
            onRecalibrate={() => setRecalibrating(true)}
          />
        </div>

        <PaymentList month={currentMonth} transferACents={transfers.aCents} transferBCents={transfers.bCents} feed={feeding.feed} />

        <div className="sheet-section">
          <div className="section-head">
            <h2 className="section-title">Revenus du mois</h2>
          </div>
          <div className="income-grid">
            <PersonCard key={`${key}-a`} person="A" month={currentMonth} />
            <PersonCard key={`${key}-b`} person="B" month={currentMonth} />
          </div>

          <Disclosure summary="Détail du calcul" className="breakdown">
            <div className="breakdown__body">
              <BreakdownLine name={currentMonth.personA.name} breakdown={s.breakdownA} settings={currentMonth.personA} />
              <BreakdownLine name={currentMonth.personB.name} breakdown={s.breakdownB} settings={currentMonth.personB} />
              <p className="breakdown__help">
                Le salaire compte au taux de base, les compléments (heures sup, astreintes, gardes, souvent payés le mois
                suivant) au taux au-delà. Chaque mois, ce que vous versez moins les dépenses s’ajoute au compte commun.{' '}
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
                  <Button variant="quiet" size="sm" icon="check" onClick={applyCommonRates}>
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
        <NoFaceVisitor
          visit={feeding.visit}
          mouthRef={feeding.visitorRef}
          mood={noFaceMood(s, reserve, projectionCents)}
          eating={feeding.eating}
          bowing={feeding.bowing}
          fullness={paidShare}
        />
        <RecalibrateSheet
          open={recalibrating}
          onClose={() => setRecalibrating(false)}
          monthKey={key}
          nowCents={nowCents}
          corrections={corrections}
        />
      </section>
    </>
  );
}
