/**
 * Raccourcis contextuels de l'AmountPad (Budget) : simples lectures de
 * valeurs déjà enregistrées (réglages, mois précédent), aucun calcul.
 * Un raccourci absent, ou qui répète un montant déjà proposé, est omis.
 */
import type { MonthRecord, Settings } from '@a2/core';
import { roundToEuroCents } from '@a2/core';
import type { AmountShortcut } from '../../ui';
import { shiftMonthKey } from '../../ui/dates';

export interface ShortcutSource {
  settings: Settings | null;
  months: readonly MonthRecord[];
}

export function previousMonth(source: ShortcutSource, monthKey: string): MonthRecord | undefined {
  const key = shiftMonthKey(monthKey, -1);
  return source.months.find((m) => m.monthKey === key);
}

function dedupe(list: Array<AmountShortcut | null>): AmountShortcut[] {
  const seen = new Set<number>();
  const out: AmountShortcut[] = [];
  for (const s of list) {
    if (s === null) continue;
    const cents = roundToEuroCents(s.cents);
    if (seen.has(cents)) continue;
    seen.add(cents);
    out.push({ label: s.label, cents });
  }
  return out;
}

export function salaryShortcuts(source: ShortcutSource, month: MonthRecord, person: 'A' | 'B'): AmountShortcut[] {
  const usual = source.settings ? (person === 'A' ? source.settings.personA : source.settings.personB).baseSalaryCents : null;
  const prev = previousMonth(source, month.monthKey);
  return dedupe([
    usual !== null ? { label: 'Salaire habituel', cents: usual } : null,
    prev ? { label: 'Comme le mois dernier', cents: person === 'A' ? prev.salaryACents : prev.salaryBCents } : null,
  ]);
}

export function bonusShortcuts(source: ShortcutSource, month: MonthRecord, person: 'A' | 'B'): AmountShortcut[] {
  const prev = previousMonth(source, month.monthKey);
  const prevBonus = prev ? (person === 'A' ? prev.bonusACents : prev.bonusBCents) : 0;
  return dedupe([
    { label: 'Aucun', cents: 0 },
    prevBonus > 0 ? { label: 'Comme le mois dernier', cents: prevBonus } : null,
  ]);
}

export function expenseShortcuts(source: ShortcutSource, month: MonthRecord, expenseId: string): AmountShortcut[] {
  const usual = source.settings?.recurringExpenses.find((e) => e.id === expenseId);
  const prev = previousMonth(source, month.monthKey)?.expenses.find((e) => e.id === expenseId);
  return dedupe([
    usual ? { label: 'Montant habituel', cents: usual.amountCents } : null,
    prev ? { label: 'Comme le mois dernier', cents: prev.amountCents } : null,
  ]);
}
