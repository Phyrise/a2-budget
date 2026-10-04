/**
 * Lanterne : feuille plein écran transparente posée sur la forêt. Pendant
 * qu'elle est ouverte, la scène reste vivante (présentation forcée en
 * `live`, rétablie à la fermeture) et le reste de l'interface s'efface
 * (rituals.css) pour laisser toute la place au monde.
 */
import { actionableTasksToday } from '@a2/core';
import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../../state/store';
import { Sheet } from '../../../ui';
import { useWorld } from '../../../world/WorldContext';
import type { Names } from '../ritualText';
import { LanternSetup } from './LanternSetup';
import { LanternDone, LanternRunning } from './LanternSession';
import { lantern, useLantern } from './lanternStore';
import { usePageVisible } from './useLanternController';

/** Garde la forêt vivante tant que `active`, puis rend la main à la coquille. */
function useForceLiveWorld(active: boolean) {
  const { presentation, setPresentation } = useWorld();
  const visible = usePageVisible();
  const saved = useRef<boolean | null>(null);
  const latest = useRef(presentation);
  latest.current = presentation;

  useEffect(() => {
    if (!active) return;
    if (saved.current === null) saved.current = presentation.live;
    if (visible && !presentation.live) setPresentation({ ...presentation, live: true });
  }, [active, visible, presentation, setPresentation]);

  useEffect(() => {
    if (active || saved.current === null) return;
    const live = saved.current;
    saved.current = null;
    setPresentation({ ...latest.current, live });
  }, [active, setPresentation]);
}

export function LanternSheet({ open, onClose, names }: { open: boolean; onClose: () => void; names: Names }) {
  const s = useLantern();
  const { appState, today } = useApp();
  useForceLiveWorld(open);

  const tasks = appState?.chores.tasks;
  const completions = appState?.chores.completions;
  const skips = appState?.chores.skips;
  const todays = useMemo(
    () => actionableTasksToday(tasks ?? [], today, completions ?? [], skips),
    [tasks, today, completions, skips],
  );

  // Arrêt avant la première minute : rien à mémoriser, retour à la préparation.
  useEffect(() => {
    if (s.phase === 'done' && !s.completed && s.minutesSpent < 1) lantern.reset();
  }, [s.phase, s.completed, s.minutesSpent]);

  const close = () => {
    if (s.phase === 'done') lantern.reset();
    onClose();
  };

  const title =
    s.phase === 'running' ? 'Lanterne allumée' : s.phase === 'paused' ? 'Lanterne en pause' : s.phase === 'done' ? 'Lanterne' : 'Allumer une lanterne';

  return (
    <Sheet open={open} onClose={close} title={title} size="full" className="lantern-sheet">
      <div className="lantern-body">
        {s.phase === 'idle' && <LanternSetup names={names} tasks={todays} completions={completions ?? []} />}
        {(s.phase === 'running' || s.phase === 'paused') && <LanternRunning names={names} onHide={onClose} />}
        {s.phase === 'done' && <LanternDone names={names} onAgain={() => lantern.reset()} onClose={close} />}
      </div>
    </Sheet>
  );
}
