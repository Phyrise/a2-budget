/**
 * Synchronisation (V5), dans l'en-tête, en mode copie commune seulement :
 * un petit nuage. Le mot (« À jour », « Hors ligne — tout est gardé »)
 * apparaît un instant quand l'état change, puis seul le nuage reste —
 * jamais de texte envahissant. Seuls « hors ligne » et la pause sont
 * annoncés au lecteur d'écran (le va-et-vient « en cours / à jour » à
 * chaque geste serait bavard).
 */
import './syncIndicator.css';
import { useEffect, useRef, useState } from 'react';
import { useSync } from '../account/SyncContext';
import { SYNC_STATUS_TEXT } from '../account/accountText';
import type { SyncStatus } from '../sync/firebase/types';
import { Icon, cx, type IconName } from '../ui';

const ICON: Record<SyncStatus, IconName> = { synced: 'cloud', syncing: 'cloud', offline: 'cloud-off', error: 'alert' };
/** Le mot reste ce temps-là après un changement (« en cours » ne s'affiche jamais en toutes lettres). */
const WORD_MS: Record<SyncStatus, number> = { synced: 1600, syncing: 0, offline: 3200, error: 3200 };

export function SyncIndicator() {
  const { status } = useSync();
  const [word, setWord] = useState(false);
  const previous = useRef<SyncStatus | null>(null);

  useEffect(() => {
    if (status === null) return;
    const before = previous.current;
    previous.current = status;
    // « À jour » seulement en sortant d'un envoi (pas à chaque ouverture).
    const show = status === 'synced' ? before === 'syncing' || before === 'offline' : before !== null || status !== 'syncing';
    if (!show || WORD_MS[status] === 0) return setWord(false);
    setWord(true);
    const timer = window.setTimeout(() => setWord(false), WORD_MS[status]);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === null) return null;
  const label = SYNC_STATUS_TEXT[status];
  const loud = status === 'offline' || status === 'error';
  return (
    <p className={cx('sync-indicator', `sync-indicator--${status}`, word && 'is-worded')} title={label}>
      <Icon name={ICON[status]} size={16} strokeWidth={1.8} />
      <span className="sync-indicator__word" aria-hidden="true">
        {word ? label : ''}
      </span>
      <span className="visually-hidden">{loud ? '' : label}</span>
      <span className="visually-hidden" role="status">
        {loud ? label : ''}
      </span>
    </p>
  );
}
