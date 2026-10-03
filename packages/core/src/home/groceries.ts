/**
 * Courses : liste commune, quantités simples, rayons automatiques, panier,
 * historique des achats et suggestions d'articles fréquents.
 *
 * Fonctions **pures** : elles ne mutent jamais leurs entrées ; quand rien ne
 * change, elles renvoient la même référence (le store évite alors une
 * écriture). Les identifiants et l'heure sont **injectés** (`id`, `now`).
 *
 * Typographie : les quantités mesurées utilisent une espace insécable entre
 * le nombre et l'unité (« 500 g » = `500 g`), les multiplicateurs le
 * signe × (« ×2 »), les décimales une virgule (« 1,5 kg »).
 */

import type {
  GroceriesState,
  GroceryAuthor,
  GroceryCategory,
  GroceryItem,
  GroceryPurchase,
} from './types.js';

// ---------------------------------------------------------------------------
// Rayons
// ---------------------------------------------------------------------------

/** Rayons dans l'ordre d'affichage (parcours d'un magasin), libellés français. */
export const GROCERY_CATEGORIES: ReadonlyArray<{ id: GroceryCategory; label: string }> = [
  { id: 'fruits-legumes', label: 'Fruits & légumes' },
  { id: 'boulangerie', label: 'Boulangerie' },
  { id: 'frais', label: 'Frais' },
  { id: 'epicerie', label: 'Épicerie' },
  { id: 'boissons', label: 'Boissons' },
  { id: 'surgeles', label: 'Surgelés' },
  { id: 'hygiene', label: 'Hygiène' },
  { id: 'maison', label: 'Maison' },
  { id: 'autre', label: 'Autre' },
];

/** Nombre maximal d'achats conservés dans l'historique (les plus récents). */
export const GROCERY_HISTORY_MAX = 200;

/** Longueur maximale d'un libellé (au-delà, il est tronqué). */
export const GROCERY_LABEL_MAX = 120;

const CATEGORY_IDS = new Set<string>(GROCERY_CATEGORIES.map((c) => c.id));

/** Vrai si la valeur est un identifiant de rayon connu. */
export function isGroceryCategory(value: unknown): value is GroceryCategory {
  return typeof value === 'string' && CATEGORY_IDS.has(value);
}

/** Libellé français d'un rayon (« Fruits & légumes »…). */
export function groceryCategoryLabel(category: GroceryCategory): string {
  return GROCERY_CATEGORIES.find((c) => c.id === category)?.label ?? 'Autre';
}

/**
 * Mots-clés par rayon (accents et pluriels indifférents : « œufs », « oeuf »,
 * « Oeufs » se valent). Un mot-clé de plusieurs mots l'emporte sur un mot
 * seul au même endroit (« pomme de terre », « crème solaire »…).
 */
