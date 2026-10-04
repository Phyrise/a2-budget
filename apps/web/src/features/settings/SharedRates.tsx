/**
 * Taux communs du couple (V3.1) : un seul couple de taux pour vous deux,
 * réglé au curseur. Écrit dans les réglages (nouveaux mois) via
 * `setSharedRates` ; les mois existants ne changent jamais sans action
 * explicite (« Appliquer au mois affiché » ou le Budget).
 */
import { computeContributionBreakdown, hasSharedRates, sharedRates, type Settings } from '@a2/core';
import { useApp } from '../../state/store';
import { NBSP, Slider, euroShort, percent } from '../../ui';
import './sharedRates.css';

/** Exemple concret, calculé par @a2/core (aucun calcul ici). */
const EXAMPLE_SALARY = 300_000;
const EXAMPLE_BONUS = 50_000;

export function SharedRatesEditor({ settings }: { settings: Settings }) {
  const { setSharedRates } = useApp();
  const rates = sharedRates(settings);
  const aligned = hasSharedRates(settings);
  const example = computeContributionBreakdown(
    EXAMPLE_SALARY,
    { ...settings.personA, ...rates },
    EXAMPLE_BONUS,
  );

  return (
    <div className="shared-rates">
      {!aligned && (
        <p className="shared-rates__note" role="note">
          Vos taux étaient différents ({settings.personA.name}
          {NBSP}: {percent(settings.personA.baseRateBps)} et {percent(settings.personA.variableRateBps)}, {settings.personB.name}
          {NBSP}: {percent(settings.personB.baseRateBps)} et {percent(settings.personB.variableRateBps)}). En les réglant ici, ils deviennent communs à vous deux.
        </p>
      )}
      <Slider
        id="shared-base-rate"
        label="Taux de base"
        hint="Sur le salaire de chacun."
        valueBps={rates.baseRateBps}
        onCommit={(bps) => setSharedRates(bps, rates.variableRateBps)}
      />
      <Slider
        id="shared-variable-rate"
        label="Taux au-delà"
        hint={`Sur les compléments${NBSP}: heures sup, astreintes, gardes.`}
        valueBps={rates.variableRateBps}
        onCommit={(bps) => setSharedRates(rates.baseRateBps, bps)}
      />
      <p className="shared-rates__example">
        Par exemple, {euroShort(EXAMPLE_SALARY)} de salaire et {euroShort(EXAMPLE_BONUS)} de compléments
        {NBSP}: <strong className="amount">{euroShort(example.contributionCents)}</strong> versés au pot commun.
      </p>
    </div>
  );
}
