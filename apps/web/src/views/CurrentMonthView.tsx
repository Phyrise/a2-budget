import { useEffect, useState } from 'react';
import {
  computeContributionBreakdown,
  currentMonthKey,
  formatCents,
  monthKeyToLabel,
  type PersonSettings,
} from '@a2/core';
import { useApp } from '../state/store';
import { AmountInput } from '../components/AmountInput';
import { ExpenseEditor } from '../components/ExpenseEditor';
import { LoadNotice } from '../components/LoadNotice';
import { PersonDot } from '../components/PersonDot';
import { ForestSpirit } from '../components/ForestSpirit';
import { formatRateBps } from '../components/format';
import '../styles/shared.css';
import '../styles/current-month.css';

const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/** « 2026-10 » → { year: 2026, month: 10 } (affichage des sélecteurs). */
function monthFromKey(key: string): { year: number; month: number } {
  const parts = key.split('-');
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

/** Ligne du détail du calcul : « B : 40 % × 3 000 € + 20 % × 675 € = 1 335 € ». */
function detailLine(person: PersonSettings, salaryCents: number): string {
  const breakdown = computeContributionBreakdown(salaryCents, person);
  return (
    `${person.name} : ${formatRateBps(person.baseRateBps)} % × ${formatCents(breakdown.baseIncomeCents)}` +
    ` + ${formatRateBps(person.variableRateBps)} % × ${formatCents(breakdown.variableIncomeCents)}` +
    ` = ${formatCents(breakdown.contributionCents)}`
  );
}

export function CurrentMonthView() {
  const {
    state,
    currentMonth,
    currentSummary,
    selectMonth,
    selectCurrentMonth,
    setSalary,
    setReserve,
    setExpenseAmount,
    renameExpense,
    addExpense,
    removeExpense,
  } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);

  // État chargé sans mois existant (premier lancement) : le store garantit
  // que le mois sélectionné est présent une fois chargé ; on le crée ici
  // (mois courant, fuseau local) pour que la vue soit immédiatement
  // utilisable. ensureMonth est idempotent (StrictMode compris).
  useEffect(() => {
    if (state !== null && currentMonth === null) {
      selectCurrentMonth();
    }
  }, [state, currentMonth, selectCurrentMonth]);

  if (state === null || currentMonth === null || currentSummary === null) {
    return (
      <section className="view" aria-label="Ce mois">
        <h1 className="view-title" tabIndex={-1}>Ce mois</h1>
        <p className="view-loading">Chargement…</p>
      </section>
    );
  }

  const key = currentMonth.monthKey;
  const { year: selectedYear, month: selectedMonth } = monthFromKey(key);
  const thisYear = new Date().getFullYear();
  const isCurrentMonth = key === currentMonthKey();
  const minYear = Math.min(thisYear - 5, selectedYear);
  const maxYear = Math.max(thisYear + 1, selectedYear);
  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(year);
  }

  const changeMonth = (year: number, month: number) => {
    selectMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const personA = currentMonth.personA;
  const personB = currentMonth.personB;
  const summary = currentSummary;

  return (
    <section className="view" aria-label="Ce mois">
      <LoadNotice />

      <header className="page-header cm-header">
        <div className="app-brand"><span className="app-brand__mark">A²</span><span>Notre petit budget</span></div>
        <p className="page-eyebrow">Un rituel à deux</p>
        <h1 className="cm-title" tabIndex={-1}>{monthKeyToLabel(key)}</h1>
        <ForestSpirit className="header-spirit" />
        <div className="cm-picker" role="group" aria-label="Changer de mois">
          <label className="visually-hidden" htmlFor="cm-month">
            Mois
          </label>
          <select
            id="cm-month"
            className="cm-picker__select cm-picker__select--month"
            value={selectedMonth}
            onChange={(event) => changeMonth(selectedYear, Number(event.target.value))}
          >
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="cm-year">
            Année
          </label>
          <select
            id="cm-year"
            className="cm-picker__select cm-picker__select--year"
            value={selectedYear}
            onChange={(event) => changeMonth(Number(event.target.value), selectedMonth)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        {!isCurrentMonth && (
          <button type="button" className="btn btn--ghost cm-back" onClick={selectCurrentMonth}>
            Revenir au mois courant
          </button>
        )}
      </header>

      <section className="card cm-salaries" aria-label="Salaires du mois">
        <h2 className="card-title">Nos revenus</h2>
        <p className="card-hint">Prévisions à ajuster pour ce mois.</p>
        <div className="salary-row">
          <PersonDot name={personA.name} tone="a" />
          <label className="salary-row__name" htmlFor="salary-a">
            {personA.name}
          </label>
          <AmountInput
            id="salary-a"
            label={`Salaire de ${personA.name}`}
            labelVisible={false}
            valueCents={currentMonth.salaryACents}
            onCommit={(cents) => setSalary(key, 'A', cents)}
            className="salary-row__amount"
          />
        </div>
        <div className="salary-row">
          <PersonDot name={personB.name} tone="b" />
          <label className="salary-row__name" htmlFor="salary-b">
            {personB.name}
          </label>
          <AmountInput
            id="salary-b"
            label={`Salaire de ${personB.name}`}
            labelVisible={false}
            valueCents={currentMonth.salaryBCents}
            onCommit={(cents) => setSalary(key, 'B', cents)}
            className="salary-row__amount"
          />
        </div>
      </section>

      <section className="card-primary cm-main" aria-label="À verser sur le compte commun">
        <h2 className="cm-main__title">Pour notre compte commun</h2>
        <dl className="cm-main__rows">
          <div className="cm-main__row">
            <dt className="cm-main__who">
              <PersonDot name={personA.name} tone="a" />
              <span>{personA.name}</span>
            </dt>
            <dd className="cm-main__value amount">{formatCents(summary.contributionACents)}</dd>
          </div>
          <div className="cm-main__row">
            <dt className="cm-main__who">
              <PersonDot name={personB.name} tone="b" />
              <span>{personB.name}</span>
            </dt>
            <dd className="cm-main__value amount">{formatCents(summary.contributionBCents)}</dd>
          </div>
        </dl>
        <div className="cm-main__total">
          <span className="cm-main__total-label">À verser au total</span>
          <span key={summary.householdContributionCents} className="cm-main__total-value amount">
            {formatCents(summary.householdContributionCents)}
          </span>
        </div>
      </section>

      <section className="balance-preview" aria-label="Aperçu du mois">
        <div><span>Dépenses prévues</span><strong className="amount">{formatCents(summary.expensesTotalCents)}</strong></div>
        <div><span>Reste prévu</span><strong className={`amount ${summary.remainingCents < 0 ? 'is-deficit' : ''}`}>{formatCents(summary.remainingCents)}</strong></div>
        <ForestSpirit className="balance-spirit" />
      </section>
      {summary.remainingCents < 0 && <p className="rest-note rest-note--danger">Les dépenses prévues dépassent les contributions du mois.</p>}

      <div className="cm-detail">
        <button
          type="button"
          className="cm-detail__toggle"
          aria-expanded={detailOpen}
          aria-controls="cm-detail-body"
          onClick={() => setDetailOpen((open) => !open)}
        >
          <svg
            className={detailOpen ? 'cm-detail__chevron is-open' : 'cm-detail__chevron'}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 9.5l6 6 6-6" />
          </svg>
          Détail du calcul
        </button>
        {detailOpen && (
          <div id="cm-detail-body" className="cm-detail__body">
            <p className="cm-detail__line amount">{detailLine(personA, currentMonth.salaryACents)}</p>
            <p className="cm-detail__line amount">{detailLine(personB, currentMonth.salaryBCents)}</p>
          </div>
        )}
      </div>

      <section className="card expense-card" aria-label="Dépenses du mois">
        <div className="card-head">
          <h2 className="card-title">La vie à deux</h2>
          <span className="card-head__value amount">{formatCents(summary.expensesTotalCents)}</span>
        </div>
        <ExpenseEditor
          idPrefix={`m-${key}`}
          items={currentMonth.expenses}
          onRename={(id, label) => renameExpense(key, id, label)}
          onAmount={(id, cents) => setExpenseAmount(key, id, cents)}
          onRemove={(id) => removeExpense(key, id)}
          onAdd={(label, cents) => addExpense(key, label, cents)}
          addLabel="Nouvelle dépense"
        />
      </section>

      <section className="card" aria-label="Reste après dépenses">
        <h2 className="card-title">Une petite réserve</h2>
        <p className="card-hint">Ce que l’on souhaite mettre de côté ce mois.</p>
        <div className="rest-reserve">
          <AmountInput
            id="cm-reserve"
            label="Réserve à mettre de côté ce mois"
            valueCents={currentMonth.reserveTargetCents}
            onCommit={(cents) => setReserve(key, cents)}
          />
        </div>
        {currentMonth.reserveTargetCents > 0 && (
          <div className="rest-leisure">
            <div className="rest-row">
              <span className="rest-row__label">Disponible pour les loisirs</span>
              <span className="rest-row__value amount">{formatCents(summary.leisureCents)}</span>
            </div>
            {!summary.reserveCovered && (
              <p className="rest-note rest-note--danger">
                Réserve non couverte : {formatCents(summary.reserveShortfallCents)} manquants.
              </p>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