const CATEGORY_KEYWORDS: Record<Exclude<GroceryCategory, 'autre'>, string[]> = {
  'fruits-legumes': [
    'fruit', 'légume', 'pomme', 'poire', 'banane', 'orange', 'citron', 'clémentine',
    'mandarine', 'pamplemousse', 'fraise', 'framboise', 'myrtille', 'cerise', 'raisin',
    'kiwi', 'mangue', 'ananas', 'pêche', 'nectarine', 'abricot', 'prune', 'figue',
    'melon', 'pastèque', 'grenade', 'avocat', 'tomate', 'carotte', 'courgette',
    'aubergine', 'poivron', 'piment', 'concombre', 'salade', 'laitue', 'roquette',
    'mâche', 'épinard', 'chou', 'chou-fleur', 'brocoli', 'poireau', 'oignon',
    'échalote', 'ail', 'pomme de terre', 'patate', 'champignon', 'haricot',
    'haricot vert', 'radis', 'betterave', 'céleri', 'fenouil', 'navet', 'panais',
    'potiron', 'courge', 'butternut', 'citrouille', 'asperge', 'artichaut', 'endive',
    'persil', 'coriandre', 'basilic', 'menthe', 'ciboulette', 'aneth', 'thym',
    'romarin', 'gingembre', 'herbes', 'citron vert', 'shiitake', 'pak choï', 'edamame',
  ],
  boulangerie: [
    'pain', 'baguette', 'croissant', 'chocolatine', 'brioche', 'viennoiserie',
    'pain de mie', 'tarte', 'gâteau', 'flan', 'éclair', 'chausson', 'ficelle',
    'focaccia', 'bagel', 'wrap', 'tortilla', 'galette',
  ],
  frais: [
    'lait', 'yaourt', 'yogourt', 'fromage', 'fromage blanc', 'œuf', 'beurre', 'crème',
    'crème fraîche', 'viande', 'poisson', 'jambon', 'poulet', 'bœuf', 'porc', 'veau',
    'agneau', 'dinde', 'canard', 'steak', 'haché', 'saucisse', 'lardon', 'bacon',
    'saumon', 'cabillaud', 'colin', 'crevette', 'moule', 'chorizo', 'saucisson',
    'rillettes', 'emmental', 'gruyère', 'comté', 'mozzarella', 'parmesan', 'feta',
    'chèvre', 'camembert', 'brie', 'raclette', 'ricotta', 'mascarpone', 'skyr',
    'kéfir', 'tofu', 'houmous', 'pâte à tarte', 'pâte feuilletée', 'pâte brisée',
    'pâte sablée', 'pâte à pizza', 'petit suisse', 'crème dessert', 'pizza', 'quiche',
    'gnocchi', 'ravioli', 'surimi', 'tzatziki',
  ],
  epicerie: [
    'pâte', 'spaghetti', 'tagliatelle', 'penne', 'riz', 'farine', 'sucre', 'café',
    'thé', 'tisane', 'infusion', 'cacao', 'conserve', 'huile', 'vinaigre', 'sel',
    'poivre', 'épice', 'curry', 'paprika', 'cumin', 'cannelle', 'vanille', 'sauce',
    'ketchup', 'mayonnaise', 'moutarde', 'pesto', 'confiture', 'miel', 'pâte à tartiner',
    'nutella', 'chocolat', 'céréale', 'muesli', 'granola', 'flocon d avoine', 'avoine',
    'biscuit', 'cookie', 'gâteau sec', 'biscotte', 'cracker', 'chips', 'lentille',
    'pois chiche', 'haricot rouge', 'petit pois', 'semoule', 'quinoa', 'boulgour',
    'couscous', 'polenta', 'maïs', 'thon', 'sardine', 'maquereau', 'olive', 'cornichon',
    'câpre', 'bouillon', 'levure', 'bicarbonate', 'compote', 'lait de coco',
    'lait concentré', 'noix', 'amande', 'noisette', 'cacahuète', 'pistache',
    'noix de cajou', 'fruit sec', 'raisin sec', 'soupe', 'purée', 'nouille',
    'vermicelle', 'sauce tomate', 'concentré de tomate', 'tomate pelée', 'sauce soja',
    'sirop d érable', 'fécule', 'maïzena', 'chapelure', 'algue', 'nori', 'miso',
  ],
  boissons: [
    'eau', 'eau gazeuse', 'eau pétillante', 'jus', 'soda', 'coca', 'limonade', 'bière',
    'vin', 'cidre', 'champagne', 'crémant', 'prosecco', 'apéritif', 'whisky', 'rhum',
    'vodka', 'gin', 'sirop', 'thé glacé', 'ice tea', 'kombucha', 'lait d avoine',
    'lait d amande', 'lait de soja', 'lait de riz', 'lait végétal', 'boisson',
    'saké', 'smoothie',
  ],
  surgeles: [
    'surgelé', 'glace', 'glaçon', 'sorbet', 'crème glacée', 'frites', 'nugget',
    'bâtonnet', 'esquimau', 'cornet',
  ],
  hygiene: [
    'savon', 'shampoing', 'shampooing', 'après-shampoing', 'gel douche', 'dentifrice',
    'brosse à dents', 'fil dentaire', 'bain de bouche', 'déodorant', 'coton',
    'coton-tige', 'rasoir', 'mousse à raser', 'crème solaire', 'crème hydratante',
    'serviette hygiénique', 'tampon', 'protège-slip', 'mouchoir', 'couche',
    'lingette', 'maquillage', 'démaquillant', 'lait démaquillant', 'eau micellaire',
    'gel hydroalcoolique', 'pansement', 'vernis', 'parfum', 'baume', 'crème mains',
  ],
  maison: [
    'lessive', 'adoucissant', 'vaisselle', 'lave-vaisselle', 'liquide vaisselle',
    'éponge', 'papier', 'essuie-tout', 'sopalin', 'poubelle', 'sac poubelle', 'javel',
    'eau de javel', 'nettoyant', 'détergent', 'dégraissant', 'désinfectant',
    'vinaigre blanc', 'ampoule', 'pile', 'bougie', 'allumette', 'aluminium',
    'papier alu', 'film alimentaire', 'papier cuisson', 'serpillière', 'balai',
    'gant', 'spray', 'détartrant', 'anticalcaire', 'sel lave-vaisselle', 'croquette',
    'litière', 'pâtée', 'insecticide', 'désodorisant', 'chiffon', 'microfibre',
  ],
};

