/**
 * « À verser ce mois » (V4) : ce que chacun verse au compte commun, le total
 * et les dépenses du mois, lisibles en 2 secondes. Les deux versements sont
 * arrondis ensemble (`roundEurosConsistent`) : AL + AC affichés = ensemble.
 * Chiffres de @a2/core uniquement ; les curseurs sont plus bas (Revenus).
 */
import type { MonthRecord, MonthSummary } from '@a2/core';
import { roundEurosConsistent } from '@a2/core';
import { Companion, euro, euroMinus } from '../../ui';

export function GiveCard({ month, summary }: { month: MonthRecord; summary: MonthSummary }) {
  const r = roundEurosConsistent(summary.contributionACents, summary.contributionBCents);
  const people = [
    { who: 'a' as const, name: month.personA.name, cents: r.aCents },
    { who: 'b' as const, name: month.personB.name, cents: r.bCents },
  ];
  return (
    <div className="give-card" aria-label="À verser ce mois">
      <div className="give-card__people">
        {people.map((p) => (
          <div key={p.who} className={`give-person give-person--${p.who}`}>
            <Companion who={p.who} size={30} />
            <span className="give-person__text">
              <span className="give-person__name">{p.name} verse</span>
              <strong className="amount give-person__value" data-testid={`contribution-${p.who}`}>
                {euro(p.cents)}
              </strong>
            </span>
          </div>
        ))}
      </div>
      <div className="give-card__rows">
        <div className="give-card__row give-card__row--total">
          <span>Ensemble</span>
          <strong className="amount" data-testid="household-total">
            {euro(r.totalCents)}
          </strong>
        </div>
        <div className="give-card__row">
          <span>Dépenses communes</span>
          <span className="amount give-card__minus" data-testid="expenses-total">
            {euroMinus(summary.expensesTotalCents)}
          </span>
        </div>
      </div>
    </div>
  );
}
