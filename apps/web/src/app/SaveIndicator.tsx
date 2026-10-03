import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Icon, cx } from '../ui';

/**
 * Indicateur d'enregistrement discret :
 * - « Enregistré » éphémère, seulement après une action de l'utilisateur
 *   (pas à l'ouverture de l'app ni au changement de jour) ;
 * - erreur persistante tant que la sauvegarde échoue.
 */
export function SaveIndicator() {
  const { saveStatus, recovery } = useApp();
  const [savedVisible, setSavedVisible] = useState(false);
  const lastInputRef = useRef(0);

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

  useEffect(() => {
    if (saveStatus !== 'saved' || Date.now() - lastInputRef.current > 6000) return;
    setSavedVisible(true);
    const timer = window.setTimeout(() => setSavedVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

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
    <p className={cx('save-indicator', savedVisible && 'is-visible')} role="status" aria-live="polite">
      <Icon name="check" size={14} strokeWidth={2} />
      <span>{savedVisible ? 'Enregistré' : ''}</span>
    </p>
  );
}
