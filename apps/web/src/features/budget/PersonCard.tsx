/**
 * Carte d'une personne : salaire du mois (taux de base), compléments
 * facultatifs (heures sup, astreintes, gardes — taux au-delà), et ce
 * qu'elle verse. Les compléments restent repliés derrière « + Compléments »
 * tant qu'ils valent 0, pour garder le premier écran lisible.
 */
import type { ContributionBreakdown, MonthRecord } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../state/store';
import { AmountInput, Companion, Icon, NBSP, cx, euro, euroShort, percent } from '../../ui';
import './income.css';

export function PersonCard({ person, month, contributionCents }: { person: 'A' | 'B'; month: MonthRecord; contributionCents: number }) {
  const { setSalary, setBonus } = useApp();
  const who = person === 'A' ? 'a' : 'b';
  const settings = person === 'A' ? month.personA : month.personB;
  const salary = person === 'A' ? month.salaryACents : month.salaryBCents;
  const bonus = person === 'A' ? month.bonusACents : month.bonusBCents;
  const [opened, setOpened] = useState(false);
  const bonusShown = opened || bonus > 0;

  const openBonus = () => {
    setOpened(true);
    // Le champ apparaît à l'image suivante : on lui donne le focus (clavier).
    requestAnimationFrame(() => document.getElementById(`bonus-${who}`)?.focus());
  };

  return (
    <article className={cx('person-card', `person-card--${who}`)} aria-label={`${settings.name}`}>
      <header className="person-card__head">
        <Companion who={who} size={34} />
        <h3 className="person-card__name">{settings.name}</h3>
      </header>
      <AmountInput
        id={`salary-${who}`}
        label={`Salaire de ${settings.name}`}
        labelVisible={false}
        appearance="large"
        valueCents={salary}
        onCommit={(cents) => setSalary(month.monthKey, person, cents)}
        className="person-card__salary"
      />
      <p className="person-card__caption" aria-hidden="true">
        Salaire du mois
      </p>
      {bonusShown ? (
        <AmountInput
          id={`bonus-${who}`}
          label={`Compléments de ${settings.name}`}
          labelVisible={false}
          appearance="field"
          valueCents={bonus}
          onCommit={(cents) => setBonus(month.monthKey, person, cents)}
          className="person-card__bonus"
          hint="Compléments, souvent payés le mois suivant"
        />
      ) : (
        <button
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
      <div className="person-card__gives">
        <span className="person-card__gives-label">verse</span>
        <strong className="amount person-card__contribution" data-testid={`contribution-${who}`}>
          {euro(contributionCents)}
        </strong>
      </div>
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
        {percent(settings.baseRateBps)} × {euroShort(b.baseIncomeCents)}
        {b.variableIncomeCents > 0 && (
          <>
            {' '}
            + {percent(settings.variableRateBps)} × {euroShort(b.variableIncomeCents)} de compléments
          </>
        )}
      </span>{' '}
      <span className="breakdown__eq">= {euroShort(b.contributionCents)}</span>
    </p>
  );
}
