/**
 * Revenus d'une personne (V4.1) : salaire du mois et compléments (heures
 * sup, astreintes, gardes, au taux au-delà) affichés en grand ; un toucher
 * ouvre l'AmountPad (pavé maison, raccourcis « Salaire habituel », « Comme
 * le mois dernier »). Plus de curseur : faire défiler ne change rien.
 * Les compléments restent repliés derrière « + Compléments » tant qu'ils
 * valent 0 : le bouton ouvre directement le pavé.
 * V4.2 : la part à verser au compte commun s'affiche en bas de la carte
 * (montant de `monthFlows`, le même que le virement de « Ce mois-ci »).
 */
import type { ContributionBreakdown, MonthRecord } from '@a2/core';
import { monthKeyToLabel } from '@a2/core';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { AmountField, Companion, Icon, NBSP, cx, euro, percent, type AmountFieldHandle } from '../../ui';
import { bonusShortcuts, salaryShortcuts, type ShortcutSource } from './amountShortcuts';
import './income.css';

function elide(name: string): string {
  return /^[aeiouyhâàéèêîïôûAEIOUYHÂÀÉÈÊÎÏÔÛ]/u.test(name) ? `d’${name}` : `de${NBSP}${name}`;
}

export function PersonCard({
  person,
  month,
  source,
  giveCents,
}: {
  person: 'A' | 'B';
  month: MonthRecord;
  source: ShortcutSource;
  /** Part à verser au compte commun ce mois (euros entiers, en centimes). */
  giveCents: number;
}) {
  const { setSalary, setBonus } = useApp();
  const who = person === 'A' ? 'a' : 'b';
  const settings = person === 'A' ? month.personA : month.personB;
  const salary = person === 'A' ? month.salaryACents : month.salaryBCents;
  const bonus = person === 'A' ? month.bonusACents : month.bonusBCents;
  const [adding, setAdding] = useState(false);
  const bonusRef = useRef<AmountFieldHandle>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const refocusAdd = useRef(false);
  const bonusShown = adding || bonus > 0;
  const of = elide(settings.name);
  const monthLabel = monthKeyToLabel(month.monthKey);

  const openBonus = () => {
    setAdding(true);
    // Le montant apparaît à l'image suivante : le pavé s'ouvre aussitôt.
    requestAnimationFrame(() => bonusRef.current?.open());
  };

  // Compléments repliés sans rien ajouter : le focus revient sur « + Compléments »
  // une fois le bouton remonté (après le rendu, jamais avant).
  useEffect(() => {
    if (bonusShown || !refocusAdd.current) return;
    refocusAdd.current = false;
    addRef.current?.focus({ preventScroll: true });
  }, [bonusShown]);

  return (
    <article className={cx('person-card', `person-card--${who}`)} aria-label={`Revenus ${of}`}>
      <header className="person-card__head">
        <Companion who={who} size={30} />
        <h3 className="person-card__name">{settings.name}</h3>
        {!bonusShown && (
          <button
            ref={addRef}
            type="button"
            className="person-card__add-bonus"
            aria-label={`Ajouter des compléments pour ${settings.name}`}
            title="Heures sup, astreintes, gardes…"
            onClick={openBonus}
          >
            <Icon name="plus" size={15} strokeWidth={2} />
            Compléments
          </button>
        )}
      </header>
      <div className="person-card__amounts">
        <AmountField
          id={`salary-${who}`}
          label="Salaire"
          accessibleLabel={`Salaire ${of}`}
          padDescription={monthLabel}
          valueCents={salary}
          onCommit={(cents) => setSalary(month.monthKey, person, cents)}
          shortcuts={salaryShortcuts(source, month, person)}
          size="lg"
          layout="row"
          className="person-card__salary"
        />
        {bonusShown && (
          <AmountField
            ref={bonusRef}
            id={`bonus-${who}`}
            label="Compléments"
            accessibleLabel={`Compléments ${of}`}
            padDescription={`Heures sup, astreintes, gardes · ${monthLabel}`}
            valueCents={bonus}
            onCommit={(cents) => setBonus(month.monthKey, person, cents)}
            onPadClosed={() => {
              // Rien d'ajouté : le montant se replie, le focus revient sur « + Compléments ».
              refocusAdd.current = bonus === 0;
              setAdding(false);
            }}
            shortcuts={bonusShortcuts(source, month, person)}
            size="md"
            layout="row"
            className="person-card__bonus"
          />
        )}
      </div>
      <p className="person-card__give">
        <span>À verser</span>
        <strong className="amount" data-testid={`contribution-${who}`}>
          {euro(giveCents)}
        </strong>
      </p>
    </article>
  );
}

/** « AC : 40 % × 3 000 € + 20 % × 675 € de compléments = 1 335 € » (chiffres de @a2/core). */
export function BreakdownLine({ name, breakdown, settings }: { name: string; breakdown: ContributionBreakdown; settings: MonthRecord['personA'] }) {
  const b = breakdown;
  return (
    <p className="breakdown__line">
      <span className="breakdown__who">
        {name}
        {NBSP}:
      </span>{' '}
      <span className="num">
        {percent(settings.baseRateBps)} × {euro(b.baseIncomeCents)}
        {b.variableIncomeCents > 0 && (
          <>
            {' '}
            + {percent(settings.variableRateBps)} × {euro(b.variableIncomeCents)} de compléments
          </>
        )}
      </span>{' '}
      <span className="breakdown__eq">= {euro(b.contributionCents)}</span>
    </p>
  );
}
