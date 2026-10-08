/**
 * Budget — « le Foyer ». Règle d'or : lisible en 2 secondes.
 * V4.2, d'un seul tenant : « Sur le compte commun » en haut (solde estimé en
 * ce moment, fin du mois, recaler discret), puis « Revenus du mois » (chaque
 * carte porte sa part à verser), puis UN bloc « Ce mois-ci » (virements et
 * dépenses à cocher, le Sans-Visage mange l'argent), et le détail du calcul
 * replié. Plus de réserve ni de taux propres à un mois : les taux sont
 * globaux (Réglages), appliqués au mois courant et aux suivants.
 * V4.1 : chaque montant s'affiche en grand ; un toucher ouvre le pavé
 * (AmountPad) — plus de curseur, faire défiler ne change rien.
 * Euros entiers partout ; tous les chiffres viennent de @a2/core
 * (computeMonthSummary, monthFlows, currentBalanceEstimate…).
 */
import type { MonthRecord, MonthSummary } from '@a2/core';
import {
  currentBalanceEstimate,
  currentMonthKey,
  endOfMonthProjection,
  monthFlows,
  monthKeyToLabel,
  openingBalance,
} from '@a2/core';
import { useRef, useState } from 'react';
import { ShellNotices } from '../../app/ShellNotices';
import { useApp } from '../../state/store';
import { Disclosure, Icon, IconButton, shiftMonthKey } from '../../ui';
import type { ShortcutSource } from './amountShortcuts';
import { BalanceCard } from './BalanceCard';
import { useFeeding } from './chihiro/feeding';
import { noFaceMood } from './chihiro/mood';
import { NoFaceVisitor } from './chihiro/NoFaceVisitor';
import { KonpeitoJar } from './chihiro/KonpeitoJar';
import { useSusuwatariRun } from './chihiro/Susuwatari';
import { SusuwatariGame } from './chihiro/SusuwatariGame';
import { useMonthEdits } from './chihiro/useMonthEdits';
import { MonthLedger } from './MonthLedger';
import { paymentProgress } from './paymentItems';
import { BreakdownLine, PersonCard } from './PersonCard';
import { RecalibrateSheet } from './RecalibrateSheet';
import { NO_RESERVE, withDisplayedMonth } from './balanceView';
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
  const { state, appState, selectMonth, selectCurrentMonth, today } = useApp();
  const sheetRef = useRef<HTMLElement>(null);
  const { bowing, run, endRun } = useMonthEdits(currentMonth);
  useSusuwatariRun(run, endRun);
  const feeding = useFeeding();
  const [recalibrating, setRecalibrating] = useState(false);

  const key = currentMonth.monthKey;
  const isCurrent = key === currentMonthKey(today);
  const label = monthKeyToLabel(key);
  const split = label.lastIndexOf(' ');
  const monthName = split > 0 ? label.slice(0, split) : label;
  const year = split > 0 ? label.slice(split + 1) : '';
  // Compte commun : estimation en ce moment, projection de fin de mois (core).
  // Le mois affiché peut être virtuel (seulement consulté) : il est ajouté
  // au calcul sans être écrit ; il ne compte pas dans sa propre ouverture.
  const budget = appState ? withDisplayedMonth(appState.budget, currentMonth) : undefined;
  const nowCents = budget ? currentBalanceEstimate(budget, key) : 0;
  const projectionCents = budget ? endOfMonthProjection(budget, key) : 0;
  const openingCents = budget ? openingBalance(budget, key) : 0;
  const corrections = budget?.balance?.corrections ?? [];
  const flows = monthFlows(currentMonth);
  const view = isCurrent ? 'now' : key < currentMonthKey(today) ? 'past' : 'future';
  const inlineLabel = label.charAt(0).toLowerCase() + label.slice(1);
  const progress = paymentProgress(currentMonth);
  const paidShare = progress.total === 0 ? 0 : progress.done / progress.total;
  const greeting = bowing || feeding.bowing;
  const source: ShortcutSource = { settings: state?.settings ?? null, months: state?.months ?? [] };

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
          <BalanceCard
            summary={s}
            view={view}
            monthLabel={inlineLabel}
            openingCents={openingCents}
            netCents={flows.netCents}
            nowCents={nowCents}
            projectionCents={projectionCents}
            paidShare={paidShare}
            bowing={greeting}
            eating={feeding.eating && feeding.visit === null}
            noFaceRef={feeding.noFaceRef}
            onRecalibrate={isCurrent ? () => setRecalibrating(true) : undefined}
          />
        </div>

        <div className="sheet-section budget-income">
          <div className="section-head">
            <h2 className="section-title">Revenus du mois</h2>
            <KonpeitoJar />
          </div>
          <div className="income-grid">
            <PersonCard key={`${key}-a`} person="A" month={currentMonth} source={source} giveCents={flows.transferACents} />
            <PersonCard key={`${key}-b`} person="B" month={currentMonth} source={source} giveCents={flows.transferBCents} />
          </div>
        </div>

        <MonthLedger month={currentMonth} flows={flows} feed={feeding.feed} source={source} />

        <div className="sheet-section budget-detail">
          <Disclosure summary="Détail du calcul" className="breakdown">
            <div className="breakdown__body">
              <BreakdownLine name={currentMonth.personA.name} breakdown={s.breakdownA} settings={currentMonth.personA} />
              <BreakdownLine name={currentMonth.personB.name} breakdown={s.breakdownB} settings={currentMonth.personB} />
              <p className="breakdown__help">
                Le salaire compte au taux de base, les compléments (heures sup, astreintes, gardes) au taux au-delà.
              </p>
            </div>
          </Disclosure>
        </div>
        <SusuwatariGame />
        <NoFaceVisitor
          visit={feeding.visit}
          mouthRef={feeding.visitorRef}
          mood={noFaceMood(s, NO_RESERVE, projectionCents)}
          eating={feeding.eating}
          bowing={feeding.bowing}
          fullness={paidShare}
        />
        {isCurrent && (
          <RecalibrateSheet
            open={recalibrating}
            onClose={() => setRecalibrating(false)}
            monthKey={key}
            nowCents={nowCents}
            corrections={corrections}
          />
        )}
      </section>
    </>
  );
}
