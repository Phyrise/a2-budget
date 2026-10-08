/**
 * projectState : documents → AppState (docs/SYNC_DESIGN.md §3.1–3.2). Pur.
 *
 * - Objets supprimés (`deletedAt`) écartés ; listes triées par `(order, id)`.
 * - Faits : seuls les vivants sont projetés (complétions et passages
 *   dédoublonnés par occurrence) ; plafonds de @a2/core appliqués.
 * - Forêt = rejeu (dernier point de reprise + faits) relevé aux jalons.
 * - `selectedMonth` vient du téléphone (jamais des documents).
 * - Le résultat passe par `validateAppState`. En cas d'échec, chaque document
 *   est éprouvé seul : un document invalide est ignoré et signalé (`issues`),
 *   jamais propagé. Une liste vide vaut « absente ».
 */

import {
  applyMilestones,
  BALANCE_CORRECTIONS_MAX,
  trimCircles,
  compareOrdered,
  defaultSettings,
  emptyMilestones,
  FOCUS_SESSIONS_MAX,
  GROCERY_HISTORY_MAX,
  latestCheckpoint,
  liveCompletions,
  liveFacts,
  liveSkips,
  localDateKey,
  monthFromDoc,
  replayForest,
  settingsFromDoc,
  validateAppState,
  validateMilestones,
  type AppState,
  type Circle,
  type CompletionFact,
  type ForestCheckpoint,
  type ForestEventFact,
  type FocusFact,
  type PurchaseFact,
  type SkipFact,
} from '@a2/core';
import {
  COLLECTIONS,
  docsOf,
  isPlainRecord,
  META_MILESTONES,
  SETTINGS_ANNIVERSARIES,
  SETTINGS_BUDGET,
  SETTINGS_FOCUS,
  SETTINGS_GROCERY_MEMORY,
  stripMeta,
  type CollectionName,
  type DocData,
  type DocStore,
} from './docs';

export interface ProjectOptions {
  /** Mois affiché sur CE téléphone (préférence locale). */
  selectedMonth: string;
  /** Maintenant (jour local du rejeu de la forêt). */
  today: Date;
}

export type ProjectResult =
  | { ok: true; state: AppState; issues: string[] }
  | { ok: false; issues: string[] };

interface Row {
  id: string;
  data: DocData;
}

type Parts = Map<CollectionName, Row[]>;

function rank(data: DocData): number {
  return typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0;
}

function partsOf(docs: DocStore): Parts {
  const parts: Parts = new Map();
  for (const collection of COLLECTIONS) {
    const rows = docsOf(docs, collection).map(([id, data]) => ({ id, data }));
    rows.sort((x, y) => compareOrdered({ id: x.id, order: rank(x.data) }, { id: y.id, order: rank(y.data) }));
    parts.set(collection, rows);
  }
  return parts;
}

function objects(parts: Parts, c: CollectionName): DocData[] {
  return (parts.get(c) ?? []).filter((r) => r.data.deletedAt === undefined).map((r) => stripMeta(r.data));
}

/** Faits d'une collection (annulés compris) ; l'id est celui du document. */
function facts<T>(parts: Parts, c: CollectionName): T[] {
  return (parts.get(c) ?? []).map((r) => ({ ...stripMeta(r.data), id: r.id }) as T);
}

function single(parts: Parts, c: CollectionName, id: string): DocData | undefined {
  const row = (parts.get(c) ?? []).find((r) => r.id === id);
  return row === undefined ? undefined : stripMeta(row.data);
}

function isCompletionFact(f: Partial<CompletionFact>): f is CompletionFact {
  return typeof f.id === 'string' && typeof f.taskId === 'string' && typeof f.dueDate === 'string' &&
    typeof f.completedAt === 'string' && typeof f.localDay === 'string' && typeof f.creditKey === 'string';
}

function isCheckpoint(c: DocData): boolean {
  return typeof c.day === 'string' && isPlainRecord(c.forest);
}

/**
 * Par semaine, un cercle à deux et une part par personne (V5.2) : en cas de
 * doublon (deux cercles à deux créés hors ligne), le plus récent (heldAt, puis id).
 */
function oneCirclePerWeek(circles: DocData[]): DocData[] {
  const best = new Map<string, DocData>();
  for (const c of circles) {
    const week = `${String(c.weekStart)}|${typeof c.author === 'string' ? c.author : ''}`;
    const seen = best.get(week);
    const key = (x: DocData) => `${String(x.heldAt)}|${String(x.id)}`;
    if (seen === undefined || key(c) > key(seen)) best.set(week, c);
  }
  const kept = new Set(best.values());
  return circles.filter((c) => kept.has(c));
}

function memoryFrom(doc: DocData | undefined): Record<string, unknown> | undefined {
  if (!isPlainRecord(doc?.memory)) return undefined;
  const entries = Object.entries(doc.memory)
    .filter((e): e is [string, { category: unknown; order: number }] =>
      isPlainRecord(e[1]) && typeof e[1].order === 'number' && e[1].category !== undefined)
    .sort((x, y) => compareOrdered({ id: x[0], order: x[1].order }, { id: y[0], order: y[1].order }));
  return entries.length === 0 ? undefined : Object.fromEntries(entries.map(([k, v]) => [k, v.category]));
}

