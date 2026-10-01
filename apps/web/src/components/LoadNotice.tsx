import { useApp } from '../state/store';

/**
 * Bandeau de récupération : les données locales existantes sont illisibles
 * (JSON corrompu, version inconnue) ou le stockage est inaccessible.
 *
 * Le contenu existant n'est jamais remplacé automatiquement : les écritures
 * sont bloquées tant qu'une action n'a pas été explicitement confirmée
 * (import dans Réglages, ou « Recommencer à zéro »).
 */
export function LoadNotice() {
  const { recovery, confirmReset, retryLoad } = useApp();
  if (recovery.kind === 'none') {
    return null;
  }
  return (
    <div className="load-notice" role="alert">
      <p className="load-notice__message">{recovery.message}</p>
      <div className="load-notice__actions">
        {recovery.kind === 'unreadable' && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (
                window.confirm(
                  'Supprimer les données illisibles et recommencer à zéro ? ' +
                    'Pensez d’abord à importer une sauvegarde si vous en avez une.',
                )
              ) {
                confirmReset();
              }
            }}
          >
            Recommencer à zéro
          </button>
        )}
        {recovery.kind === 'storage-unavailable' && (
          <button type="button" className="btn btn--ghost" onClick={retryLoad}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
