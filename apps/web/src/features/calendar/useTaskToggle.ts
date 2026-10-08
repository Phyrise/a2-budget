/**
 * Cocher une tâche de la maison depuis le Calendrier (V4) : même geste que
 * dans Maison — `toggleHomeTask` (occurrence du jour, ou ponctuelle), la
 * luciole s'envole depuis la case vers la forêt quand elle est visible
 * (ordinateur), une lueur de rizière sur la ligne, un toast doux avec
 * « Annuler ». Décocher ne dit rien de plus que la case elle-même.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { playGive } from '../../creatures/play';
import { useApp } from '../../state/store';
import { fr, useToast } from '../../ui';
import { useWorld } from '../../world/WorldContext';
import type { Who } from '../../world/types';
import type { TaskItem } from './taskAgenda';

const GLOW_MS = 1400;

export function useTaskToggle(): { celebratingKey: string | null; toggle: (item: TaskItem, origin: { x: number; y: number }) => void } {
  const { toggleHomeTask } = useApp();
  const world = useWorld();
  const toast = useToast();
  const [celebratingKey, setCelebratingKey] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toggle = useCallback(
    (item: TaskItem, origin: { x: number; y: number }) => {
      if (!item.checkable) return;
      const result = toggleHomeTask(item.task);
      if (result.completionId === null || !result.completed) return;
      playGive(1, 'soin'); // Un kompeitō au bocal du Budget (jamais retiré).
      const who = (result.doneBy ?? item.who) as Who;
      world.pulse({ id: result.completionId, who, fromClientX: origin.x, fromClientY: origin.y, ...(item.task.effort === 3 ? { strong: true } : {}) });
      window.clearTimeout(timer.current);
      setCelebratingKey(item.key);
      timer.current = window.setTimeout(() => setCelebratingKey(null), GLOW_MS);
      const task = item.task;
      toast.show({
        message: fr(`Fait : ${task.title}. Une luciole de plus dans la forêt.`),
        icon: 'check',
        action: { label: 'Annuler', onClick: () => toggleHomeTask(task) },
      });
    },
    [toggleHomeTask, world, toast],
  );

  return { celebratingKey, toggle };
}
