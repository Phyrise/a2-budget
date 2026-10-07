/**
 * Mode développeur — les fêtes (V4.3), sans attendre la date : le matsuri du
 * couple dans la forêt (aperçu NON PERSISTANT, bandeau « Aperçu »), la fête
 * d'AL (Jiji, pluie de kompeitō), celle d'AC (Calcifer, bougies) et le train
 * des eaux sur la peinture du Budget (colonne du monde, sur ordinateur).
 * Rien n'est écrit : ni les données, ni les « déjà vu » du jour ou du mois.
 */
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Button } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { playParty, playTrain, type PartyWho } from '../fetes/feteEvents';
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

  const train = () => {
    onClose();
    setModule('budget');
    window.setTimeout(playTrain, CLOSE_MS + 300);
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
        <Button size="sm" variant="quiet" onClick={train}>
          Train (ordinateur)
        </Button>
      </div>
    </section>
  );
}