/**
 * Repliage pour la comparaison : minuscules, sans accents, « œ » → « oe »,
 * ponctuation et apostrophes → espaces, espaces réduits.
 */
function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface CompiledKeyword {
  category: GroceryCategory;
  length: number;
  re: RegExp;
}

/** Mots-clés compilés une fois : chaque mot accepte un pluriel en s/x. */
const COMPILED_KEYWORDS: CompiledKeyword[] = (() => {
  const out: CompiledKeyword[] = [];
  for (const { id } of GROCERY_CATEGORIES) {
    if (id === 'autre') continue;
    for (const raw of CATEGORY_KEYWORDS[id]) {
      const folded = foldText(raw);
      const pattern = folded
        .split(' ')
        .map((word) => `${escapeRegExp(word)}(?:s|x)?`)
        .join(' ');
      out.push({ category: id, length: folded.length, re: new RegExp(`(?:^| )${pattern}(?= |$)`) });
    }
  }
  return out;
})();

const FROZEN_RE = /(?:^| )(?:surgel|congel)[a-z]*/;

/**
 * Rayon automatique d'un libellé, par mots-clés français.
 *
 * Règles (déterministes) :
 * 1. « surgelé(e)s » / « congelé » n'importe où → `surgeles` ;
 * 2. sinon, le mot-clé trouvé **le plus tôt** l'emporte (le nom principal
 *    vient d'abord en français : « jus d'orange » → boissons, « sauce tomate »
 *    → épicerie) ; à position égale, le plus long (« pomme de terre ») ;
 * 3. aucun mot-clé → `autre`.
 */
export function categorizeGrocery(label: string): GroceryCategory {
  const text = foldText(label);
  if (text === '') return 'autre';
  if (FROZEN_RE.test(text)) return 'surgeles';
  let best: { category: GroceryCategory; index: number; length: number } | null = null;
  for (const kw of COMPILED_KEYWORDS) {
    const m = kw.re.exec(text);
    if (m === null) continue;
    const index = m.index + (m[0].startsWith(' ') ? 1 : 0);
    if (
      best === null ||
      index < best.index ||
      (index === best.index && kw.length > best.length)
    ) {
      best = { category: kw.category, index, length: kw.length };
    }
  }
  return best?.category ?? 'autre';
}

/** Rayon effectif d'un article : catégorie enregistrée, sinon déduite du libellé. */
export function groceryCategoryOf(item: Pick<GroceryItem, 'label' | 'category'>): GroceryCategory {
  return item.category ?? categorizeGrocery(item.label);
}

// ---------------------------------------------------------------------------
// Libellés et quantités
// ---------------------------------------------------------------------------

const NBSP = ' ';

/** Unités mesurées → forme normalisée. */
const MEASURE_UNITS: Array<[RegExp, string]> = [
  [/^(?:kg|kilos?|kilogrammes?)$/i, 'kg'],
  [/^(?:g|gr|grammes?)$/i, 'g'],
  [/^mg$/i, 'mg'],
  [/^(?:l|litres?)$/i, 'l'],
  [/^cl$/i, 'cl'],
  [/^ml$/i, 'ml'],
  [/^dl$/i, 'dl'],
];

const UNIT_SOURCE =
  'kg|kilos?|kilogrammes?|grammes?|gr|g|mg|litres?|l|cl|ml|dl|' +
  'paquets?|bo[iî]tes?|bouteilles?|packs?|sachets?|pots?|briques?|tranches?|' +
  'rouleaux|rouleau|bottes?|barquettes?|filets?|douzaines?|canettes?|tablettes?|' +
  'pi[eè]ces?|boules?|sacs?|bocaux|bocal|flacons?|tubes?';

