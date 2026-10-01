import { useApp } from '../state/store';

/**
 * Indicateur de sauvegarde (lead). N'affirme « Enregistré » qu'après un
 * succès ; en cas d'échec, indique que les modifications ne sont pas
 * sauvegardées.
 */
export function SaveIndicator() {
  const { saveStatus } = useApp();
  if (saveStatus === 'idle') {
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
