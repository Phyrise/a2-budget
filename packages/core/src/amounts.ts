/**
 * Montants : constantes de plage, analyse de saisie, formatage.
 *
 * Unités : centimes d'euro entiers (CONTRACTS.md §1).
 */

/**
 * Montant maximal accepté : 1 milliard d'euros en centimes.
 * Garde tous les produits intermédiaires (cents × bps) sous Number.MAX_SAFE_INTEGER.
 */
export const MAX_AMOUNT_CENTS = 100_000_000_000;

/** Taux maximal accepté : 100 % en points de base. */
export const MAX_RATE_BPS = 10_000;

/** Résultat de l'analyse d'une saisie de montant. */
export type ParseAmountResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'too-many-decimals' | 'out-of-range' };

const SPACE_CHARS = new Set([' ', '\u00a0', '\u202f']);

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

/**
 * Analyse déterministe d'une saisie utilisateur vers des centimes.
 *
 * Accepte les notations fr-FR et en-US : « 1 234,56 », « 1234.56 »,
 * « 1 234,56 € », espaces français habituels lors d'un collage
 * (espace normale, insécable U+00A0, fine insécable U+202F).
 * Rejette (sans tronquer silencieusement) : chaîne vide, saisie ambiguë
 * (ex. « 1,234 » : séparateur de milliers ou trois décimales ?), plus de
 * deux décimales, valeur négative, valeur > MAX_AMOUNT_CENTS.
 * Un zéro saisi explicitement est valide.
 */
export function parseAmountInput(raw: string): ParseAmountResult {
  let s = raw.trim();
  if (s === '') return { ok: false, reason: 'empty' };

  // Un symbole monétaire unique, en début ou en fin de chaîne.
  if (s.startsWith('€')) s = s.slice(1);
  if (s.endsWith('€')) s = s.slice(0, -1);
  s = s.trim();
  if (s === '') return { ok: false, reason: 'empty' };

  // Signe explicif : négatif interdit, positif non attendu.
  if (s.includes('-') || s.includes('+')) return { ok: false, reason: 'invalid' };

  // Caractères autorisés : chiffres, espaces (milliers), ',' et '.'.
  for (const ch of s) {
    if ((ch >= '0' && ch <= '9') || ch === ',' || ch === '.' || SPACE_CHARS.has(ch)) continue;
    return { ok: false, reason: 'invalid' };
  }

  // Séparateur décimal : la DERNIÈRE occurrence de ',' ou '.' (s'il y en a).
  let decIdx = -1;
  let decSep = '';
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s.charAt(i);
    if (ch === ',' || ch === '.') {
      decIdx = i;
      decSep = ch;
      break;
    }
  }

  let intPart = decIdx === -1 ? s : s.slice(0, decIdx);
  let decPart = decIdx === -1 ? '' : s.slice(decIdx + 1);

  // Séparateur décimal sans chiffres après (« 1 234, ») → invalide.
  if (decIdx !== -1 && decPart === '') return { ok: false, reason: 'invalid' };
  if (decPart !== '' && !/^\d+$/.test(decPart)) {
    return { ok: false, reason: 'invalid' };
  }

  const decSepCount = decSep === '' ? 0 : s.split(decSep).length - 1;
  let totalSepCount = 0;
  for (const ch of s) {
    if (ch === ',' || ch === '.' || SPACE_CHARS.has(ch)) totalSepCount++;
  }

  if (decPart.length === 3) {
    if (decSepCount >= 2) {
      // Le séparateur est un séparateur de milliers, pas un décimal :
      // « 1,234,567 » / « 1.234.567 » → entier.
      intPart = s;
      decPart = '';
    } else if (intPart !== '' && totalSepCount === 1) {
      // « 1,234 » / « 1.234 » : ambigu (milliers ou 3 décimales) → rejet.
      return { ok: false, reason: 'invalid' };
    }
  }
  if (decPart.length > 2) return { ok: false, reason: 'too-many-decimals' };

  const digits = validateIntegerPart(intPart);
  if (digits === null) return { ok: false, reason: 'invalid' };
  if (digits.length > 12) return { ok: false, reason: 'out-of-range' };

  const intVal = digits === '' ? 0 : Number(digits);
  const cents =
    intVal * 100 +
    (decPart.length === 2
      ? Number(decPart)
      : decPart.length === 1
        ? Number(decPart) * 10
        : 0);

  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_AMOUNT_CENTS) {
    return { ok: false, reason: 'out-of-range' };
  }
  return { ok: true, cents };
}

/**
 * Valide la partie entière (chiffres + éventuels séparateurs de milliers
 * homogènes : espaces, ',' ou '.'). Retourne les chiffres concaténés,
 * '' si la partie est vide, ou null si la forme est invalide.
 */
function validateIntegerPart(part: string): string | null {
  if (part === '') return '';
  const seps = new Set<string>();
  for (const ch of part) {
    if (ch >= '0' && ch <= '9') continue;
    if (ch === ',' || ch === '.' || SPACE_CHARS.has(ch)) {
      seps.add(ch);
    } else {
      return null;
    }
  }
  if (seps.size === 0) return /^\d+$/.test(part) ? part : null;
  if (seps.size > 1) return null; // séparateurs mélangés
  const sep = seps.values().next().value as string;
  const re = new RegExp(`^\\d{1,3}(?:${escapeRegExp(sep)}\\d{3})+$`);
  if (!re.test(part)) return null;
  return part.split(sep).join('');
}

function escapeRegExp(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Formate des centimes en EUR fr-FR : 123456 → « 1 234,56 € ».
 * Basé sur Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).
 */
export function formatCents(cents: number): string {
  return eurFormatter.format(cents / 100);
}