const NUM = '(\\d+(?:[.,]\\d+)?)';
const OF = "(?:de\\s+|des\\s+|d['’]\\s*)?";
const LEAD_MEASURE_RE = new RegExp(`^${NUM}\\s*(${UNIT_SOURCE})\\.?\\s+${OF}(.+)$`, 'i');
const LEAD_TIMES_RE = /^(\d+)\s*[x×*]\s+(.+)$/i;
const LEAD_X_RE = /^[x×]\s*(\d+)\s+(.+)$/i;
const LEAD_COUNT_RE = /^(\d+)\s+(.+)$/;
const TRAIL_TIMES_RE = /^(.+?)(?:\s+[x×*]\s*|\s*×\s*)(\d+)$/i;
const TRAIL_PAREN_RE = /^(.+?)\s*\(\s*[x×]?\s*(\d+)\s*\)$/i;
const TRAIL_MEASURE_RE = new RegExp(`^(.+?)\\s+${NUM}\\s*(${UNIT_SOURCE})\\.?$`, 'i');

/** Article initial superflu dans une saisie rapide (« du café », « de l'huile »). */
const LEADING_ARTICLE_RE = /^(?:(?:du|des|de\s+la|un|une)\s+|(?:de\s+)?l['’]\s*)(?=\S)/i;

/** Compteur plausible pour un multiplicateur (« ×2 ») : 1..99. */
const MAX_COUNT = 99;

function formatNumber(raw: string): string {
  return raw.replace('.', ',');
}

function positive(raw: string): boolean {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0;
}

function formatMeasure(num: string, unit: string): string {
  const lower = unit.toLowerCase();
  const normalized = MEASURE_UNITS.find(([re]) => re.test(lower))?.[1] ?? lower;
  return `${formatNumber(num)}${NBSP}${normalized}`;
}

/** Multiplicateur « ×n » ; « ×1 » est omis (undefined). */
function formatTimes(count: string): string | undefined | null {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT) return null; // non reconnu
  return n === 1 ? undefined : `×${n}`;
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalise un libellé : espaces réduits, longueur bornée, initiale en
 * capitale (sauf si le 2e caractère est déjà une capitale, ex. « iPhone »).
 */
export function normalizeGroceryLabel(raw: string): string {
  const text = collapseSpaces(raw).slice(0, GROCERY_LABEL_MAX).trim();
  if (text === '') return '';
  const first = text.charAt(0);
  const second = text.charAt(1);
  if (second !== '' && second !== second.toLowerCase()) return text;
  return first.toLocaleUpperCase('fr-FR') + text.slice(1);
}

/**
 * Normalise une quantité saisie à part : « 2 » / « x2 » / « 2x » → « ×2 »,
 * « 500g » → « 500 g » (insécable), sinon le texte tel quel (espaces
 * réduits). Vide → undefined.
 */
export function normalizeGroceryQuantity(raw: string): string | undefined {
  const text = collapseSpaces(raw);
  if (text === '') return undefined;
  const times = /^(?:[x×*]\s*(\d+)|(\d+)\s*[x×*]?)$/i.exec(text);
  if (times) {
    const formatted = formatTimes((times[1] ?? times[2])!);
    if (formatted !== null) return formatted ?? undefined;
  }
  const measure = new RegExp(`^${NUM}\\s*(${UNIT_SOURCE})\\.?$`, 'i').exec(text);
  if (measure && positive(measure[1]!)) return formatMeasure(measure[1]!, measure[2]!);
  return text.slice(0, 40);
}

/**
 * Sépare une saisie rapide en libellé + quantité simple :
 * - « 2 pommes » → ×2 · « Pommes »
 * - « lait x2 », « lait ×2 », « lait (2) » → ×2 · « Lait »
 * - « 2x lait », « x2 lait » → ×2 · « Lait »
 * - « 500 g de farine », « 500g farine », « farine 500 g » → 500 g · « Farine »
 * - « 2 paquets de pâtes » → 2 paquets · « Pâtes »
 * Un article initial superflu est retiré (« du café » → « Café »).
 * « 1 baguette » → pas de quantité (×1 omis). Un nombre seul sans libellé,
 * « 0 », ou un compteur > 99 sans unité ne sont pas interprétés.
 */
export function parseGroceryInput(raw: string): { label: string; quantity?: string } {
  const text = collapseSpaces(raw);
  const result = (label: string, quantity: string | undefined) => {
    const normalized = normalizeGroceryLabel(label.replace(LEADING_ARTICLE_RE, ''));
    if (normalized === '') return { label: normalizeGroceryLabel(text) };
    return quantity === undefined ? { label: normalized } : { label: normalized, quantity };
  };

  let m = LEAD_MEASURE_RE.exec(text);
  if (m && positive(m[1]!)) return result(m[3]!, formatMeasure(m[1]!, m[2]!));

  m = LEAD_TIMES_RE.exec(text) ?? LEAD_X_RE.exec(text);
  if (m) {
    const q = formatTimes(m[1]!);
    if (q !== null) return result(m[2]!, q);
  }

  m = LEAD_COUNT_RE.exec(text);
  if (m) {
    const q = formatTimes(m[1]!);
    if (q !== null) return result(m[2]!, q);
  }

  m = TRAIL_TIMES_RE.exec(text) ?? TRAIL_PAREN_RE.exec(text);
  if (m) {
    const q = formatTimes(m[2]!);
    if (q !== null) return result(m[1]!, q);
  }

  m = TRAIL_MEASURE_RE.exec(text);
  if (m && positive(m[2]!)) return result(m[1]!, formatMeasure(m[2]!, m[3]!));

  return result(text, undefined);
}

/**
 * Clé d'identité d'un libellé (comparaison « même article ») : repliage
 * (accents, casse, ponctuation) et pluriels simples en s/x ignorés.
 * « Pommes » ≡ « pomme » ≡ « POMME ».
 */
export function groceryKey(label: string): string {
  return foldText(label)
    .split(' ')
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, '') : word))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Opérations sur la liste
// ---------------------------------------------------------------------------

