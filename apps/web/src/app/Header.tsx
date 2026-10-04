/**
 * En-tête de la coquille : marque, indicateur d'enregistrement, Historique,
 * lune de pause (Maison), Réglages et, en mode développeur, un petit bouton
 * « DEV » discret qui ouvre le panneau des valeurs cachées.
 */
import { IconButton, cx } from '../ui';
import { HISTORY_TITLES } from './modules';
import { SaveIndicator } from './SaveIndicator';
import { useShell } from './ShellContext';
import { usePauseToggle } from './usePauseToggle';

/** Lune (mettre en pause) / soleil (réveiller), à côté des Réglages sur Maison. */
function PauseButton() {
  const { paused, toggle } = usePauseToggle();
  return (
    <IconButton
      icon={paused ? 'sun' : 'moon'}
      label={paused ? 'Réveiller la forêt' : 'Mettre la maison en pause'}
      variant="glass"
      className={cx('pause-toggle', paused && 'is-paused')}
      onClick={toggle}
    />
  );
}

export function Header({ solid }: { solid: boolean }) {
  const { module, openSheet, prefs } = useShell();
  return (
    <header className={cx('app-header', solid && 'is-solid')}>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <p className="brand" aria-label="A² Home">
        <span className="brand__a" aria-hidden="true">
          A<span className="brand__sq">2</span>
        </span>
        <span className="brand__home" aria-hidden="true">
          Home
        </span>
      </p>
      {prefs.devMode && (
        <button type="button" className="dev-chip" aria-label="Mode développeur" onClick={() => openSheet('dev')}>
          DEV
        </button>
      )}
      <div className="app-header__end">
        <SaveIndicator />
        <IconButton icon="history" label={HISTORY_TITLES[module]} variant="glass" onClick={() => openSheet('history')} />
        {module === 'maison' && <PauseButton />}
        <IconButton icon="settings" label="Réglages" variant="glass" onClick={() => openSheet('settings')} />
      </div>
    </header>
  );
}
