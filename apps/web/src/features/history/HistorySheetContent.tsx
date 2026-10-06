/**
 * Historique, contextuel au module affiché :
 * - Budget : mois existants (revenus, versé, dépenses, compte commun en fin
 *   de mois — V4, euros entiers) ; toucher un mois l'ouvre ;
 * - Maison : gestes faits, par jour (qui, quoi), sans score ;
 * - Courses : derniers articles achetés.
 * Lecture seule (aucune écriture, sauf « Effacer les mois passés » confirmé).
 */
import {
  compareMonthKeys,
  computeMonthSummary,
  endOfMonthProjection,
  localDateKey,
  monthIncomeCents,
  monthKeyToLabel,
  recentGroceryPurchases,
  roundEurosConsistent,
} from '@a2/core';
import { useMemo, useState, type ReactNode } from 'react';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Button, Companion, ConfirmDialog, EmptyState, Icon, clockTime, cx, euro, euroMinus, relativeDayLabel } from '../../ui';
import { assigneeName } from '../maison/taskText';
import './history.css';

/** « 1er » reste en minuscules dans les intitulés en capitales (« JEUDI 1er OCTOBRE »). */
function withOrdinal(label: string): ReactNode {
  const match = /^(.*\b1)er(\b.*)$/u.exec(label);
  if (match === null) return label;
  return (
    <>
      {match[1]}
      <span className="ordinal">er</span>
      {match[2]}
    </>
  );
}

function groupByDay<T>(items: T[], dateOf: (item: T) => string): Array<{ day: string; items: T[] }> {
  const groups: Array<{ day: string; items: T[] }> = [];
  for (const item of items) {
    const day = localDateKey(new Date(dateOf(item)));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

function BudgetHistory() {
  const { state, appState, selectMonth, clearHistory, currentMonth } = useApp();
  const { closeSheet } = useShell();
  const [confirm, setConfirm] = useState(false);
  const months = useMemo(
    () => [...(state?.months ?? [])].sort((a, b) => compareMonthKeys(b.monthKey, a.monthKey)),
    [state?.months],
  );

  if (months.length === 0) {
    return <EmptyState title="Aucun mois pour l’instant">Les mois du budget apparaîtront ici.</EmptyState>;
  }

  return (
    <>
      <ul className="history-list">
        {months.map((m) => {
          const s = computeMonthSummary(m);
          const given = roundEurosConsistent(s.contributionACents, s.contributionBCents).totalCents;
          const balance = appState ? endOfMonthProjection(appState.budget, m.monthKey) : s.remainingCents;
          const selected = m.monthKey === state?.selectedMonth;
          return (
            <li key={m.monthKey}>
              <button
                type="button"
                className={cx('history-item', 'history-month', selected && 'is-selected')}
                onClick={() => {
                  selectMonth(m.monthKey);
                  closeSheet();
                }}
                aria-current={selected ? 'true' : undefined}
              >
                <span className="history-month__head">
                  <span className="history-month__label">{monthKeyToLabel(m.monthKey)}</span>
                  {selected && <span className="history-month__badge">affiché</span>}
                  <Icon name="chevron-right" size={18} className="history-month__chevron" />
                </span>
                <span className="history-month__grid">
                  <span className="history-stat">
                    <span className="history-stat__label">Revenus</span>
                    <span className="history-stat__value num">
                      {m.personA.name} {euro(monthIncomeCents(m, 'A'))}
                      <br />
                      {m.personB.name} {euro(monthIncomeCents(m, 'B'))}
                    </span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat__label">Versé ensemble</span>
                    <span className="history-stat__value amount">{euro(given)}</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat__label">Dépenses</span>
                    <span className="history-stat__value amount">{euro(s.expensesTotalCents)}</span>
                  </span>
                  <span className={cx('history-stat', balance < 0 && 'is-deficit')}>
                    <span className="history-stat__label">Compte en fin de mois</span>
                    <span className="history-stat__value amount">{balance < 0 ? euroMinus(-balance) : euro(balance)}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {months.length > 1 && (
        <div className="history-footer">
          <Button variant="danger-ghost" icon="trash" size="sm" onClick={() => setConfirm(true)}>
            Effacer les autres mois
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={'Effacer les autres mois ?'}
        confirmLabel="Effacer"
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          clearHistory();
        }}
      >
        <p>
          Seul {currentMonth ? monthKeyToLabel(currentMonth.monthKey) : 'le mois affiché'} sera conservé. Pensez à exporter une sauvegarde
          avant, depuis les Réglages.
        </p>
      </ConfirmDialog>
    </>
  );
}

function MaisonHistory() {
  const { appState, today } = useApp();
  const names = { a: appState?.budget.settings.personA.name ?? 'AL', b: appState?.budget.settings.personB.name ?? 'AC' };
  const groups = useMemo(() => {
    const sorted = [...(appState?.chores.completions ?? [])].sort((x, y) => y.completedAt.localeCompare(x.completedAt));
    return groupByDay(sorted.slice(0, 300), (c) => c.completedAt);
  }, [appState?.chores.completions]);

  if (groups.length === 0) {
    return (
      <EmptyState title="Les petits gestes apparaîtront ici">
        Chaque tâche cochée s’inscrit dans l’historique de la maison, jour après jour.
      </EmptyState>
    );
  }
  return (
    <ol className="history-days">
      {groups.map((g) => (
        <li key={g.day} className="history-day">
          <h3 className="history-day__label">{withOrdinal(relativeDayLabel(g.day, today))}</h3>
          <ul className="history-day__list">
            {g.items.map((c) => (
              <li key={c.id} className="history-entry">
                <Companion who={c.assignee} size={30} />
                <span className="history-entry__text">
                  <span className="history-entry__title">{c.taskTitle}</span>
                  <span className="history-entry__meta">
                    {assigneeName(c.assignee, names)} · {clockTime(new Date(c.completedAt))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function CoursesHistory() {
  const { appState, today } = useApp();
  const groups = useMemo(() => {
    if (!appState) return [];
    return groupByDay(recentGroceryPurchases(appState.groceries, 60), (p) => p.boughtAt);
  }, [appState]);

  if (groups.length === 0) {
    return (
      <EmptyState title="Aucun achat pour l’instant" art="leaf">
        Les articles passés au panier puis rangés apparaîtront ici.
      </EmptyState>
    );
  }
  return (
    <ol className="history-days">
      {groups.map((g) => (
        <li key={g.day} className="history-day">
          <h3 className="history-day__label">{withOrdinal(relativeDayLabel(g.day, today))}</h3>
          <ul className="history-day__list">
            {g.items.map((p) => (
              <li key={p.id} className="history-entry history-entry--plain">
                <Icon name="check" size={18} className="history-entry__icon" />
                <span className="history-entry__text">
                  <span className="history-entry__title">
                    {p.label}
                    {p.quantity && <span className="history-entry__qty"> · {p.quantity}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function HistorySheetContent() {
  const { module } = useShell();
  if (module === 'budget') return <BudgetHistory />;
  if (module === 'courses') return <CoursesHistory />;
  return <MaisonHistory />;
}
