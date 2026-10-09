/**
 * Lettres effacées (mode développeur) : la marque « lu » de ce téléphone est
 * ramenée au début de la semaine du cercle. Les lettres de cette semaine
 * redeviennent « à recevoir », celles d'avant restent lues.
 */
import { ritualWeek } from '../ritualText';
import { forgetLocalSeen, letters, writeLocalSeen } from './letterStore';

/** Début (minuit, heure locale) de la semaine du cercle, au format des marques (ISO). */
export function weekStartMark(today: Date): string {
  const [y, m, d] = ritualWeek(today).weekStart.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toISOString();
}

/** Ramène la marque locale de `role` (null : invité, toutes oubliées) ; rend la marque. */
export function rewindLocalSeen(role: 'a' | 'b' | null, today = new Date()): string {
  const mark = weekStartMark(today);
  forgetLocalSeen();
  if (role !== null) writeLocalSeen(role, mark);
  letters.seenReset();
  return mark;
}
