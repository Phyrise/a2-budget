/**
 * « Sur le compte commun » (V4, remplace le « reste ») : le solde estimé en
 * ce moment en grand (ouverture du mois + virements cochés − dépenses
 * cochées), la projection de fin de mois en dessous, et « Recaler sur le
 * compte » quand on regarde le vrai solde. Le Sans-Visage veille sous sa
 * lanterne ; la rigole d'or suit le solde, un repère marque la fin du mois.
 * Chiffres : `currentBalanceEstimate` / `endOfMonthProjection` (@a2/core).
 */
import type { MonthSummary } from '@a2/core';
import type { Ref } from 'react';
import { cx, euro, euroMinus } from '../../ui';
import { GoldGauge } from './chihiro/GoldGauge';
import { balanceFill, noFaceMood } from './chihiro/mood';
import { NoFace } from './chihiro/NoFace';

/** Montant signé lisible : « 1 234 € » ou « − 120 € » (jamais « −0 € »). */
function signed(cents: number): string {
  return cents < 0 ? euroMinus(-cents) : euro(cents);
}

export interface BalanceCardProps {
  summary: MonthSummary;
  reserveTargetCents: number;
  nowCents: number;
  projectionCents: number;
  /** Part des paiements du mois déjà cochés (0..1) : il s'arrondit un peu. */
  paidShare: number;
  bowing: boolean;
  eating: boolean;
  noFaceRef: Ref<HTMLDivElement>;
  onRecalibrate: () => void;
}

export function BalanceCard({
  summary: s,
  reserveTargetCents,
  nowCents,
  projectionCents,
  paidShare,
  bowing,
  eating,
  noFaceRef,
  onRecalibrate,
}: BalanceCardProps) {
  const low = projectionCents < 0;
  const monthShort = s.remainingCents < 0;
  return (
    <div className={cx('ledger', 'balance-card', low && 'balance-card--low')} data-testid="balance-card">
      <div className="balance-card__main">
        <NoFace
          ref={noFaceRef}
          mood={noFaceMood(s, reserveTargetCents, projectionCents)}
          bowing={bowing}
          eating={eating}
          fullness={paidShare}
          scale={0.27}
        />
        <div className="balance-card__text">
          <h2 className="balance-card__title">Sur le compte commun</h2>
          <strong className="amount balance-card__now" data-testid="balance-now">
            {signed(nowCents)}
          </strong>
          <span className="balance-card__caption">estimé en ce moment</span>
        </div>
      </div>
      <GoldGauge fill={balanceFill(nowCents, s)} mark={balanceFill(projectionCents, s)} deficit={nowCents < 0} />
      <div className="balance-card__foot">
        <span className="balance-card__projection">
          Fin du mois{' '}:{' '}
          <strong className="amount" data-testid="balance-projection">
            {signed(projectionCents)}
          </strong>
        </span>
        <button type="button" className="balance-card__recalibrate" onClick={onRecalibrate}>
          Recaler sur le compte
        </button>
      </div>
      {monthShort && (
        <p className="balance-card__note" role="note">
          Ce mois-ci, les dépenses dépassent ce que vous versez ensemble{' '}: le compte baisse de{' '}
          {euro(-s.remainingCents)}. Ajuster un salaire, un taux ou une dépense suffit à retrouver l’équilibre.
        </p>
      )}
    </div>
  );
}
