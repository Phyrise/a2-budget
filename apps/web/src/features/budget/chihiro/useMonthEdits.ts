/**
 * Repère les modifications enregistrées du mois affiché (salaire, compléments,
 * réserve, dépenses, libellés, taux) pour les petites réactions de l'univers :
 * - le Sans-Visage suit le compte (V4.2) : le net du mois monte → il reçoit
 *   l'argent, content ; il descend → il s'attriste (`react`, voir reaction.ts) ;
 * - `bowing` : salut bref pour une modification sans effet sur le compte
 *   (libellé, réserve) ;
 * - `run` : une Noiraude traverse en portant un kompeitō quand un MONTANT
 *   change (couleur de la dépense touchée, jaune pour les revenus et la
 *   réserve) ; dessinée par le code (scène des Noiraudes, soot.runner).
 * Changer de mois ou recharger le même état ne déclenche rien.
 */
import type { MonthRecord } from '@a2/core';
import { useEffect, useRef, useState } from 'react';
import { editReaction, konpeitoColorFor, type KonpeitoHue } from './mood';
import { react } from './reaction';

export const BOW_MS = 1500;

export interface SusuwatariRun {
  id: number;
  /** Couleur du kompeitō qu'elle porte (celle de la dépense touchée, or sinon). */
  tone: KonpeitoHue;
}

interface Snapshot {
  key: string;
  amounts: string;
  full: string;
  month: MonthRecord;
}

function snapshot(month: MonthRecord): Snapshot {
  const amounts = [
    month.salaryACents,
    month.salaryBCents,
    month.bonusACents,
    month.bonusBCents,
    month.reserveTargetCents,
    ...month.expenses.map((e) => `${e.id}:${e.amountCents}`),
  ].join('|');
  const full = [
    amounts,
    month.expenses.map((e) => e.label).join('|'),
    month.personA.baseRateBps,
    month.personA.variableRateBps,
    month.personB.baseRateBps,
    month.personB.variableRateBps,
  ].join('#');
  return { key: month.monthKey, amounts, full, month };
}

/** Dépense ajoutée, retirée ou dont le montant a changé (sinon : revenus / réserve). */
function touchedExpenseLabel(before: MonthRecord['expenses'], after: MonthRecord['expenses']): string | null {
  const old = new Map(before.map((e) => [e.id, e]));
  for (const e of after) {
    const prev = old.get(e.id);
    if (!prev || prev.amountCents !== e.amountCents) return e.label;
  }
  const now = new Set(after.map((e) => e.id));
  const removed = before.find((e) => !now.has(e.id));
  return removed ? removed.label : null;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useMonthEdits(month: MonthRecord): { bowing: boolean; run: SusuwatariRun | null; endRun: () => void } {
  const previous = useRef<Snapshot | null>(null);
  const bowTimer = useRef<number | undefined>(undefined);
  const runId = useRef(0);
  const [bowing, setBowing] = useState(false);
  const [run, setRun] = useState<SusuwatariRun | null>(null);

  useEffect(() => {
    const next = snapshot(month);
    const prev = previous.current;
    previous.current = next;
    if (prev === null || prev.key !== next.key) {
      setBowing(false);
      setRun(null);
      return;
    }
    if (prev.full === next.full) return;

    const reaction = editReaction(prev.month, next.month);
    if (reaction !== null) {
      react(reaction);
    } else {
      setBowing(true);
      window.clearTimeout(bowTimer.current);
      bowTimer.current = window.setTimeout(() => setBowing(false), BOW_MS);
    }

    if (prev.amounts !== next.amounts && !prefersReducedMotion()) {
      const label = touchedExpenseLabel(prev.month.expenses, next.month.expenses);
      runId.current += 1;
      const tone = label === null ? 'yellow' : (konpeitoColorFor(label).replace(/-2$/, '') as KonpeitoHue);
      setRun({ id: runId.current, tone });
    }
  }, [month]);

  useEffect(() => () => window.clearTimeout(bowTimer.current), []);

  return { bowing, run, endRun: () => setRun(null) };
}
