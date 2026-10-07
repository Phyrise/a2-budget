import { describe, expect, it } from 'vitest';
import { PAD_MAX_EUROS, padEuros, padInit, padReduce, type PadAction, type PadState } from './amountPadModel';

const run = (start: PadState, ...actions: PadAction[]) => actions.reduce(padReduce, start);
const digits = (text: string): PadAction[] =>
  [...text].map((d) => (d === 'Z' ? { type: 'double-zero' } : { type: 'digit', digit: d }));

describe('pavé de saisie (euros entiers)', () => {
  it('ouvre sur le montant actuel, arrondi à l’euro, prêt à être remplacé', () => {
    expect(padInit(220_000)).toEqual({ digits: '2200', fresh: true });
    expect(padInit(1_050)).toEqual({ digits: '11', fresh: true });
    expect(padInit(0)).toEqual({ digits: '0', fresh: true });
  });

  it('le premier chiffre remplace, les suivants s’ajoutent', () => {
    const s = run(padInit(220_000), ...digits('3150'));
    expect(s).toEqual({ digits: '3150', fresh: false });
    expect(padEuros(s)).toBe(3150);
  });

  it('« 00 » multiplie par cent ; jamais de zéro de tête', () => {
    expect(padEuros(run(padInit(0), ...digits('3Z')))).toBe(300);
    expect(run(padInit(500), ...digits('Z'))).toEqual({ digits: '0', fresh: false });
    expect(run(padInit(500), ...digits('007'))).toEqual({ digits: '7', fresh: false });
  });

  it('effacer reprend le montant affiché ; vide vaut 0 €', () => {
    const s = run(padInit(67_500), { type: 'backspace' });
    expect(s).toEqual({ digits: '67', fresh: false });
    const empty = run(s, { type: 'backspace' }, { type: 'backspace' }, { type: 'backspace' });
    expect(empty.digits).toBe('');
    expect(padEuros(empty)).toBe(0);
    expect(run(padInit(67_500), { type: 'clear' }).digits).toBe('');
  });

  it('− / + par pas de 10 et 100, jamais sous 0', () => {
    expect(padEuros(run(padInit(220_000), { type: 'step', euros: 100 }, { type: 'step', euros: -10 }))).toBe(2290);
    expect(padEuros(run(padInit(5_000), { type: 'step', euros: -100 }))).toBe(0);
    // Après un pas, taper ajoute (le montant n'est plus « frais »).
    expect(padEuros(run(padInit(1_000), { type: 'step', euros: 10 }, ...digits('5')))).toBe(205);
  });

  it('raccourci : pose un montant frais ; plafond de 9 chiffres', () => {
    expect(run(padInit(0), { type: 'set', euros: 3000 })).toEqual({ digits: '3000', fresh: true });
    const big = run(padInit(0), ...digits('1234567890'));
    expect(big.digits).toBe('123456789');
    expect(padEuros(run(big, { type: 'step', euros: 10 ** 9 }))).toBe(PAD_MAX_EUROS);
  });
});