/**
 * Ajoute un article depuis une saisie rapide (« 2 pommes », « lait x2 »…).
 *
 * - Libellé normalisé, quantité extraite, rayon déduit des mots-clés.
 * - Saisie vide → `{ items, item: null, added: false }` (même référence).
 * - Un article **identique non coché** existe déjà (même `groceryKey`) → pas
 *   de doublon : `added: false`, `item` = l'existant ; si la saisie précise
 *   une quantité différente, elle remplace l'ancienne (dernière intention).
 * - Sinon l'article est ajouté **en fin de liste** (`addedAt` = now).
 */
export function addGroceryItem(
  items: GroceryItem[],
  raw: string,
  opts: { id: string; now: Date; addedBy?: GroceryAuthor; category?: GroceryCategory },
): { items: GroceryItem[]; item: GroceryItem | null; added: boolean } {
  const parsed = parseGroceryInput(raw);
  if (parsed.label === '') return { items, item: null, added: false };

  const key = groceryKey(parsed.label);
  const index = items.findIndex((item) => !item.done && groceryKey(item.label) === key);
  if (index !== -1) {
    const existing = items[index]!;
    if (parsed.quantity === undefined || parsed.quantity === existing.quantity) {
      return { items, item: existing, added: false };
    }
    const updated: GroceryItem = { ...existing, quantity: parsed.quantity };
    const next = items.slice();
    next[index] = updated;
    return { items: next, item: updated, added: false };
  }

  const item: GroceryItem = {
    id: opts.id,
    label: parsed.label,
    done: false,
    ...(parsed.quantity !== undefined ? { quantity: parsed.quantity } : {}),
    category: opts.category ?? categorizeGrocery(parsed.label),
    addedAt: opts.now.toISOString(),
    doneAt: null,
    ...(opts.addedBy !== undefined ? { addedBy: opts.addedBy } : {}),
  };
  return { items: [...items, item], item, added: true };
}

/**
 * Coche / décoche un article : `done` s'inverse, `doneAt` = now (ISO) quand il
 * passe au panier, null quand il en sort. Id inconnu → même référence.
 */
export function toggleGroceryItem(items: GroceryItem[], id: string, now: Date): GroceryItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;
  const current = items[index]!;
  const done = !current.done;
  const next = items.slice();
  next[index] = { ...current, done, doneAt: done ? now.toISOString() : null };
  return next;
}

