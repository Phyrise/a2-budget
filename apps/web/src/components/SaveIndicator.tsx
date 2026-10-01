import { useEffect, useState } from 'react';
import { useApp } from '../state/store';

/**
 * Indicateur de sauvegarde (lead).
 *
 * - « Enregistrement… » pendant l'écriture, « Enregistré » après un succès.
 * - « Modifications non sauvegardées » en cas d'échec (reste visible).
 * - Le succès est visible brièvement (auto-masqué) pour ne pas masquer le
 *   contenu ; l'erreur, elle, persiste jusqu'à la prochaine modification.
 */
export function SaveIndicator() {
  const { saveStatus } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (saveStatus === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setVisible(false), 1500);
      return () => clearTimeout(timer);
    }
    // 'saving' et 'error' restent affichés.
  }, [saveStatus]);

  if (!visible || saveStatus === 'idle') {
    return null;
  }
  return (
    <div className={`save-indicator save-indicator--${saveStatus}`} role="status" aria-live="polite">
      {saveStatus === 'saving' && 'Enregistrement…'}
      {saveStatus === 'saved' && 'Enregistré'}
      {saveStatus === 'error' && 'Modifications non sauvegardées'}
    </div>
  );
}
