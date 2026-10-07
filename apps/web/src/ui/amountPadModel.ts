/**
 * Modèle pur du pavé de saisie (AmountPad) : une chaîne de chiffres en euros
 * entiers, jamais de centimes, jamais de signe.
 *
 * À l'ouverture, le montant actuel est « frais » (comme un texte sélectionné) :
 * le premier chiffre tapé le remplace ; − / + et l'effacement le reprennent
 * là où il est. Vide = 0 € (ce qui s'affiche est exactement ce qui sera
 * enregistré).
 */

/** 9 chiffres : jusqu'à 999 999 999 €, sous la limite de @a2/core (1 milliard €). */
export const PAD_MAX_DIGITS = 9;
export const PAD_MAX_EUROS = 10 ** PAD_MAX_DIGITS - 1;

export interface PadState {
  /** Chiffres saisis, sans zéro de tête (« 0 » permis, « » = vide). */
  digits: string;
  /** Vrai tant que le montant vient d'être posé (ouverture, raccourci). */
  fresh: boolean;
}

export type PadAction =
  | { type: 'digit'; digit: string }
  | { type: 'double-zero' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'step'; euros: number }
  | { type: 'set'; euros: number };

function clampEuros(euros: number): number {
  if (!Number.isFinite(euros)) return 0;
  return Math.min(PAD_MAX_EUROS, Math.max(0, Math.round(euros)));
}

/** État d'ouverture depuis des centimes (arrondis à l'euro, comme l'affichage). */
export function padInit(cents: number): PadState {
  const euros = clampEuros(Math.round(cents / 100));
  return { digits: String(euros), fresh: true };
}

/** Euros représentés (vide = 0). */
export function padEuros(state: PadState): number {
  return state.digits === '' ? 0 : Number(state.digits);
}

function append(base: string, more: string): string {
  const joined = base === '0' || base === '' ? more.replace(/^0+(?=\d)/u, '') : base + more;
  const next = joined.replace(/^0+(?=\d)/u, '');
  return next.length > PAD_MAX_DIGITS ? base : next;
}

export function padReduce(state: PadState, action: PadAction): PadState {
  switch (action.type) {
    case 'digit': {
      if (!/^\d$/u.test(action.digit)) return state;
      const base = state.fresh ? '' : state.digits;
      const digits = append(base, action.digit);
      if (digits === state.digits && !state.fresh) return state;
      return { digits, fresh: false };
    }
    case 'double-zero': {
      const base = state.fresh ? '' : state.digits;
      const digits = base === '' || base === '0' ? '0' : append(base, '00');
      if (digits === state.digits && !state.fresh) return state;
      return { digits, fresh: false };
    }
    case 'backspace':
      if (state.digits === '' && !state.fresh) return state;
      return { digits: state.digits.slice(0, -1), fresh: false };
    case 'clear':
      if (state.digits === '' && !state.fresh) return state;
      return { digits: '', fresh: false };
    case 'step': {
      const euros = clampEuros(padEuros(state) + action.euros);
      return { digits: String(euros), fresh: false };
    }
    case 'set':
      return { digits: String(clampEuros(action.euros)), fresh: true };
  }
}
