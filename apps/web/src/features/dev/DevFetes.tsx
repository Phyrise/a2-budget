/**
 * Mode développeur — les fêtes (V4.3), sans attendre la date : le matsuri du
 * couple dans la forêt (aperçu NON PERSISTANT, bandeau « Aperçu »), la fête
 * d'AL (Jiji, pluie de kompeitō) et celle d'AC (Calcifer, bougies).
 * Rien n'est écrit : ni les données, ni le « déjà vu » du jour.
 */
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Button } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { playParty, type PartyWho } from '../fetes/feteEvents';
import { deName } from '../fetes/names';

/** Le temps que la feuille se ferme avant de montrer la fête. */
const CLOSE_MS = 420;

export function DevFetes({ onClose }: { onClose: () => void }) {
  const { appState } = useApp();
  const { setModule } = useShell();
  const { setPreview } = useWorld();
  const names = { a: appState?.budget.settings.personA.name ?? 'AL', b: appState?.budget.settings.personB.name ?? 'AC' };

  const couple = () => {
    setPreview((prev) => ({ ...(prev ?? {}), festival: true }));
    onClose();
    setModule('maison');
  };

  const party = (who: PartyWho) => {
    onClose();
    window.setTimeout(() => playParty(who), CLOSE_MS);
  };

  return (
    <section className="dev-section" aria-labelledby="dev-fetes">
      <h3 id="dev-fetes" className="dev-section__title">
        Fêtes
      </h3>
      <div className="dev-actions">
        <Button size="sm" variant="primary" icon="sparkle" onClick={couple}>
          Fête du couple
        </Button>
        <Button size="sm" variant="quiet" onClick={() => party('a')}>
          {`Fête ${deName(names.a)}`}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => party('b')}>
          {`Fête ${deName(names.b)}`}
        </Button>
      </div>
    </section>
  );
}
