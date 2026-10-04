/**
 * Panneau du mode développeur (feuille), ouvert par le bouton « DEV » de
 * l'en-tête quand le mode est activé dans Réglages › À propos.
 *
 * Pendant la création de l'app : révèle toutes les valeurs cachées de la
 * forêt (stade, avancée, vitalité, crédits, séries, objectif et partage de
 * la semaine), les constantes du domaine et les déblocages, propose des
 * aperçus NON PERSISTANTS de la forêt et l'écoute de chaque son, et copie
 * un instantané JSON pour régler les constantes ensemble. Rien n'est écrit
 * dans les données ; tout se réinitialise en quittant le mode.
 */
import { useMemo } from 'react';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { Button, Sheet, useToast } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import { copyText, devData, devSnapshot } from './devData';
import { DevNumbers } from './DevNumbers';
import { DevPreviews } from './DevPreviews';
import './dev.css';

/** Le temps que la feuille se ferme avant de montrer la forêt. */
const CLOSE_MS = 280;

export function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appState, today } = useApp();
  const { setModule } = useShell();
  const { preview, playGuardian } = useWorld();
  const toast = useToast();
  const data = useMemo(() => (appState ? devData(appState, today) : null), [appState, today]);

  const showForest = (then?: () => void) => {
    onClose();
    setModule('maison');
    if (then) window.setTimeout(then, CLOSE_MS + 420);
  };

  const copy = async () => {
    if (data === null) return;
    const ok = await copyText(devSnapshot(data, preview, new Date()));
    toast.show({ message: ok ? 'État copié dans le presse-papiers' : 'La copie n’a pas pu se faire', icon: ok ? 'check' : 'alert' });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mode développeur"
      description="Les valeurs cachées, pour régler l’app pendant sa création. Rien n’est écrit dans vos données."
      size="full"
      className="dev-sheet"
    >
      {data === null ? null : (
        <div className="dev-panel">
          <div className="dev-actions dev-actions--top">
            <Button size="sm" variant="quiet" icon="download" onClick={copy}>
              Copier l’état (JSON)
            </Button>
          </div>
          <DevNumbers data={data} />
          <DevPreviews onShowForest={() => showForest()} onGuardian={() => showForest(playGuardian)} />
        </div>
      )}
    </Sheet>
  );
}
