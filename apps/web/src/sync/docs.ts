/**
 * Pont de synchronisation (V5) — représentation « documents Firestore » de
 * l'état, sans aucune dépendance Firebase (docs/SYNC_DESIGN.md §2, §3).
 *
 * Tout vit sous `households/{hid}` ; ici on ne manipule que les chemins
 * relatifs `collection/id`. Les ids sont ceux de l'app (aucune traduction).
 *
 * - Objets (tâches, articles, événements, mois…) : « dernier qui écrit
 *   gagne », champ par champ ; suppression douce `deletedAt`.
 * - Faits (complétions, passages, pauses, lanternes, achats) : créés une
 *   fois, jamais supprimés ; seule l'annulation peut s'y ajouter.
 * - Métadonnées : `order` (rang dans la liste), `updatedAt` (horloge du
 *   téléphone, informatif), `role` (auteur d'un fait) ; `syncedAt` et
 *   `updatedBy` sont posés par le transport (heure serveur, UID).
 */

/** Collections d'un foyer. */
export const COLLECTIONS = [
  'tasks',
  'completions',
  'skips',
  'forestEvents',
  'focusSessions',
  'groceries',
  'groceryHistory',
  'events',
  'months',
  'balanceCorrections',
  'circles',
  'settings',
  'checkpoints',
  'meta',
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

/** Collections de faits (jamais supprimés, seule l'annulation est permise). */
export const FACT_COLLECTIONS: readonly CollectionName[] = [
  'completions',
  'skips',
  'forestEvents',
  'focusSessions',
  'groceryHistory',
];

/** Champs d'une annulation de fait (seule mise à jour permise sur un fait). */
export const UNDO_FIELDS = ['undoneAt', 'undoneDay', 'undoneBy', 'devOverride'] as const;

/** Métadonnées de synchronisation, jamais projetées dans l'état. */
export const META_FIELDS = ['order', 'updatedAt', 'deletedAt', 'syncedAt', 'updatedBy', 'role', 'createdBy'] as const;

/** Données d'un document (JSON, sans `undefined`). */
export type DocData = Record<string, unknown>;

/** Clé d'un document : « collection/id ». */
export type DocKey = string;

/** Documents connus, par clé. */
export type DocStore = ReadonlyMap<DocKey, DocData>;

export function docKey(collection: CollectionName, id: string): DocKey {
  return `${collection}/${id}`;
}

/** [collection, id] d'une clé (l'id peut contenir « / » : seule la 1re barre compte). */
export function splitDocKey(key: DocKey): [CollectionName, string] {
  const i = key.indexOf('/');
  return [key.slice(0, i) as CollectionName, key.slice(i + 1)];
}

/** Documents d'une collection : [id, données]. */
export function docsOf(docs: DocStore, collection: CollectionName): [string, DocData][] {
  const prefix = `${collection}/`;
  const out: [string, DocData][] = [];
  for (const [key, data] of docs) if (key.startsWith(prefix)) out.push([key.slice(prefix.length), data]);
  return out;
}

/** Chemin d'un champ, segment par segment (jamais une chaîne pointée : les clés peuvent contenir « . »). */
export type FieldPath = readonly string[];

/** Sentinelle « supprimer ce champ » (deleteField() côté Firestore). */
export const DELETE_FIELD: Readonly<{ $delete: true }> = Object.freeze({ $delete: true });

export function isDeleteField(value: unknown): boolean {
  return typeof value === 'object' && value !== null && (value as { $delete?: unknown }).$delete === true &&
    Object.keys(value).length === 1;
}

/** Écriture d'un champ : chemin + valeur (ou DELETE_FIELD). */
export type FieldWrite = readonly [FieldPath, unknown];

/**
 * Opération d'écriture (un lot = une transition locale, appliqué d'un bloc).
 * - `create` : crée le document s'il est absent, sinon ne fait rien ;
 * - `set` : remplace le document (restauration après suppression douce,
 *   recalage du solde : le dernier arrivé gagne) ;
 * - `update` : champs d'un document existant (refusé s'il n'existe pas) ;
 * - `merge` : champs d'un document unique (réglages), créé au besoin ;
 * - `raise` : jalons de la forêt, fusionnés au maximum (jamais en baisse).
 */
export type WriteOp =
  | { kind: 'create' | 'set'; collection: CollectionName; id: string; data: DocData }
  | { kind: 'update' | 'merge'; collection: CollectionName; id: string; fields: readonly FieldWrite[] }
  | { kind: 'raise'; collection: 'meta'; id: 'forestMilestones'; data: DocData };

/** Ids fixes des documents uniques. */
export const SETTINGS_BUDGET = 'budget';
export const SETTINGS_FOCUS = 'focus';
export const SETTINGS_GROCERY_MEMORY = 'groceryMemory';
export const SETTINGS_ANNIVERSARIES = 'anniversaries';
export const META_MILESTONES = 'forestMilestones';

/** Objet simple (ni tableau, ni null). */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Égalité profonde de valeurs JSON. */
export function jsonEqual(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (Array.isArray(x)) {
    return Array.isArray(y) && x.length === y.length && x.every((v, i) => jsonEqual(v, y[i]));
  }
  if (isPlainRecord(x) && isPlainRecord(y)) {
    const kx = Object.keys(x);
    const ky = Object.keys(y);
    return kx.length === ky.length && kx.every((k) => Object.hasOwn(y, k) && jsonEqual(x[k], y[k]));
  }
  return false;
}

/** Copie JSON sans les `undefined` (Firestore les refuse). */
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = clean(v);
    return out as T;
  }
  return value;
}

/** Données sans métadonnées de synchronisation. */
export function stripMeta(data: DocData): DocData {
  const out: DocData = { ...data };
  for (const field of META_FIELDS) delete out[field];
  return out;
}
