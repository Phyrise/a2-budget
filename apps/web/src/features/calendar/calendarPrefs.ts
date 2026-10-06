/**
 * Préférence d'affichage du Calendrier : « Afficher les tâches ».
 *
 * Clé dédiée `a2-budget:calendar:v1`, comme `a2-budget:courses:v1` (Kiki)
 * et `a2-budget:sound:v1` : `a2-budget:ui:v1` est réécrite en entier par la
 * coquille (prefs.ts ne garde que ses champs connus), une clé ajoutée là
 * serait perdue au premier changement de module. Lecture / écriture
 * protégées : sans stockage, les tâches restent affichées. Jamais
 * `localStorage.clear()`.
 */
import { useCallback, useState } from 'react';

const KEY = 'a2-budget:calendar:v1';

interface CalendarPrefs {
  showTasks: boolean;
}

function read(): CalendarPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return { showTasks: true };
    const value = JSON.parse(raw) as { showTasks?: unknown };
    return { showTasks: value.showTasks !== false };
  } catch {
    return { showTasks: true };
  }
}

function write(prefs: CalendarPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Stockage indisponible : la préférence vaut pour cette session.
  }
}

/** [afficher les tâches, basculer]. */
export function useShowTasks(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(() => read().showTasks);
  const update = useCallback((next: boolean) => {
    setShow(next);
    write({ ...read(), showTasks: next });
  }, []);
  return [show, update];
}