function person(value: unknown): { id: unknown; name: unknown } {
  return isPlainRecord(value) ? { id: value.id, name: value.name } : { id: undefined, name: undefined };
}

/** Assemble un AppState brut (à valider) à partir des documents. */
function assemble(parts: Parts, opts: ProjectOptions): unknown {
  const budgetDoc = single(parts, 'settings', SETTINGS_BUDGET);
  const settings: Record<string, unknown> = budgetDoc === undefined
    ? { ...defaultSettings() }
    : settingsFromDoc(budgetDoc);
  const balanceTracked = settings.balanceTracked === true;
  delete settings.balanceTracked;
  const corrections = objects(parts, 'balanceCorrections').slice(-BALANCE_CORRECTIONS_MAX);
  const completionFacts = facts<Partial<CompletionFact>>(parts, 'completions').filter(isCompletionFact);
  const skips = liveSkips(facts<SkipFact>(parts, 'skips'));
  const sessions = liveFacts(facts<FocusFact>(parts, 'focusSessions')).slice(-FOCUS_SESSIONS_MAX);
  const history = liveFacts(facts<PurchaseFact>(parts, 'groceryHistory')).slice(0, GROCERY_HISTORY_MAX);
  const memory = memoryFrom(single(parts, 'settings', SETTINGS_GROCERY_MEMORY));
  const events = objects(parts, 'events');
  const circles = trimCircles(oneCirclePerWeek(objects(parts, 'circles')) as unknown as Circle[]);
  const lantern = single(parts, 'settings', SETTINGS_FOCUS)?.selectedLantern;
  const anniversaries = single(parts, 'settings', SETTINGS_ANNIVERSARIES);
  const checkpoints = objects(parts, 'checkpoints').filter(isCheckpoint) as unknown as ForestCheckpoint[];
  const milestones = validateMilestones(single(parts, 'meta', META_MILESTONES));
  const replayed = replayForest(
    latestCheckpoint(checkpoints),
    { completions: completionFacts, forestEvents: facts<ForestEventFact>(parts, 'forestEvents') },
    localDateKey(opts.today),
  );
  return {
    schemaVersion: 2,
    household: { people: [person(settings.personA), person(settings.personB)] },
    budget: {
      settings,
      months: objects(parts, 'months').map(monthFromDoc),
      selectedMonth: opts.selectedMonth,
      ...(balanceTracked || corrections.length > 0 ? { balance: { corrections } } : {}),
    },
    chores: {
      tasks: objects(parts, 'tasks'),
      completions: liveCompletions(completionFacts),
      ...(skips.length > 0 ? { skips } : {}),
    },
    forest: applyMilestones(replayed, milestones.ok ? milestones.state : emptyMilestones()),
    groceries: {
      items: objects(parts, 'groceries'),
      ...(history.length > 0 ? { history } : {}),
      ...(memory !== undefined ? { categoryMemory: memory } : {}),
    },
    ...(circles.length > 0 ? { rituals: { circles } } : {}),
    ...(sessions.length > 0 || lantern !== undefined
      ? { focus: { sessions, ...(lantern !== undefined ? { selectedLantern: lantern } : {}) } }
      : {}),
    ...(events.length > 0 ? { calendar: { events } } : {}),
    ...(anniversaries !== undefined && Object.keys(anniversaries).length > 0 ? { anniversaries } : {}),
  };
}

function isValid(parts: Parts, opts: ProjectOptions): string | null {
  const r = validateAppState(assemble(parts, opts));
  return r.ok ? null : r.reason;
}

/** Éprouve chaque document seul (avec les réglages) ; écarte et signale les invalides. */
function isolate(parts: Parts, opts: ProjectOptions, issues: string[]): Parts {
  const kept: Parts = new Map();
  const base: Parts = new Map();
  const budget = (parts.get('settings') ?? []).find((r) => r.id === SETTINGS_BUDGET);
  if (budget !== undefined) {
    const reason = isValid(new Map([['settings', [budget]]]), opts);
    if (reason === null) base.set('settings', [budget]);
    else issues.push(`settings/${SETTINGS_BUDGET}: ${reason}`);
  }
  for (const [collection, rows] of parts) {
    const good = rows.filter((row) => {
      if (collection === 'settings' && row.id === SETTINGS_BUDGET) return base.has('settings');
      const probe: Parts = new Map(base);
      probe.set(collection, collection === 'settings' ? [...(base.get('settings') ?? []), row] : [row]);
      const reason = isValid(probe, opts);
      if (reason !== null) issues.push(`${collection}/${row.id}: ${reason}`);
      return reason === null;
    });
    kept.set(collection, good);
  }
  return kept;
}

/** Documents → AppState valide, ou échec signalé (l'appelant garde alors l'état précédent). Pur. */
export function projectState(docs: DocStore, opts: ProjectOptions): ProjectResult {
  const parts = partsOf(docs);
  const first = validateAppState(assemble(parts, opts));
  if (first.ok) return { ok: true, state: first.state, issues: [] };
  const issues: string[] = [];
  const second = validateAppState(assemble(isolate(parts, opts, issues), opts));
  if (second.ok) return { ok: true, state: second.state, issues };
  return { ok: false, issues: [...issues, second.reason] };
}
