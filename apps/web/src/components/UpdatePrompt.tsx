import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Proposition de mise à jour PWA (lead).
 *
 * - « Mise à jour disponible » n'apparaît que lorsqu'un nouveau précache est
 *   réellement prêt (needRefresh).
 * - Aucun rechargement automatique pendant une saisie : l'utilisateur clique.
 * - « Disponible hors ligne » n'est annoncé qu'après la préparation effective
 *   du cache (offlineReady).
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        window.setInterval(() => {
          void registration.update();
        }, 3_600_000);
      }
    },
  });

  if (needRefresh) {
    return (
      <div className="update-prompt" role="status" aria-live="polite">
        <span className="update-prompt__text">Mise à jour disponible</span>
        <div className="update-prompt__actions">
          <button type="button" className="btn btn--primary" onClick={() => void updateServiceWorker(true)}>
            Actualiser
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setNeedRefresh(false)}>
            Plus tard
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="offline-toast" role="status">
        <span>Disponible hors ligne</span>
        <button type="button" aria-label="Fermer" onClick={() => setOfflineReady(false)}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  return null;
}
