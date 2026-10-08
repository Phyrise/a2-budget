/**
 * V5.1 — quêtes communes : de petits gestes à deux, jamais annoncés.
 *
 * Un objet apparaît certains jours dans un onglet (un rocher qui bloque une
 * Noiraude au Budget, un petit trésor à moitié enterré aux Courses, une pousse
 * à arroser au Calendrier). Chacun le touche une fois ; quand les deux l'ont
 * touché LE MÊME JOUR, la quête est réglée (petite fête, +3 kompeitō chacun,
 * une trace dans le Carnet). Pas réglée dans la journée : elle s'efface, sans
 * reproche, et une autre reviendra un autre jour.
 *
 * - Calendrier déterministe (`scheduledQuest`) : ≈ 1 à 2 par semaine, tiré de
 *   la date seule ; les deux téléphones calculent la même chose. Une quête
 *   n'est écrite (partagée) qu'au premier toucher, avec un id déterministe
 *   (`jour-type`) : les deux peuvent la créer sans doublon.
 * - `helpers` : rôle → heure du toucher (ISO). Réglée = les deux aides ;
 *   `doneAt` est posé par le second quand il le voit (informatif).
 * - Jamais plus d'une à la fois (`questOfDay`).
 * Pur, sans horloge cachée.
 */

import { addDays, isValidLocalDateKey, localDateKey, parseLocalDateKey, startOfWeek } from './dates.js';
import { isIsoTimestamp, isPerson, isPlainObject, type Fail, type Ok } from './validationHelpers.js';

export type QuestKind = 'rocher' | 'tresor' | 'pousse';
export type QuestTab = 'budget' | 'courses' | 'calendar';
export type QuestRole = 'a' | 'b';

export const QUEST_KINDS: readonly QuestKind[] = ['rocher', 'tresor', 'pousse'];
/** Où vit chaque quête (onglet / univers). */
export const QUEST_TAB: Readonly<Record<QuestKind, QuestTab>> = { rocher: 'budget', tresor: 'courses', pousse: 'calendar' };
/** Emplacements possibles dans la fenêtre sur le monde. */
export const QUEST_SPOTS = 3;
/** Kompeitō pour chacun, quête réglée. */
export const QUEST_GIFT = 3;
/** Quêtes gardées (les plus récentes). */
export const QUESTS_MAX = 200;

export interface SharedQuest {
  /** `YYYY-MM-DD-type` (ou `…-type-dXXXX` pour une quête du mode développeur). */
  id: string;
  kind: QuestKind;
  /** Jour local où elle se règle. */
  day: string;
  tab: QuestTab;
  /** 0..QUEST_SPOTS-1. */
  spot: number;
  /** Rôle de qui l'a fait apparaître (premier toucher, ou mode développeur). */
  createdBy: QuestRole;
  /** Qui a aidé, et quand (ISO). */
  helpers: Partial<Record<QuestRole, string>>;
  /** Réglée (informatif : les deux aides suffisent). */
  doneAt?: string;
}

export interface QuestsState {
  items: SharedQuest[];
}

/** Statut d'une quête affichée. */
export type QuestStatus = 'waiting' | 'half' | 'done';

/** Hachage FNV-1a 32 bits (stable, sans dépendance). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Jours (0 = lundi … 6 = dimanche) des quêtes de la semaine qui commence ce lundi. */
export function questWeekdays(monday: string): number[] {
  const h = hash(`quetes|${monday}`);
  const first = h % 7;
  if ((h >>> 8) % 5 < 2) return [first]; // ≈ 40 % des semaines : une seule
  const second = (first + 2 + ((h >>> 12) % 4)) % 7; // jamais deux jours de suite
  return [first, second].sort((x, y) => x - y);
}

/** Quête prévue ce jour (null : pas de quête). Pur et déterministe. */
export function scheduledQuest(day: string): Omit<SharedQuest, 'createdBy' | 'helpers'> | null {
  if (!isValidLocalDateKey(day)) return null;
  const date = parseLocalDateKey(day);
  const monday = startOfWeek(date);
  const weekday = Math.round((date.getTime() - monday.getTime()) / 86_400_000);
  if (!questWeekdays(localDateKey(monday)).includes(weekday)) return null;
  const h = hash(`quete|${day}`);
  const kind = QUEST_KINDS[h % QUEST_KINDS.length]!;
  return { id: `${day}-${kind}`, kind, day, tab: QUEST_TAB[kind], spot: (h >>> 8) % QUEST_SPOTS };
}

/** Jours de quête entre deux jours inclus (calendrier, tests). */
export function questDaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = parseLocalDateKey(from); localDateKey(d) <= to; d = addDays(d, 1)) {
    const key = localDateKey(d);
    if (scheduledQuest(key) !== null) out.push(key);
  }
  return out;
}

export function isQuestDone(q: Pick<SharedQuest, 'helpers'>): boolean {
  return q.helpers.a !== undefined && q.helpers.b !== undefined;
}

