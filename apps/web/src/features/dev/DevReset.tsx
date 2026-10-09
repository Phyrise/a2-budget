/**
 * Mode développeur — remise à zéro (phase de test) : effacer les lettres de
 * la semaine, ou tout remettre à zéro. Chaque bouton demande un second
 * toucher (« Sûr ? ») dans les 4 s.
 *
 * - Connecté : les lettres partent comme un geste (suppression douce) et le
 *   foyer signale « lu » remis aux deux téléphones ; « Tout » vide le foyer
 *   commun et les deux téléphones repartent de zéro (sync/reset.ts).
 * - Invité : sur ce téléphone seulement (le « Tout effacer » des Réglages,
 *   plus les mémoires locales : quêtes, bocal, lettres).
 */
import { useEffect, useState } from 'react';
import { useSync } from '../../account/SyncContext';
import { wipeLocalMemories } from '../../state/localMemories';
import { useApp } from '../../state/store';
import { useToast } from '../../ui';
import { rewindLocalSeen } from '../rituals/letters/letterReset';

type Armed = 'letters' | 'all' | null;
const ARM_MS = 4000;

export function DevReset({ onClose }: { onClose: () => void }) {
  const { clearWeekLetters, confirmReset } = useApp();
  const sync = useSync();
  const toast = useToast();
  const [armed, setArmed] = useState<Armed>(null);
  const [busy, setBusy] = useState(false);
  const shared = sync.mode === 'sync';

  useEffect(() => {
    if (armed === null) return;
    const timer = window.setTimeout(() => setArmed(null), ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const letters = () => {
    clearWeekLetters();
    if (shared) void sync.signalLettersCleared();
    else rewindLocalSeen(null);
    toast.show({ message: 'Lettres effacées', icon: 'check' });
  };

  const all = async () => {
    if (!shared) {
      confirmReset();
      wipeLocalMemories();
      rewindLocalSeen(null);
      toast.show({ message: 'Tout est à zéro', icon: 'check' });
      onClose();
      return;
    }
    setBusy(true);
    const outcome = await sync.resetHousehold();
    setBusy(false);
    if (outcome === 'offline') toast.show({ message: 'Hors ligne', icon: 'alert' });
    else if (outcome === 'failed') toast.show({ message: 'Pas pu tout effacer', icon: 'alert' });
  };

  const tap = (which: Exclude<Armed, null>) => {
    if (busy) return;
    if (armed !== which) {
      setArmed(which);
      return;
    }
    setArmed(null);
    if (which === 'letters') letters();
    else void all();
  };

  return (
    <section className="dev-section" aria-labelledby="dev-reset">
      <h3 id="dev-reset" className="dev-section__title">
        Remise à zéro
      </h3>
      <p className="dev-section__lead">{shared ? 'Chez les deux.' : 'Sur ce téléphone.'}</p>
      <div className="dev-actions">
        <button type="button" className="dev-choice dev-choice--danger" aria-pressed={armed === 'letters'} onClick={() => tap('letters')}>
          {armed === 'letters' ? 'Sûr ?' : 'Effacer les lettres de la semaine'}
        </button>
        <button type="button" className="dev-choice dev-choice--danger" aria-pressed={armed === 'all'} disabled={busy} onClick={() => tap('all')}>
          {busy ? 'On efface…' : armed === 'all' ? 'Sûr ?' : 'Tout remettre à zéro'}
        </button>
      </div>
    </section>
  );
}
