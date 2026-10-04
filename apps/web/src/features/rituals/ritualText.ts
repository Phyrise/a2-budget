/**
 * Textes et petits calculs d'affichage des rituels (aucune logique métier :
 * le domaine reste dans @a2/core). Typographie française : espaces
 * insécables avant « : ; ? ! » et dans les guillemets.
 */
import { addDays, isoWeekday, localDateKey, weekStartKey } from '@a2/core';

export const NB = ' ';

export type Person = 'a' | 'b';
export interface Names {
  a: string;
  b: string;
}

export function other(p: Person): Person {
  return p === 'a' ? 'b' : 'a';
}

/** Libellé de qui (AL, AC, ensemble). */
export function whoLabel(who: 'a' | 'b' | 'both', names: Names): string {
  return who === 'both' ? 'Ensemble' : names[who];
}

/**
 * Semaine « du cercle » : le lundi, on clôt encore la semaine qui vient de
 * s'achever ; les autres jours, la semaine en cours. Renvoie une date de
 * référence dans cette semaine (pour les suggestions) et son lundi.
 */
export function ritualWeek(today: Date): { ref: Date; weekStart: string } {
  const ref = isoWeekday(today) === 1 ? addDays(today, -1) : today;
  return { ref, weekStart: weekStartKey(ref) };
}

/** Du vendredi au lundi : le moment naturel du cercle. */
export function isCircleWindow(today: Date): boolean {
  const d = isoWeekday(today);
  return d >= 5 || d === 1;
}

export function weekLabel(weekStart: string, today: Date): string {
  const current = weekStartKey(today);
  if (weekStart === current) return 'Cette semaine';
  if (weekStart === weekStartKey(addDays(today, -7))) return 'La semaine dernière';
  const d = new Date(`${weekStart}T12:00:00`);
  return `Semaine du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
}

export function todayKey(today: Date): string {
  return localDateKey(today);
}

// ---------------------------------------------------------------------------
// Nombres en toutes lettres (souvenirs du carnet : jamais un score)
// ---------------------------------------------------------------------------

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n: number): string {
  if (n <= 16) return UNITS[n]!;
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t]!;
    return u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${below100(n - 60)}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${below100(n - 80)}`;
}

/** 0..9999 en lettres (orthographe traditionnelle) ; au-delà, chiffres. */
export function numberWords(n: number, feminine = false): string {
  const v = Math.floor(Math.abs(n));
  if (v >= 10000) return v.toLocaleString('fr-FR');
  let out: string;
  if (v < 100) out = below100(v);
  else if (v < 1000) {
    const h = Math.floor(v / 100);
    const r = v % 100;
    const head = h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 ? 's' : ''}`;
    out = r === 0 ? head : `${head} ${below100(r)}`;
  } else {
    const k = Math.floor(v / 1000);
    const r = v % 1000;
    const head = k === 1 ? 'mille' : `${numberWords(k)} mille`;
    out = r === 0 ? head : `${head} ${numberWords(r)}`;
  }
  if (feminine) out = out.replace(/(^|[\s-])un$/, '$1une');
  return out;
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « une lanterne », « trois lanternes »… */
export function countWords(n: number, singular: string, pluralForm: string, feminine = false): string {
  return `${numberWords(n, feminine)} ${n > 1 ? pluralForm : singular}`;
}

/** 135 → « deux heures et quart » ; 40 → « quarante minutes ». */
export function durationWords(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return countWords(m, 'minute', 'minutes', true);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hours = countWords(h, 'heure', 'heures', true);
  if (r === 0) return hours;
  if (r === 15) return `${hours} et quart`;
  if (r === 30) return `${hours} et demie`;
  return `${hours} et ${countWords(r, 'minute', 'minutes', true)}`;
}

/** « 7:05 » (minutes:secondes) pour l'anneau de la lanterne. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** « 7 minutes restantes » (lecteurs d'écran, sans les secondes). */
export function remainingWords(ms: number): string {
  const m = Math.ceil(ms / 60000);
  if (m <= 1) return 'moins d’une minute restante';
  return `${m}${NB}minutes restantes`;
}
