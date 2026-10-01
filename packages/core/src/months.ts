/**
 * Mois : clé « YYYY-MM » dans le fuseau local, validation, comparaison,
 * libellé français.
 */

const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

const monthLabeler = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

/** Mois courant « YYYY-MM » dans le fuseau local de l'utilisateur (jamais UTC). */
export function currentMonthKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Vrai pour une clé « YYYY-MM » bien formée avec un mois calendrier valide. */
export function isValidMonthKey(key: string): boolean {
  const m = MONTH_KEY_RE.exec(key);
  if (m === null) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

/** Comparaison chronologique de deux clés de mois (zéro-padding → lexicales). */
export function compareMonthKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Libellé français : « 2026-10 » → « Octobre 2026 ». */
export function monthKeyToLabel(key: string): string {
  if (!isValidMonthKey(key)) {
    throw new RangeError(`invalid month key: ${String(key)}`);
  }
  const m = MONTH_KEY_RE.exec(key)!;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const label = monthLabeler.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
