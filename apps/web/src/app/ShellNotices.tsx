/**
 * Bannière du mode de récupération (données illisibles / stockage
 * inaccessible), affichée en tête de la feuille de chaque écran.
 * Actions explicites : importer une sauvegarde, recommencer à zéro, réessayer.
 */
import { useState } from 'react';
import { useApp } from '../state/store';
import { ImportControl } from '../features/settings/ImportControl';
import { Button, ConfirmDialog, Icon } from '../ui';

export function ShellNotices() {
  const { recovery, confirmReset, retryLoad } = useApp();
  const [confirming, setConfirming] = useState(false);

  if (recovery.kind === 'none') return null;

  const unreadable = recovery.kind === 'unreadable';
  return (
    <div className="load-notice" role="alert">
      <div className="load-notice__head">
        <span className="load-notice__icon">
          <Icon name="alert" size={22} />
        </span>
        <p className="load-notice__title">{unreadable ? 'Données illisibles' : 'Stockage inaccessible'}</p>
      </div>
      <p className="load-notice__text">{recovery.message}</p>
      <div className="load-notice__actions">
        {unreadable ? (
          <>
            <ImportControl variant="primary" />
            <Button variant="danger-ghost" icon="refresh" onClick={() => setConfirming(true)}>
              Recommencer à zéro
            </Button>
          </>
        ) : (
          <Button variant="primary" icon="refresh" onClick={retryLoad}>
            Réessayer
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title={'Recommencer à zéro ?'}
        confirmLabel="Effacer et recommencer"
        tone="danger"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          confirmReset();
        }}
      >
        <p>Les données illisibles de cet appareil seront supprimées et remplacées par un départ neuf.</p>
      </ConfirmDialog>
    </div>
  );
}
