/**
 * Rituels (V3) : le cercle de la semaine — merci → ce qui pèse → ajuster.
 *
 * Un cercle par semaine ISO (identifiée par son lundi). Rien n'est jamais
 * noté ni comparé : ce sont des mots échangés, gardés en mémoire.
 * Fonctions pures.
 */

import { mergeWeek, normalizeCircle, trimCircles, weekRecords } from './circleParts.js';
import { isoWeekday, isValidLocalDateKey, parseLocalDateKey } from './dates.js';
import { weekStartKey } from './occurrences.js';
import { completionsOfWeek, whoDid } from './tasks.js';
import type { ChoreCompletion, Circle, HouseholdTask, RitualsState } from './types.js';

export { CIRCLE_TEXT_MAX, CIRCLES_MAX } from './circleParts.js';

const NB = ' ';

/** Vrai si la clé « YYYY-MM-DD » est valide et tombe un lundi. */
export function isWeekStartKey(key: unknown): key is string {
  return typeof key === 'string' && isValidLocalDateKey(key) && isoWeekday(parseLocalDateKey(key)) === 1;
}

/**
 * Enregistre le cercle tenu à deux pour sa semaine : remplace tout ce que
 * la semaine contenait (cercle et parts), sinon l'ajoute (tri par semaine
 * croissante, au plus CIRCLES_MAX semaines). Textes nettoyés (espaces
 * réduits, ≤ CIRCLE_TEXT_MAX), entrées vides retirées. Lève une RangeError
 * si `weekStart` n'est pas un lundi valide, `heldAt` pas un horodatage ISO,
 * ou une personne inconnue. Pur. Une part (`author`) : voir saveCirclePart.
 */
export function saveCircle(rituals: RitualsState | undefined, circle: Circle): RitualsState {
  const { author: _author, ...together } = circle;
  const saved = normalizeCircle(together);
  const others = (rituals?.circles ?? []).filter((c) => c.weekStart !== saved.weekStart);
  return { circles: trimCircles([...others, saved]) };
}

/**
 * Cercle de la semaine contenant `date` (Date, ou clé « YYYY-MM-DD » de
 * n'importe quel jour de la semaine), ou null. Cercle à deux et parts sont
 * fusionnés en une seule vue (voir mergeWeek).
 */
export function circleForWeek(rituals: RitualsState | undefined, date: Date | string): Circle | null {
  let weekStart: string;
  try {
    weekStart = weekStartKey(typeof date === 'string' ? parseLocalDateKey(date) : date);
  } catch {
    return null;
  }
  return mergeWeek(weekRecords(rituals, weekStart));
}

// ---------------------------------------------------------------------------
// Suggestions de merci
// ---------------------------------------------------------------------------

/** Participes passés irréguliers (verbes courants des tâches ménagères). */
const IRREGULAR: Record<string, string> = {
  faire: 'fait', refaire: 'refait', défaire: 'défait', prendre: 'pris', reprendre: 'repris',
  mettre: 'mis', remettre: 'remis', descendre: 'descendu', rendre: 'rendu', tondre: 'tondu',
  étendre: 'étendu', attendre: 'attendu', répondre: 'répondu', ouvrir: 'ouvert', couvrir: 'couvert',
  dire: 'dit', écrire: 'écrit', lire: 'lu', voir: 'vu', revoir: 'revu', recevoir: 'reçu',
  cuire: 'cuit', conduire: 'conduit', courir: 'couru', tenir: 'tenu', entretenir: 'entretenu',
  sortir: 'sorti', resortir: 'resorti', servir: 'servi', battre: 'battu', boire: 'bu',
};
/** Verbes en -er/-ir qui ne se conjuguent pas avec « avoir » ici. */
const EXCLUDED = new Set(['aller', 'venir', 'partir', 'revenir']);

/**
 * « Sortir les poubelles » → « sorti les poubelles » (participe passé de
 * l'infinitif initial), ou null si le titre ne commence pas par un verbe
 * reconnaissable (on retombe alors sur une formule neutre).
 */
export function pastParticiplePhrase(title: string): string | null {
  const trimmed = title.trim();
  const match = /^(\p{L}+)(.*)$/u.exec(trimmed);
  if (match === null) return null;
  const verb = match[1]!.toLowerCase();
  const rest = match[2]!;
  if (/^['’]/.test(rest) || EXCLUDED.has(verb)) return null;
  let pp: string | undefined = IRREGULAR[verb];
  if (pp === undefined && verb.length > 3 && verb.endsWith('er')) pp = `${verb.slice(0, -2)}é`;
  if (pp === undefined && verb.length > 3 && verb.endsWith('ir')) pp = `${verb.slice(0, -2)}i`;
  if (pp === undefined) return null;
  return `${pp}${rest}`;
}

/**
 * Phrases de merci (au plus `max`, défaut 5) que `from` peut adresser à
 * l'autre, tirées des faits de la semaine ISO de `now` faits par l'autre
 * (« Merci d'avoir sorti les poubelles 3 fois cette semaine ») ou ensemble
 * (« Merci d'avoir fait la vaisselle avec moi »). Les tâches les plus
 * lourdes et les plus fréquentes d'abord. Jamais de reproche, jamais de
 * comparaison. Vide si l'autre n'a rien fait cette semaine.
 */
export function gratitudeSuggestions(
  tasks: HouseholdTask[],
  completions: ChoreCompletion[],
  now: Date,
  from: 'a' | 'b',
  max = 5,
): string[] {
  const to = from === 'a' ? 'b' : 'a';
  const effortOf = new Map(tasks.map((t) => [t.id, t.effort ?? 1]));
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  const groups = new Map<string, { title: string; together: boolean; count: number; effort: number; last: string }>();
  for (const c of completionsOfWeek(completions, now)) {
    const who = whoDid(c);
    if (who !== to && who !== 'both') continue;
    const together = who === 'both';
    const key = `${c.taskId}|${together ? 'both' : 'solo'}`;
    const g = groups.get(key);
    if (g === undefined) {
      groups.set(key, {
        title: titleOf.get(c.taskId) ?? c.taskTitle,
        together,
        count: 1,
        effort: effortOf.get(c.taskId) ?? 1,
        last: c.completedAt,
      });
    } else {
      g.count += 1;
      if (c.completedAt > g.last) g.last = c.completedAt;
    }
  }
  return [...groups.values()]
    .sort((x, y) => y.count * y.effort - x.count * x.effort || (y.last > x.last ? 1 : y.last < x.last ? -1 : 0))
    .slice(0, Math.max(0, Math.floor(max)))
    .map(({ title, together, count }) => {
      const pp = pastParticiplePhrase(title);
      const when = count >= 2 ? ` ${count}${NB}fois cette semaine` : ' cette semaine';
      if (together) {
        return pp !== null ? `Merci d'avoir ${pp} avec moi` : `Merci d'avoir fait «${NB}${title}${NB}» avec moi`;
      }
      return pp !== null ? `Merci d'avoir ${pp}${when}` : `Merci pour «${NB}${title}${NB}»${when}`;
    });
}
