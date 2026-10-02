import {
  compareMonthKeys,
  computeMonthSummary,
  formatCents,
  monthKeyToLabel,
} from '@a2/core';
import { useState } from 'react';
import { useApp } from '../state/store';
import { LoadNotice } from '../components/LoadNotice';
import { ForestSpirit } from '../components/ForestSpirit';
import { requestViewChange } from '../components/navigation';
import '../styles/shared.css';
import '../styles/history.css';

/**
 * Historique : liste chronologique inverse des seuls mois existants.
 * Appui sur un mois → selectMonth + ouverture dans la vue « Ce mois »
 * (via l'événement de navigation, voir components/navigation.ts).
 */
export function HistoryView() {
  const { state, selectMonth, clearHistory } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);

  if (state === null) {
    return (
      <section className="view" aria-label="Historique">
        <h1 className="view-title" tabIndex={-1}>Historique</h1>
        <p className="view-loading">Chargement…</p>
      </section>
    );
  }

  const months = [...state.months].sort((a, b) => compareMonthKeys(b.monthKey, a.monthKey));

  return (
    <section className="view" aria-label="Historique">
      <LoadNotice />
      <header className="page-header">
        <p className="page-eyebrow">Au fil des mois</p>
        <h1 className="view-title" tabIndex={-1}>Notre histoire</h1>
        <p className="page-description">Retrouver chaque mois, tout simplement.</p>
        <ForestSpirit className="header-spirit" />
      </header>
      {months.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucun mois enregistré</p>
          <p className="empty-state__hint">
            Les mois apparaissent ici dès qu'ils sont créés dans « Ce mois ».
          </p>
        </div>
      ) : (
        <ul className="history-list">
          {months.map((month) => {
            const summary = computeMonthSummary(month);
            const incomeCents = month.salaryACents + month.salaryBCents;
            return (
              <li key={month.monthKey}>
                <button
                  type="button"
                  className="history-item"
                  onClick={() => {
                    selectMonth(month.monthKey);
                    requestViewChange('month');
                  }}
                  aria-label={`Ouvrir ${monthKeyToLabel(month.monthKey)} dans Ce mois`}
                >
                  <span className="history-item__head">
                    <span className="history-item__label">{monthKeyToLabel(month.monthKey)}</span>
                    <svg
                      className="history-item__chevron"
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M9.5 6l6 6-6 6" />
                    </svg>
                  </span>
                  <span className="history-item__grid">
                    <span className="history-metric">
                      <span className="history-metric__label">Revenus</span>
                      <span className="history-metric__value amount">{formatCents(incomeCents)}</span>
                    </span>
                    <span className="history-metric">
                      <span className="history-metric__label">Contributions</span>
                      <span className="history-metric__value amount">
                        {formatCents(summary.householdContributionCents)}
                      </span>
                    </span>
                    <span className="history-metric">
                      <span className="history-metric__label">Dépenses</span>
                      <span className="history-metric__value amount">
                        {formatCents(summary.expensesTotalCents)}
                      </span>
                    </span>
                    <span className="history-metric">
                      <span className="history-metric__label">Reste</span>
                      <span
                        className={
                          summary.remainingCents < 0
                            ? 'history-metric__value amount is-deficit'
                            : 'history-metric__value amount'
                        }
                      >
                        {formatCents(summary.remainingCents)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {months.length >= 1 && (
        <div className="history-clear">
          {confirmClear ? (
            <div className="history-clear__confirm" role="alertdialog" aria-label="Confirmer l'effacement de l'historique">
              <p className="history-clear__text">
                Effacer l'historique ? Tous les mois sauf le mois affiché seront supprimés.
              </p>
              <div className="history-clear__actions">
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => {
                    clearHistory();
                    setConfirmClear(false);
                  }}
                >
                  Effacer
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmClear(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost history-clear__btn" onClick={() => setConfirmClear(true)}>
              Effacer l'historique
            </button>
          )}
        </div>
      )}
    </section>
  );
}
