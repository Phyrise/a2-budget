/**
 * Saisie rapide du Calendrier : « dîner chez Léa samedi 20h » →
 * { title: « Dîner chez Léa », date: samedi prochain, time: « 20:00 »,
 * kind: « repas » }. Pur, sans dépendance (testé par quickParse.check.mjs,
 * `node apps/web/src/features/calendar/quickParse.check.mjs`).
 *
 * Le résultat ne fait que PRÉ-REMPLIR la feuille d'ajout : l'utilisateur
 * relit et valide. Rien d'ambigu n'est deviné : un mot non reconnu reste
 * dans le titre.
 *
 * Reconnus (accents et majuscules indifférents) :
 * - jours : aujourd'hui, ce soir, ce midi, demain, après-demain, lundi…
 *   dimanche (« samedi prochain » = le prochain samedi ; le jour même compte
 *   pour aujourd'hui), « le 12 », « 12 octobre (2027) », « 1er mai »,
 *   « 12/10(/2027) » ;
 * - heures : « 20h », « 20 h 30 », « 20:30 », « à midi », plages « de 14h à
 *   16h », « 14h-16h » ;
 * - nature par mots-clés (dîner → repas, ciné → sortie, dentiste → rdv…).
 */
export type QuickKind = 'repas' | 'sortie' | 'anniversaire' | 'rdv' | 'voyage' | 'maison' | 'autre';

export interface QuickParse {
  /** Titre nettoyé (initiale en capitale), '' si rien ne reste. */
  title: string;
  /** Jour « YYYY-MM-DD » reconnu. */
  date?: string;
  /** Heure de début « HH:MM ». */
  time?: string;
  /** Heure de fin « HH:MM ». */
  endTime?: string;
  kind?: QuickKind;
}

const MONTHS: ReadonlyArray<readonly [number, RegExp]> = [
  [1, /^janv(?:ier)?$/],
  [2, /^fevr?(?:ier)?$/],
  [3, /^mars$/],
  [4, /^avr(?:il)?$/],
  [5, /^mai$/],
  [6, /^juin$/],
  [7, /^juil(?:let)?$/],
  [8, /^aout$/],
  [9, /^sept(?:embre)?$/],
  [10, /^oct(?:obre)?$/],
  [11, /^nov(?:embre)?$/],
  [12, /^dec(?:embre)?$/],
];
const MONTH_WORD = 'janv(?:ier)?|fevr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|aout|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|dec(?:embre)?';
const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const KIND_WORDS: ReadonlyArray<readonly [QuickKind, RegExp]> = [
  ['anniversaire', /\banniv/],
  ['repas', /\b(?:diner|dejeuner|dej|petit[- ]dej\w*|brunch|repas|apero|aperitif|resto|restaurant|pique[- ]nique|barbecue|bbq|raclette|fondue|gouter|souper)\b/],
  ['rdv', /\b(?:rdv|rendez[- ]vous|medecin|docteur|dentiste|kine|osteo|ophtalmo|gyneco|pediatre|veto|veterinaire|coiffeur|banque|notaire|reunion|entretien|vaccin)\b/],
  ['voyage', /\b(?:voyage|vacances|week[- ]?end|train|vol|avion|aeroport|sejour|depart|gare)\b/],
  ['sortie', /\b(?:cinema|cine|concert|theatre|expo|exposition|musee|balade|promenade|randonnee|rando|spectacle|match|soiree|fete|bar|festival|opera|karaoke|bowling|piscine|plage)\b/],
  ['maison', /\b(?:menage|plombier|electricien|livraison|travaux|bricolage|jardinage|demenagement|artisan|chaudiere|ramonage|courses)\b/],
];

/** Plie la casse et les accents caractère par caractère (longueur UTF-16 conservée). */
function foldKeepingLength(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += base.length === ch.length ? base : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }
  return out.replace(/[’‘]/g, "'");
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function atDay(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
}

/** Date valide (pas de 31 février) ou null. */
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  return d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

function timeKey(h: number, m: number): string | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** Interprète « 20h30 », « 20 h », « 20:30 », « midi ». */
function readTime(raw: string): string | null {
  const t = raw.trim();
  if (t === 'midi') return '12:00';
  if (t === 'minuit') return '00:00';
  const m = /^(\d{1,2})\s*(?:h(?:eures?)?|:)\s*(\d{2})?$/.exec(t);
  if (!m) return null;
  return timeKey(Number(m[1]), m[2] === undefined ? 0 : Number(m[2]));
}

const TIME = String.raw`(?:\d{1,2}\s*h(?:eures?)?(?:\s*\d{2})?|\d{1,2}:\d{2}|midi|minuit)`;

