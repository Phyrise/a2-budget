/**
 * Accueil (V5), seulement quand Firebase est configuré et qu'aucun choix
 * n'est mémorisé : la forêt, Jiji et Calcifer, deux boutons.
 *
 * - « Se connecter avec Google » : le SDK se charge dès le toucher
 *   (prepareSignIn), la fenêtre s'ouvre au relâcher.
 * - « Continuer en invité » : l'app d'aujourd'hui, rien ne quitte le
 *   téléphone, Firebase n'est jamais chargé.
 * - Un mot doux après un refus ou un échec (role="status").
 */
import '../styles/base.css';
import '../styles/ui.css';
import './welcome.css';
import { Button, Companion } from '../ui';
import { manifest } from '../world/manifest';
import { useAccount } from './AccountContext';
import { NOTICE_TEXT } from './accountText';

export function Welcome() {
  const { phase, notice, signIn, prepareSignIn, continueAsGuest } = useAccount();
  const connecting = phase === 'connecting';
  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <img className="welcome__forest" src={manifest.stages[5].color} alt="" draggable={false} decoding="async" />
      <div className="welcome__veil" aria-hidden="true" />
      <div className="welcome__content">
        <div className="welcome__pair">
          <Companion who="a" size={78} mood={notice === null ? 'happy' : 'curious'} touchable />
          <Companion who="b" size={74} mood={notice === null ? 'happy' : 'curious'} touchable />
        </div>
        <h1 id="welcome-title" className="welcome__title display">
          A² Home
        </h1>
        <p className="welcome__tagline">Notre maison, à deux.</p>
        <p className="welcome__notice" role="status">
          {notice !== null ? NOTICE_TEXT[notice] : ''}
        </p>
        <div className="welcome__actions">
          <Button
            variant="primary"
            size="lg"
            block
            icon="user"
            onPointerDown={prepareSignIn}
            onClick={signIn}
            disabled={connecting}
            aria-busy={connecting}
          >
            {connecting ? 'Connexion…' : 'Se connecter avec Google'}
          </Button>
          <Button variant="ghost" size="lg" block onClick={continueAsGuest} disabled={connecting}>
            Continuer en invité
          </Button>
          <p className="welcome__hint">En invité, tout reste sur ce téléphone.</p>
        </div>
      </div>
    </main>
  );
}
