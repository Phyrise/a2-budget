/**
 * Taux communs du couple (V3.1) : un seul couple de taux pour vous deux,
 * réglé au curseur. Écrit dans les réglages (nouveaux mois) via
 * `setSharedRates` ; les nouveaux mois prennent toujours ces taux communs
 * (createMonthRecord). Les mois existants ne changent jamais sans action
 * explicite (« Appliquer au mois affiché » ou le Budget).
 */
import { computeContributionBreakdown, hasSharedRates, sharedRates, type Settings } from '@a2/core';
import { useApp } from '../../state/store';
import { Button, NBSP, Slider, euroShort, percent } from '../../ui';
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
        <div className="shared-rates__note" role="note">
          <p>
            Vos réglages gardent encore des taux différents ({settings.personA.name}
            {NBSP}: {percent(settings.personA.baseRateBps)} et {percent(settings.personA.variableRateBps)}, {settings.personB.name}
            {NBSP}: {percent(settings.personB.baseRateBps)} et {percent(settings.personB.variableRateBps)}). Les nouveaux mois
            utilisent déjà les taux communs ci-dessous.
          </p>
          <Button variant="quiet" size="sm" icon="check" onClick={() => setSharedRates(rates.baseRateBps, rates.variableRateBps)}>
            Les rendre communs
          </Button>
        </div>
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
