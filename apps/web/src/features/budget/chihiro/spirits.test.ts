import { createMonthRecord, emptyAppState, setExpensePaid, setTransferPaid } from '@a2/core';
import { describe, expect, it } from 'vitest';
import { accountSwell, editReaction, paymentReaction } from './mood';
import { STRAY_SIZE, nextDelayMs, pickPerch, type Box } from '../../../creatures/soot/perch';

const month = () => {
  const s = emptyAppState();
  return { ...createMonthRecord('2026-10', s.budget.settings), salaryACents: 220_000, salaryBCents: 300_000 };
};

describe('le Sans-Visage suit le compte', () => {
  it('cocher un virement ou décocher une dépense : gain ; l’inverse : perte', () => {
    expect(paymentReaction('transfer', true)).toBe('gain');
    expect(paymentReaction('expense', false)).toBe('gain');
    expect(paymentReaction('expense', true)).toBe('loss');
    expect(paymentReaction('transfer', false)).toBe('loss');
  });

  it('une modification suit le net du mois ; un libellé ne change rien', () => {
    const m = month();
    expect(editReaction(m, { ...m, salaryACents: 230_000 })).toBe('gain');
    expect(editReaction(m, { ...m, expenses: [...m.expenses, { id: 'x', label: 'Vélo', amountCents: 9_000 }] })).toBe('loss');
    const renamed = { ...m, expenses: m.expenses.map((e, i) => (i === 0 ? { ...e, label: 'Autre' } : e)) };
    expect(editReaction(m, renamed)).toBeNull();
  });

  it('il s’arrondit quand le compte monte, se tasse quand il descend', () => {
    const m = month();
    expect(accountSwell(m)).toBe(0);
    const paidIn = setTransferPaid(m, 'A', true);
    expect(accountSwell(paidIn)).toBeGreaterThan(0);
    expect(accountSwell(setExpensePaid(m, 'rent', true))).toBeLessThan(0);
    const all = [...m.expenses.map((e) => e.id)].reduce((acc, id) => setExpensePaid(acc, id, true), setTransferPaid(paidIn, 'B', true));
    expect(Math.abs(accountSwell(all))).toBeLessThanOrEqual(1);
  });
});

describe('Noiraudes vagabondes', () => {
  const seq = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length]!;
  };
  const view: Box = { left: 0, top: 60, right: 390, bottom: 760 };

  it('apparitions toutes les 25–60 s, plus rares quand tout est immobile', () => {
    expect(nextDelayMs(false, () => 0)).toBe(25_000);
    expect(nextDelayMs(false, () => 1)).toBe(60_000);
    expect(nextDelayMs(true, () => 0)).toBeGreaterThanOrEqual(60_000);
  });

  it('se pose au bord haut d’un bloc visible, trot compris', () => {
    const card: Box = { left: 20, top: 300, right: 370, bottom: 500 };
    const perch = pickPerch([card], [], view, seq(0.3, 0.2, 0.5));
    expect(perch).not.toBeNull();
    const p = perch!;
    expect(p.y + STRAY_SIZE.h).toBeGreaterThan(card.top);
    expect(Math.min(p.x, p.x + p.dx)).toBeGreaterThanOrEqual(card.left);
    expect(Math.max(p.x, p.x + p.dx) + STRAY_SIZE.w).toBeLessThanOrEqual(card.right);
  });

  it('jamais sur un contrôle, ni sous le bandeau ou la navigation', () => {
    const card: Box = { left: 20, top: 300, right: 370, bottom: 500 };
    const everywhere: Box = { left: 0, top: 240, right: 390, bottom: 320 };
    expect(pickPerch([card], [everywhere], view, Math.random)).toBeNull();
    expect(pickPerch([{ ...card, top: 70 }], [], view, Math.random)).toBeNull();
    expect(pickPerch([{ ...card, top: 790 }], [], view, Math.random)).toBeNull();
    const button: Box = { left: 20, top: 250, right: 200, bottom: 300 };
    for (let i = 0; i < 20; i += 1) {
      const p = pickPerch([card], [button], view, Math.random);
      if (p !== null) expect(Math.min(p.x, p.x + p.dx)).toBeGreaterThan(button.right);
    }
  });
});
