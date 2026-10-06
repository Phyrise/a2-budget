/**
 * Préparer une lanterne (carte Lanterne de la barre des rituels) : une
 * petite feuille, plus de grande fenêtre. « Lancer » la ferme aussitôt : la
 * lanterne de pierre s'allume dans la forêt et le bandeau prend le relais
 * (LanternBar). La première fois, une courte explication en trois gestes
 * précède la préparation (LanternIntro).
 */
import { actionableTasksToday } from '@a2/core';
import { useMemo, useState } from 'react';
import { useShell } from '../../../app/ShellContext';
import { useApp } from '../../../state/store';
import { Sheet } from '../../../ui';
import type { Names } from '../ritualText';
import { LanternIntro, lanternIntroDue } from './LanternIntro';
import { startLantern } from './lanternActions';
import { LanternSetup } from './LanternSetup';
import type { LanternConfig } from './lanternStore';

export function LanternSheet({ open, onClose, names }: { open: boolean; onClose: () => void; names: Names }) {
  const { appState, today } = useApp();
  const { prefs, updatePrefs, isDesktop } = useShell();
  const [forcedIntro, setForcedIntro] = useState(false);

  const tasks = appState?.chores.tasks;
  const completions = appState?.chores.completions;
  const skips = appState?.chores.skips;
  const todays = useMemo(
    () => actionableTasksToday(tasks ?? [], today, completions ?? [], skips),
    [tasks, today, completions, skips],
  );

  // Première fois : trois gestes illustrés avant la préparation.
  const sessionsCount = appState?.focus?.sessions?.length ?? 0;
  const showIntro = forcedIntro || lanternIntroDue(prefs.lanternIntroSeen, sessionsCount);
  const continueFromIntro = () => {
    if (!prefs.lanternIntroSeen) updatePrefs({ lanternIntroSeen: true });
    setForcedIntro(false);
  };

  const start = (config: LanternConfig) => {
    onClose();
    startLantern(config, isDesktop);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Allumer une lanterne" size="auto" className="lantern-sheet">
      {showIntro ? (
        <LanternIntro onContinue={continueFromIntro} />
      ) : (
        <LanternSetup names={names} tasks={todays} completions={completions ?? []} onHelp={() => setForcedIntro(true)} onStart={start} />
      )}
    </Sheet>
  );
}
