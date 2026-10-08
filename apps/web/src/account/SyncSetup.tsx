/**
 * Première connexion d'un téléphone (V5, docs/SYNC_DESIGN.md §6) : un écran
 * de choix minimal, dans l'univers de l'accueil.
 *
 * - D'abord, une copie de sécurité des données locales (backup-pre-sync) ;
 *   « Garder une copie » propose aussi le fichier JSON.
 * - Maison commune vide : « Y mettre mes données » (envoi par lots, reprise
 *   si coupure). Déjà remplie : « La rejoindre » (les données de ce
 *   téléphone restent de côté, retrouvées en invité).
 * - « Rester en invité » : rien ne part, l'app d'aujourd'hui.
 */
import '../styles/base.css';
import '../styles/ui.css';
import './welcome.css';
import './syncSetup.css';
import { emptyAppState } from '@a2/core';
import { useEffect, useState } from 'react';
import { buildExportJson, exportFilename } from '../state/exportImport';
import { backupBeforeSync, readLocalState } from '../state/localCopies';
import type { HouseholdContent } from '../sync/firebase/types';
import { Button, Companion } from '../ui';
import { saveFile } from '../ui/download';
import { manifest } from '../world/manifest';
import { useAccount } from './AccountContext';
import { SETUP_TEXT, type SetupPhase } from './accountText';
import { useSync } from './SyncContext';

type Phase = SetupPhase | { sending: [number, number] };

export function SyncSetup() {
  const { member, household, continueAsGuest } = useAccount();
  const { setup, join } = useSync();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [attempt, setAttempt] = useState(0);
  const [hasLocal] = useState(() => readLocalState() !== null);

  // Les données de ce téléphone sont mises à l'abri avant tout.
  useEffect(() => {
    backupBeforeSync();
  }, []);

  // Le foyer prêt, on regarde ce qu'il contient.
  useEffect(() => {
    if (member === null || household === 'pending') return setPhase('waiting');
    if (household !== 'ready') return setPhase(household === 'offline' ? 'offline' : 'failed');
    let cancelled = false;
    setPhase('waiting');
    void setup()
      .then((api) => api?.inspect() ?? 'failed')
      .then((content) => {
        if (!cancelled) setPhase(content);
      });
    return () => {
      cancelled = true;
    };
  }, [member, household, setup, attempt]);

  const enter = () => {
    setPhase('joining');
    void join().then((ok) => {
      if (!ok) setPhase('failed');
    });
  };

  const send = async () => {
    const api = await setup();
    if (api === null) return setPhase('failed');
    setPhase({ sending: [0, 0] });
    const outcome = await api.initialize(readLocalState() ?? emptyAppState(), (sent, total) => setPhase({ sending: [sent, total] }));
    if (outcome === 'done') enter();
    else setPhase(outcome === 'taken' ? 'shared' : outcome);
  };

  const keepCopy = () => {
    const local = readLocalState();
    if (local !== null) saveFile(buildExportJson(local), exportFilename());
  };

  const sending = typeof phase === 'object' ? phase.sending : null;
  const key: SetupPhase = sending !== null ? 'sending' : (phase as SetupPhase);
  const text = SETUP_TEXT[key];
  const choice: HouseholdContent | null = key === 'empty' || key === 'resume' || key === 'shared' ? key : null;
  const busy = key === 'waiting' || key === 'joining' || key === 'sending';

  return (
    <main className="welcome sync-setup" aria-labelledby="sync-setup-title" aria-busy={busy}>
      <img className="welcome__forest" src={manifest.stages[5].color} alt="" draggable={false} decoding="async" />
      <div className="welcome__veil" aria-hidden="true" />
      <div className="welcome__content">
        <div className="welcome__pair">
          <Companion who="a" size={64} mood={busy ? 'sleepy' : 'happy'} touchable />
          <Companion who="b" size={60} mood={busy ? 'sleepy' : 'happy'} touchable />
        </div>
        <h1 id="sync-setup-title" className="welcome__title sync-setup__title display">
          Notre maison commune
        </h1>
        <p className="welcome__tagline" role="status">
          {sending !== null && sending[1] > 0 ? `${text} ${sending[0]} / ${sending[1]}` : text}
        </p>
        {sending !== null && (
          <div className="sync-setup__progress" aria-hidden="true">
            <span style={{ width: `${sending[1] > 0 ? Math.round((sending[0] / sending[1]) * 100) : 4}%` }} />
          </div>
        )}
        {choice !== null && <p className="welcome__hint sync-setup__note">{SETUP_TEXT.note}</p>}
        <div className="welcome__actions sync-setup__actions">
          {choice === 'shared' && (
            <Button variant="primary" size="lg" block onClick={enter}>
              La rejoindre
            </Button>
          )}
          {(choice === 'empty' || choice === 'resume') && (
            <Button variant="primary" size="lg" block onClick={() => void send()}>
              {choice === 'resume' ? 'Reprendre l’envoi' : 'Y mettre mes données'}
            </Button>
          )}
          {(key === 'offline' || key === 'failed') && (
            <Button variant="primary" size="lg" block icon="refresh" onClick={() => setAttempt((n) => n + 1)}>
              Réessayer
            </Button>
          )}
          {!busy && (
            <Button variant="ghost" size="lg" block onClick={continueAsGuest}>
              Rester en invité
            </Button>
          )}
          {choice !== null && hasLocal && (
            <Button variant="quiet" size="sm" icon="download" onClick={keepCopy}>
              Garder une copie de mes données
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