export function quickParse(input: string, now: Date): QuickParse {
  const original = input.slice(0, 200);
  let folded = foldKeepingLength(original);
  const consumed = new Array<boolean>(original.length).fill(false);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /** Première correspondance encore libre ; la consomme (texte retiré du titre). */
  const take = (pattern: RegExp): RegExpExecArray | null => {
    const re = new RegExp(pattern.source, 'gu');
    let m: RegExpExecArray | null;
    while ((m = re.exec(folded)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      if (consumed.slice(start, end).some(Boolean)) continue;
      for (let i = start; i < end; i += 1) consumed[i] = true;
      folded = folded.slice(0, start) + ' '.repeat(end - start) + folded.slice(end);
      return m;
    }
    return null;
  };

  const result: QuickParse = { title: '' };

  // Nature d'abord (lecture seule : les mots restent dans le titre).
  for (const [kind, re] of KIND_WORDS) {
    if (re.test(folded)) {
      result.kind = kind;
      break;
    }
  }

  // Plages horaires, puis heure seule.
  const range = take(new RegExp(String.raw`(?:\bde\s+|\bentre\s+)?\b(${TIME})\s*(?:-|–|\ba\b|\bet\b|jusqu'a)\s*(${TIME})\b`));
  if (range) {
    const start = readTime(range[1]!);
    const end = readTime(range[2]!);
    if (start) result.time = start;
    if (start && end && end !== start) result.endTime = end;
  } else {
    const single = take(new RegExp(String.raw`(?:\b(?:a|vers|des)\s+)?\b(${TIME})(?![\w/])`));
    if (single) {
      const t = readTime(single[1]!);
      if (t) result.time = t;
    }
  }

  // Jours.
  let date: Date | null = null;
  const named = take(new RegExp(String.raw`\b(?:le\s+)?(1er|\d{1,2})\s+(${MONTH_WORD})\.?(?:\s+(\d{4}))?\b`));
  if (named) {
    const day = named[1] === '1er' ? 1 : Number(named[1]);
    const month = MONTHS.find(([, re]) => re.test(named[2]!))?.[0] ?? 0;
    if (named[3]) {
      date = makeDate(Number(named[3]), month, day);
    } else {
      date = makeDate(today.getFullYear(), month, day);
      if (date && date < today) date = makeDate(today.getFullYear() + 1, month, day);
    }
  }
  if (!date) {
    const numeric = take(/\b(?:le\s+)?(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?\b/);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      if (numeric[3]) {
        const y = Number(numeric[3]);
        date = makeDate(y < 100 ? 2000 + y : y, month, day);
      } else {
        date = makeDate(today.getFullYear(), month, day);
        if (date && date < today) date = makeDate(today.getFullYear() + 1, month, day);
      }
    }
  }
  if (!date) {
    const rel = take(/\b(aujourd'hui|ce\s+soir|ce\s+midi|ce\s+matin|cet\s+apres[- ]midi|apres[- ]demain|demain)(?:\s+(soir|midi|matin|apres[- ]midi))?\b/);
    if (rel) {
      const word = rel[1]!.replace(/\s+/g, ' ');
      date = atDay(today, word === 'demain' ? 1 : word.startsWith('apres') ? 2 : 0);
      if ((word === 'ce midi' || rel[2] === 'midi') && result.time === undefined) result.time = '12:00';
    }
  }
  const weekdayPattern = new RegExp(String.raw`\b(?:(?:ce|le)\s+)?(${WEEKDAYS.join('|')})(\s+prochain)?(?:\s+(soir|midi|matin|apres[- ]midi))?\b`);
  if (date) {
    // « samedi 10 octobre » : le jour de la semaine est redondant, on le retire du titre.
    take(weekdayPattern);
  } else {
    const wd = take(weekdayPattern);
    if (wd) {
      const iso = WEEKDAYS.indexOf(wd[1]!) + 1;
      const todayIso = ((today.getDay() + 6) % 7) + 1;
      let delta = (iso - todayIso + 7) % 7;
      // « samedi prochain » : le prochain samedi (la semaine d'après si c'est aujourd'hui).
      if (wd[2] && delta === 0) delta = 7;
      date = atDay(today, delta);
      if (wd[3] === 'midi' && result.time === undefined) result.time = '12:00';
    }
  }
  if (!date) {
    const dayOnly = take(/\ble\s+(1er|\d{1,2})\b(?!\s*(?:h|:|\/|\.\d))/);
    if (dayOnly) {
      const day = dayOnly[1] === '1er' ? 1 : Number(dayOnly[1]);
      date = makeDate(today.getFullYear(), today.getMonth() + 1, day);
      if (date && date < today) {
        const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        date = makeDate(next.getFullYear(), next.getMonth() + 1, day);
      }
    }
  }
  if (date) result.date = keyOf(date);

  // Titre : ce qui n'a pas été consommé, sans prépositions orphelines.
  let title = '';
  for (let i = 0; i < original.length; i += 1) title += consumed[i] ? ' ' : original[i];
  const DANGLING = /^(?:a|à|le|la|les|de|du|des|pour|vers|ce|cette|et|,|-|–|—|:)$/iu;
  const words = title.split(/\s+/).filter(Boolean);
  while (words.length > 0 && DANGLING.test(words[words.length - 1]!)) words.pop();
  while (words.length > 0 && DANGLING.test(words[0]!) && !/^(?:le|la|les)$/iu.test(words[0]!)) words.shift();
  title = words.join(' ').replace(/\s+([,.])/g, '$1').replace(/[,\s]+$/u, '');
  result.title = title.charAt(0).toUpperCase() + title.slice(1);
  return result;
}