export function questStatus(q: Pick<SharedQuest, 'helpers'>): QuestStatus {
  if (isQuestDone(q)) return 'done';
  return q.helpers.a !== undefined || q.helpers.b !== undefined ? 'half' : 'waiting';
}

/**
 * La quête du jour (au plus une) : la dernière écrite pour ce jour qui reste
 * à régler ; sinon la dernière réglée du jour (pour la fête) ; sinon, avec
 * `scheduled`, celle du calendrier (pas encore écrite). Pur.
 */
export function questOfDay(
  items: readonly SharedQuest[] | undefined,
  day: string,
  opts: { scheduled: boolean },
): SharedQuest | null {
  const today = (items ?? []).filter((q) => q.day === day);
  const open = [...today].reverse().find((q) => !isQuestDone(q));
  if (open !== undefined) return open;
  const done = today[today.length - 1];
  if (done !== undefined) return done;
  if (!opts.scheduled) return null;
  const s = scheduledQuest(day);
  return s === null ? null : { ...s, createdBy: 'a', helpers: {} };
}

/** Quête du mode développeur : aujourd'hui, type au choix, id unique. */
export function devQuest(kind: QuestKind, day: string, role: QuestRole, suffix: string): SharedQuest {
  const clean = suffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || '0';
  return { id: `${day}-${kind}-d${clean}`, kind, day, tab: QUEST_TAB[kind], spot: hash(clean) % QUEST_SPOTS, createdBy: role, helpers: {} };
}

/** Ajoute une quête (mode développeur). Inchangé si l'id existe déjà. */
export function addQuest(items: readonly SharedQuest[], quest: SharedQuest): SharedQuest[] {
  if (items.some((q) => q.id === quest.id)) return items as SharedQuest[];
  return [...items, quest].slice(-QUESTS_MAX);
}

/**
 * Le toucher de `role` sur `quest` (du jour `today` seulement) : l'écrit au
 * besoin, pose son aide (une fois) et `doneAt` si l'autre avait déjà aidé.
 * Même tableau si rien ne change. Pur.
 */
export function helpQuest(
  items: readonly SharedQuest[],
  quest: SharedQuest,
  role: QuestRole,
  now: Date,
): SharedQuest[] {
  if (quest.day !== localDateKey(now)) return items as SharedQuest[];
  const at = now.toISOString();
  const stored = items.find((q) => q.id === quest.id);
  if (stored === undefined) {
    return [...items, { ...quest, createdBy: role, helpers: { [role]: at } }].slice(-QUESTS_MAX);
  }
  if (stored.helpers[role] !== undefined) return items as SharedQuest[];
  const helpers = { ...stored.helpers, [role]: at };
  const next: SharedQuest = { ...stored, helpers };
  if (isQuestDone(next) && next.doneAt === undefined) next.doneAt = at;
  return items.map((q) => (q.id === stored.id ? next : q));
}

/** Quêtes réglées, de la plus ancienne à la plus récente (Carnet « À deux »). */
export function doneQuests(items: readonly SharedQuest[] | undefined): SharedQuest[] {
  return (items ?? []).filter(isQuestDone).sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
}

function validateQuest(value: unknown): SharedQuest | null {
  if (!isPlainObject(value)) return null;
  const { id, kind, day, tab, spot, createdBy, helpers, doneAt } = value;
  if (typeof id !== 'string' || id.length < 12 || id.length > 64) return null;
  if (!QUEST_KINDS.includes(kind as QuestKind) || tab !== QUEST_TAB[kind as QuestKind]) return null;
  if (typeof day !== 'string' || !isValidLocalDateKey(day) || !id.startsWith(`${day}-`)) return null;
  if (typeof spot !== 'number' || !Number.isInteger(spot) || spot < 0 || spot >= QUEST_SPOTS) return null;
  if (!isPerson(createdBy) || !isPlainObject(helpers)) return null;
  const h: Partial<Record<QuestRole, string>> = {};
  for (const [k, v] of Object.entries(helpers)) {
    if (!isPerson(k) || !isIsoTimestamp(v)) return null;
    h[k] = v;
  }
  if (doneAt !== undefined && !isIsoTimestamp(doneAt)) return null;
  return {
    id, kind: kind as QuestKind, day, tab: tab as QuestTab, spot, createdBy, helpers: h,
    ...(doneAt !== undefined ? { doneAt } : {}),
  };
}

/** Validation à l'exécution (AppState.quests). Ne lève jamais d'exception. */
export function validateQuests(value: unknown): Ok<QuestsState> | Fail {
  if (!isPlainObject(value) || !Array.isArray(value.items)) return { ok: false, reason: 'quests-invalid' };
  const items: SharedQuest[] = [];
  const seen = new Set<string>();
  for (const raw of value.items) {
    const q = validateQuest(raw);
    if (q === null) return { ok: false, reason: 'quests-item-invalid' };
    if (seen.has(q.id)) return { ok: false, reason: 'quests-duplicate-id' };
    seen.add(q.id);
    items.push(q);
  }
  return { ok: true, state: { items: items.slice(-QUESTS_MAX) } };
}
