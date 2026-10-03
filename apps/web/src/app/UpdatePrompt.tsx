/// <reference types="vite-plugin-pwa/react" />
/**
 * Mise à jour PWA :
 * - « Une nouvelle version est prête » n'apparaît que lorsqu'un nouveau
 *   précache est réellement prêt (needRefresh) ;
 * - jamais de rechargement automatique : l'utilisateur choisit « Actualiser »
 *   (SKIP_WAITING envoyé au worker en attente, cf. sw.ts) ;
 * - « Disponible hors ligne » est annoncé une seule fois, discrètement.
 */
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button, Icon, useToast } from '../ui';
import { useShell } from './ShellContext';

export function UpdatePrompt() {
  const { prefs, updatePrefs } = useShell();
  const toast = useToast();
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

  useEffect(() => {
    if (!offlineReady) return;
    setOfflineReady(false);
    if (prefs.offlineAnnounced) return;
    updatePrefs({ offlineAnnounced: true });
    toast.show({ message: 'Disponible hors ligne', icon: 'leaf' });
  }, [offlineReady, prefs.offlineAnnounced, setOfflineReady, toast, updatePrefs]);

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="status" aria-live="polite">
      <Icon name="sparkle" size={20} className="update-prompt__icon" />
      <p className="update-prompt__text">Une nouvelle version est prête.</p>
      <div className="update-prompt__actions">
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Plus tard
        </Button>
        <Button variant="primary" size="sm" onClick={() => void updateServiceWorker(true)}>
          Actualiser
        </Button>
      </div>
    </div>
  );
}
