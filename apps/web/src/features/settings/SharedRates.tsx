/**
 * Taux communs du couple : un seul couple de taux pour vous deux, réglé au
 * curseur. Globaux (V4.2) : `setSharedRates` les écrit dans les réglages ET
 * dans le mois courant et les suivants (`applySharedRates`) ; les mois passés
 * gardent les leurs. L'exemple suit le curseur en direct, avant même la
 * validation du geste.
 */
import { computeContributionBreakdown, sharedRates, type Settings } from '@a2/core';
import { useState } from 'react';
import { useApp } from '../../state/store';
import { NBSP, Slider, euroShort } from '../../ui';
import './sharedRates.css';

/** Exemple concret, calculé par @a2/core (aucun calcul ici). */
const EXAMPLE_SALARY = 300_000;
const EXAMPLE_BONUS = 50_000;

export function SharedRatesEditor({ settings }: { settings: Settings }) {
  const { setSharedRates } = useApp();
  const rates = sharedRates(settings);
  // Brouillons des curseurs pendant le geste (null = valeur enregistrée).
  const [baseDraft, setBaseDraft] = useState<number | null>(null);
  const [variableDraft, setVariableDraft] = useState<number | null>(null);
  const example = computeContributionBreakdown(
    EXAMPLE_SALARY,
    { ...settings.personA, baseRateBps: baseDraft ?? rates.baseRateBps, variableRateBps: variableDraft ?? rates.variableRateBps },
    EXAMPLE_BONUS,
  );

  return (
    <div className="shared-rates">
      <Slider
        id="shared-base-rate"
        label="Taux de base"
        valueBps={rates.baseRateBps}
        onDraft={setBaseDraft}
        onCommit={(bps) => setSharedRates(bps, rates.variableRateBps)}
      />
      <Slider
        id="shared-variable-rate"
        label="Taux au-delà"
        hint={`Sur les compléments${NBSP}: heures sup, astreintes, gardes.`}
        valueBps={rates.variableRateBps}
        onDraft={setVariableDraft}
        onCommit={(bps) => setSharedRates(rates.baseRateBps, bps)}
      />
      <p className="shared-rates__example" data-testid="rates-example">
        Par exemple, {euroShort(EXAMPLE_SALARY)} de salaire et {euroShort(EXAMPLE_BONUS)} de compléments
        {NBSP}: <strong className="amount">{euroShort(example.contributionCents)}</strong> versés au pot commun.
      </p>
    </div>
  );
}
