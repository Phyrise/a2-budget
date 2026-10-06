/**
 * « Sur le compte commun » (V4, remplace le « reste ») : le solde estimé en
 * ce moment en grand (ouverture du mois + virements cochés − dépenses
 * cochées), la projection de fin de mois en dessous, et « Recaler sur le
 * compte » quand on regarde le vrai solde. Le Sans-Visage veille sous sa
 * lanterne ; la rigole d'or suit le solde, un repère marque la fin du mois.
 * Chiffres : `currentBalanceEstimate` / `endOfMonthProjection` (@a2/core).
 *
 * Mois non courant : pas de « en ce moment » ni de recalage (le vrai solde
 * se constate aujourd'hui). Mois passé : le solde à la fin du mois en
 * grand ; mois à venir : le solde au début du mois.
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

/** Où l'on se place : le mois courant (en ce moment), un mois passé ou à venir. */
export type BalanceView = 'now' | 'past' | 'future';

export interface BalanceCardProps {
  summary: MonthSummary;
  view: BalanceView;
  /** « octobre 2026 » (minuscule, pour les légendes). */
  monthLabel: string;
  openingCents: number;
  /** Net du mois tel qu'affiché (`monthFlows`) : ce dont le compte bouge. */
  netCents: number;
  /** Phrase douce tant que le solde n'a jamais été recalé (mois courant). */
  unconfirmedHint?: string;
  reserveTargetCents: number;
  nowCents: number;
  projectionCents: number;
  /** Part des paiements du mois déjà cochés (0..1) : il s'arrondit un peu. */
  paidShare: number;
  bowing: boolean;
  eating: boolean;
  noFaceRef: Ref<HTMLDivElement>;
  /** Absent : pas de bouton (mois non courant). */
  onRecalibrate?: () => void;
}

export function BalanceCard({
  summary: s,
  view,
  monthLabel,
  openingCents,
  netCents,
  unconfirmedHint,
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
  // Chiffre principal et repère selon le mois affiché.
  const mainCents = view === 'now' ? nowCents : view === 'past' ? projectionCents : openingCents;
  const markCents = view === 'past' ? openingCents : projectionCents;
  const caption =
    view === 'now' ? 'estimé en ce moment' : view === 'past' ? `estimé à la fin de ${monthLabel}` : `estimé au début de ${monthLabel}`;
  const footLabel = view === 'past' ? 'Début du mois' : 'Fin du mois';
  const monthShort = netCents < 0;
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
            {signed(mainCents)}
          </strong>
          <span className="balance-card__caption" data-testid="balance-caption">
            {caption}
          </span>
        </div>
      </div>
      <GoldGauge fill={balanceFill(mainCents, s)} mark={balanceFill(markCents, s)} deficit={mainCents < 0} />
      <div className="balance-card__foot">
        <span className="balance-card__projection">
          {footLabel}{' '}:{' '}
          <strong className="amount" data-testid="balance-projection">
            {signed(markCents)}
          </strong>
        </span>
        {onRecalibrate && (
          <button type="button" className="balance-card__recalibrate" onClick={onRecalibrate}>
            Recaler sur le compte
          </button>
        )}
      </div>
      {unconfirmedHint && (
        <p className="balance-card__hint" data-testid="balance-unconfirmed">
          {unconfirmedHint}
        </p>
      )}
      {monthShort && (
        <p className="balance-card__note" role="note">
          Ce mois-ci, les dépenses dépassent ce que vous versez ensemble{' '}: le compte baisse de{' '}
          {euro(-netCents)}. Ajuster un salaire, un taux ou une dépense suffit à retrouver l’équilibre.
        </p>
      )}
    </div>
  );
}
