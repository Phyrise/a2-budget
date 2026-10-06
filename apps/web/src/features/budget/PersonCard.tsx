/**
 * Revenus d'une personne (V4) : salaire du mois au curseur (0–5 000 €, crans
 * de 10 €, − / + à l'euro, toucher le montant pour le saisir), compléments
 * au curseur (0–3 000 €) — heures sup, astreintes, gardes, au taux au-delà.
 * Les compléments restent repliés derrière « + Compléments » tant qu'ils
 * valent 0. Euros entiers : aucun centime ni en saisie ni à l'affichage.
 */
import type { ContributionBreakdown, MonthRecord } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../state/store';
import { Companion, EuroSlider, Icon, NBSP, cx, euro, percent } from '../../ui';
import './income.css';

export const SALARY_MAX_EUROS = 5000;
export const BONUS_MAX_EUROS = 3000;

export function PersonCard({ person, month }: { person: 'A' | 'B'; month: MonthRecord }) {
  const { setSalary, setBonus } = useApp();
  const who = person === 'A' ? 'a' : 'b';
  const settings = person === 'A' ? month.personA : month.personB;
  const salary = person === 'A' ? month.salaryACents : month.salaryBCents;
  const bonus = person === 'A' ? month.bonusACents : month.bonusBCents;
  const [opened, setOpened] = useState(false);
  const bonusShown = opened || bonus > 0;

  const openBonus = () => {
    setOpened(true);
    // Le curseur apparaît à l'image suivante : on lui donne le focus (clavier).
    requestAnimationFrame(() => document.getElementById(`bonus-${who}`)?.focus());
  };

  return (
    <article className={cx('person-card', `person-card--${who}`)} aria-label={`Revenus de ${settings.name}`}>
      <header className="person-card__head">
        <Companion who={who} size={30} />
        <h3 className="person-card__name">{settings.name}</h3>
        {!bonusShown && (
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
      </header>
      <EuroSlider
        id={`salary-${who}`}
        label="Salaire du mois"
        accessibleLabel={`Salaire de ${settings.name}`}
        valueCents={salary}
        maxEuros={SALARY_MAX_EUROS}
        onCommit={(cents) => setSalary(month.monthKey, person, cents)}
        className="person-card__salary"
      />
      {bonusShown && (
        <EuroSlider
          id={`bonus-${who}`}
          label="Compléments"
          accessibleLabel={`Compléments de ${settings.name}`}
          hint="Heures sup, astreintes, gardes, souvent payées le mois suivant"
          valueCents={bonus}
          maxEuros={BONUS_MAX_EUROS}
          onCommit={(cents) => setBonus(month.monthKey, person, cents)}
          className="person-card__bonus"
        />
      )}
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