/** Retire un article (sans l'archiver). Id inconnu → même référence. */
export function removeGroceryItem(items: GroceryItem[], id: string): GroceryItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;
  const next = items.slice();
  next.splice(index, 1);
  return next;
}

/**
 * Annule un retrait : remet l'article à sa position d'origine (bornée à la
 * longueur actuelle). Un article de même id déjà présent → même référence.
 */
export function restoreGroceryItem(
  items: GroceryItem[],
  item: GroceryItem,
  index: number,
): GroceryItem[] {
  if (items.some((existing) => existing.id === item.id)) return items;
  const at = Math.max(0, Math.min(items.length, Math.floor(index)));
  const next = items.slice();
  next.splice(at, 0, item);
  return next;
}

/** Modification d'un article (champs facultatifs). */
export interface GroceryItemPatch {
  /**
   * Nouveau libellé (normalisé). Vide → ignoré. Une quantité incluse
   * (« lait x3 ») est extraite si `quantity` n'est pas fourni. Sans
   * `category` dans le patch, le rayon est recalculé depuis le libellé.
   */
  label?: string;
  /** Nouvelle quantité (normalisée) ; null ou vide = retirer la quantité. */
  quantity?: string | null;
  /** Rayon choisi ; null = revenir au rayon automatique. Inconnu → ignoré. */
  category?: GroceryCategory | null;
}

/**
 * Modifie un article. Les champs invalides sont ignorés (jamais d'exception).
 * Id inconnu ou patch sans effet → même référence.
 */
export function updateGroceryItem(
  items: GroceryItem[],
  id: string,
  patch: GroceryItemPatch,
): GroceryItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;
  const current = items[index]!;
  const next: GroceryItem = { ...current };

  if (patch.label !== undefined) {
    const parsed = parseGroceryInput(patch.label);
    if (parsed.label !== '') {
      next.label = parsed.label;
      if (patch.quantity === undefined && parsed.quantity !== undefined) {
        next.quantity = parsed.quantity;
      }
      if (patch.category === undefined && parsed.label !== current.label) {
        next.category = categorizeGrocery(parsed.label);
      }
    }
  }

  if (patch.quantity !== undefined) {
    const quantity = patch.quantity === null ? undefined : normalizeGroceryQuantity(patch.quantity);
    if (quantity === undefined) delete next.quantity;
    else next.quantity = quantity;
  }

  if (patch.category === null) {
    next.category = categorizeGrocery(next.label);
  } else if (patch.category !== undefined && isGroceryCategory(patch.category)) {
    next.category = patch.category;
  }

  const changed =
    next.label !== current.label ||
    next.quantity !== current.quantity ||
    next.category !== current.category;
  if (!changed) return items;
  const out = items.slice();
  out[index] = next;
  return out;
}

function purchaseFromItem(item: GroceryItem, boughtAt: string): GroceryPurchase {
  return {
    id: item.id,
    label: item.label,
    ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
    category: groceryCategoryOf(item),
    ...(item.addedBy !== undefined ? { addedBy: item.addedBy } : {}),
    boughtAt,
  };
}

/**
 * « Vider le panier » : retire les articles cochés de la liste et les archive
 * en tête de l'historique (achat daté de `doneAt`, sinon de `now`), borné à
 * GROCERY_HISTORY_MAX. Panier vide → même référence d'état.
 */
export function clearDoneGroceries(state: GroceriesState, now: Date): GroceriesState {
  const done = state.items.filter((item) => item.done);
  if (done.length === 0) return state;
  const nowIso = now.toISOString();
  const archived = done
    .map((item) => purchaseFromItem(item, item.doneAt ?? nowIso))
    .sort((x, y) => y.boughtAt.localeCompare(x.boughtAt));
  const archivedIds = new Set(archived.map((p) => p.id));
  const previous = (state.history ?? []).filter((p) => !archivedIds.has(p.id));
  return {
    ...state,
    items: state.items.filter((item) => !item.done),
    history: [...archived, ...previous].slice(0, GROCERY_HISTORY_MAX),
  };
}

/**
 * Derniers achats, plus récent d'abord : articles actuellement au panier
 * (datés de `doneAt`) puis historique. Pour la feuille Historique.
 */
