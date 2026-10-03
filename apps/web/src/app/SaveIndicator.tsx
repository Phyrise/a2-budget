import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Icon, cx } from '../ui';

/**
 * Indicateur d'enregistrement discret :
 * - « Enregistré » éphémère, seulement après une action de l'utilisateur
 *   (pas à l'ouverture de l'app ni au changement de jour) ;
 * - erreur persistante tant que la sauvegarde échoue.
 *
 * Le statut du store peut passer « saved → saving → saved » dans le même
 * rendu (écriture synchrone résolue en microtâche) : on s'appuie donc sur le
 * changement d'état applicatif, puis on vérifie le statut un instant après.
 */
export function SaveIndicator() {
  const { saveStatus, recovery, appState } = useApp();
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(false);
  const lastInputRef = useRef(0);
  const statusRef = useRef(saveStatus);
  statusRef.current = saveStatus;
  const firstStateRef = useRef(true);

  useEffect(() => {
    const mark = () => {
      lastInputRef.current = Date.now();
    };
    window.addEventListener('pointerdown', mark, true);
    window.addEventListener('keydown', mark, true);
    window.addEventListener('input', mark, true);
    return () => {
      window.removeEventListener('pointerdown', mark, true);
      window.removeEventListener('keydown', mark, true);
      window.removeEventListener('input', mark, true);
    };
  }, []);

  // Un changement d'état consécutif à une action → « Enregistré » si l'écriture a réussi.
  useEffect(() => {
    if (appState === null) return;
    if (firstStateRef.current) {
      firstStateRef.current = false;
      return;
    }
    if (Date.now() - lastInputRef.current > 6000) return;
    const timer = window.setTimeout(() => {
      if (statusRef.current === 'saved') setShown((n) => n + 1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [appState]);

  useEffect(() => {
    if (shown === 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (recovery.kind !== 'none') return null;

  if (saveStatus === 'error') {
    return (
      <p className="save-indicator save-indicator--error" role="alert">
        <Icon name="alert" size={16} />
        <span>Non enregistré</span>
      </p>
    );
  }

  return (
    <p className={cx('save-indicator', visible && 'is-visible')} role="status" aria-live="polite">
      <Icon name="check" size={14} strokeWidth={2} />
      <span>{visible ? 'Enregistré' : ''}</span>
    </p>
  );
}
