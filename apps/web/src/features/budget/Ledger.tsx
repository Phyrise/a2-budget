/**
 * Équilibre du mois, côté maison de bains : à verser ensemble, dépenses,
 * puis le reste — avec le Sans-Visage sous sa lanterne et la rigole d'or qui
 * part de ses mains. Chiffres de @a2/core uniquement ; le Sans-Visage et la
 * jauge ne font que refléter ce qui est écrit.
 */
import type { MonthSummary } from '@a2/core';
import { cx, euro, euroMinus } from '../../ui';
import { GoldGauge } from './chihiro/GoldGauge';
import { goldFill, noFaceMood } from './chihiro/mood';
import { NoFace } from './chihiro/NoFace';

export function Ledger({ summary, reserveTargetCents, bowing }: { summary: MonthSummary; reserveTargetCents: number; bowing: boolean }) {
  const s = summary;
  const deficit = s.remainingCents < 0;
  return (
    <div className={cx('ledger', deficit && 'ledger--deficit')} aria-label="Équilibre du mois">
      <div className="ledger__row ledger__row--total">
        <span className="ledger__label">À verser ensemble</span>
        <strong className="amount ledger__value" data-testid="household-total">
          {euro(s.householdContributionCents)}
        </strong>
      </div>
      <div className="ledger__row">
        <span className="ledger__label">Dépenses communes</span>
        <span className="amount ledger__value ledger__value--minus" data-testid="expenses-total">
          {euroMinus(s.expensesTotalCents)}
        </span>
      </div>
      <div className="ledger__rule" aria-hidden="true" />
      <div className="ledger__rest-block">
        <NoFace mood={noFaceMood(s, reserveTargetCents)} bowing={bowing} scale={0.27} />
        <div className="ledger__rest-main">
          <div className="ledger__row ledger__row--rest">
            <span className="ledger__label">{deficit ? 'Déficit' : 'Reste'}</span>
            <strong className="amount ledger__value ledger__rest" data-testid="remaining">
              {deficit ? euroMinus(-s.remainingCents) : euro(s.remainingCents)}
            </strong>
          </div>
          <GoldGauge fill={goldFill(s)} deficit={deficit} />
        </div>
      </div>
      {deficit && (
        <p className="ledger__note" role="note">
          Ce mois-ci, les dépenses dépassent ce que vous versez ensemble. Ajuster un salaire, un taux ou une dépense suffit à
          retrouver l’équilibre.
        </p>
      )}
    </div>
  );
}