export function recentGroceryPurchases(state: GroceriesState, n = 20): GroceryPurchase[] {
  const inBasket = state.items
    .filter((item) => item.done)
    .map((item) => purchaseFromItem(item, item.doneAt ?? item.addedAt ?? ''));
  return [...inBasket, ...(state.history ?? [])]
    .sort((x, y) => y.boughtAt.localeCompare(x.boughtAt))
    .slice(0, Math.max(0, n));
}

/** Suggestion d'article fréquent (à ajouter d'un geste). */
export interface GrocerySuggestion {
  /** Clé d'identité (groceryKey). */
  key: string;
  /** Libellé du dernier achat. */
  label: string;
  category: GroceryCategory;
  /** Nombre d'achats dans la fenêtre considérée. */
  count: number;
  /** Horodatage ISO du dernier achat. */
  lastBoughtAt: string;
}

/**
 * Suggestions d'articles fréquents récemment achetés et **absents de la
 * liste** (ni à acheter, ni au panier).
 *
 * Achats considérés : `options.history` + articles cochés de `items`.
 * Fenêtre : si `options.now` est fourni, seuls les achats des
 * `windowDays` (défaut 90) derniers jours comptent. Classement : nombre
 * d'achats décroissant, puis dernier achat le plus récent, puis libellé.
 * `minCount` (défaut 1) filtre les achats trop rares.
 */
export function grocerySuggestions(
  items: GroceryItem[],
  n = 6,
  options: { history?: GroceryPurchase[]; now?: Date; windowDays?: number; minCount?: number } = {},
): GrocerySuggestion[] {
  const windowDays = options.windowDays ?? 90;
  const minCount = options.minCount ?? 1;
  const since =
    options.now === undefined
      ? null
      : new Date(options.now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const present = new Set(items.map((item) => groceryKey(item.label)));
  const purchases: GroceryPurchase[] = [
    ...(options.history ?? []),
    ...items
      .filter((item) => item.done && (item.doneAt ?? item.addedAt))
      .map((item) => purchaseFromItem(item, (item.doneAt ?? item.addedAt)!)),
  ];
  const groups = new Map<string, GrocerySuggestion>();
  for (const p of purchases) {
    if (since !== null && p.boughtAt < since) continue;
    const key = groceryKey(p.label);
    if (key === '' || present.has(key)) continue;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        key,
        label: p.label,
        category: p.category ?? categorizeGrocery(p.label),
        count: 1,
        lastBoughtAt: p.boughtAt,
      });
    } else {
      group.count += 1;
      if (p.boughtAt > group.lastBoughtAt) {
        group.lastBoughtAt = p.boughtAt;
        group.label = p.label;
        group.category = p.category ?? categorizeGrocery(p.label);
      }
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort(
      (x, y) =>
        y.count - x.count ||
        y.lastBoughtAt.localeCompare(x.lastBoughtAt) ||
        x.label.localeCompare(y.label, 'fr'),
    )
    .slice(0, Math.max(0, n));
}

/** Groupe de rayon pour l'affichage. */
export interface GroceryGroup {
  category: GroceryCategory;
  label: string;
  items: GroceryItem[];
}

/**
 * Prépare l'affichage : articles à acheter groupés par rayon (ordre
 * GROCERY_CATEGORIES, ordre d'ajout conservé dans chaque rayon, rayons vides
 * omis) ; panier trié du plus récemment coché au plus ancien.
 */
export function groupGroceryItems(items: GroceryItem[]): {
  toBuy: GroceryGroup[];
  basket: GroceryItem[];
} {
  const byCategory = new Map<GroceryCategory, GroceryItem[]>();
  const basket: GroceryItem[] = [];
  for (const item of items) {
    if (item.done) {
      basket.push(item);
      continue;
    }
    const category = groceryCategoryOf(item);
    const list = byCategory.get(category);
    if (list) list.push(item);
    else byCategory.set(category, [item]);
  }
  const toBuy: GroceryGroup[] = [];
  for (const { id, label } of GROCERY_CATEGORIES) {
    const list = byCategory.get(id);
    if (list) toBuy.push({ category: id, label, items: list });
  }
  basket.sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''));
  return { toBuy, basket };
}
