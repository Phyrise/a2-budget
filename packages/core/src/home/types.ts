/**
 * Types du domaine « Maison / Forêt » (A² Home).
 *
 * Ce domaine est **séparé** du budget : il ne réutilise que les types budget
 * (Settings, MonthRecord) pour composer l'état applicatif modulaire V2.
 *
 * UNITÉS / CONVENTIONS :
 * - Les dates sont des clés locales « YYYY-MM-DD » (fuseau de l'utilisateur).
 * - Les horodatages d'événements sont des ISO 8601 (new Date().toISOString()).
 * - Aucune valeur de jeu (vitalité, crédits, stades) n'est exposée en nombre
 *   à l'utilisateur : seuls des états qualitatifs sont affichés.
 */

import type { BudgetBalance, MonthRecord, Settings } from '../types.js';
import type { CalendarState } from './calendarTypes.js';

// ---------------------------------------------------------------------------
// Tâches (Maison)
// ---------------------------------------------------------------------------

/** Qui s'occupe de la tâche. */
export type TaskAssignee = 'a' | 'b' | 'both' | 'unassigned';

/**
 * Récurrence locale, sans dérive :
 * - `none`    : ponctuelle, une seule occurrence (identifiée « once »).
 * - `daily`   : une occurrence chaque jour.
 * - `weekly`  : une occurrence chaque semaine sur `weeklyDay` (ISO 1=lun..7=dim).
 * - `monthly` : une occurrence chaque mois sur `monthlyDay` (1..31), ajustée au
 *               dernier jour du mois si le mois est plus court (prévisible).
 */
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

/** Une tâche du foyer (modèle récurrent). */
export interface HouseholdTask {
  /** Identifiant stable, unique dans la liste des tâches. */
  id: string;
  title: string;
  description?: string;
  assignee: TaskAssignee;
  recurrence: TaskRecurrence;
  /** weekly : jour ISO 1 = lundi … 7 = dimanche. */
  weeklyDay?: number;
  /** monthly : jour du mois 1..31 (ajusté au dernier jour si mois plus court). */
  monthlyDay?: number;
  /** Date de création « YYYY-MM-DD » (fuseau local). */
  createdAt: string;
  /**
   * V3 — effort ressenti : 1 = petit geste, 2 = tâche, 3 = corvée. Absent =
   * 1 pour l'équilibre. Ne change jamais les crédits de la forêt.
   */
  effort?: TaskEffort;
  /**
   * V3 — tour à tour : l'assignation alterne entre A et B à chaque occurrence
   * (voir nextAssignee). Exige `assignee` 'a' ou 'b' (= qui commence).
   */
  rotation?: boolean;
  /**
   * V3 — hebdomadaire souple (seulement avec `recurrence: 'weekly'`) : à faire
   * n'importe quel jour de la semaine ISO, une fois. L'occurrence est
   * identifiée par la date du lundi de la semaine. `weeklyDay` reste requis
   * (jour suggéré, conservé si l'on repasse en jour fixe).
   */
  flexible?: boolean;
}

/** V3 — effort d'une tâche : 1 petit geste · 2 tâche · 3 corvée. */
export type TaskEffort = 1 | 2 | 3;

/** V3 — qui a réellement fait une occurrence. */
export type ChoreDoer = 'a' | 'b' | 'both';

/**
 * Fait Maison : une occurrence terminée. C'est la source de la répartition
 * factuelle (qui a fait quoi). Indépendante des crédits de la forêt.
 */
export interface ChoreCompletion {
  /** Identifiant stable, unique. */
  id: string;
  taskId: string;
  /** Copie du titre au moment de la complétion (historique lisible). */
  taskTitle: string;
  assignee: TaskAssignee;
  /**
   * Date d'échéance de l'occurrence « YYYY-MM-DD », ou « once » pour une
   * tâche ponctuelle. Identifie l'occurrence avec le taskId.
   */
  dueDate: string;
  /** Horodatage ISO de la complétion. */
  completedAt: string;
  /**
   * V3 — qui l'a réellement fait, seulement s'il diffère de `assignee`
   * (« je m'en occupe », « c'est l'autre qui l'a fait »). Qui a fait =
   * `doneBy ?? assignee`. Sans effet sur les crédits de la forêt.
   */
  doneBy?: ChoreDoer;
}

/**
 * V3 — « Pas aujourd'hui » : une occurrence volontairement passée. Ni crédit,
 * ni pénalité, réversible. `dueDate` = date de l'occurrence (lundi pour une
 * hebdomadaire souple — « pas cette semaine » ; date du jour pour une
 * ponctuelle — elle revient demain).
 */
export interface ChoreSkip {
  id: string;
  taskId: string;
  dueDate: string;
  /** Horodatage ISO du choix. */
  at: string;
  /** Qui a choisi de passer (facultatif). */
  by?: 'a' | 'b';
}

/** État du module Maison (tâches, faits, occurrences passées). */
export interface ChoresState {
  tasks: HouseholdTask[];
  completions: ChoreCompletion[];
  /** V3 — occurrences passées (« pas aujourd'hui »), optionnel. */
  skips?: ChoreSkip[];
}

// ---------------------------------------------------------------------------
// Rituels (V3) — cercle de la semaine
// ---------------------------------------------------------------------------

/** Un merci adressé à l'autre. */
export interface GratitudeNote {
  from: 'a' | 'b';
  to: 'a' | 'b';
  text: string;
}

/** Ce qui pèse à quelqu'un (dit sans reproche). */
export interface BurdenNote {
  who: 'a' | 'b';
  text: string;
}

/** Cercle de la semaine (merci → ce qui pèse → ajuster). Un par semaine ISO. */
export interface Circle {
  id: string;
  /** Lundi de la semaine « YYYY-MM-DD ». */
  weekStart: string;
  /** Horodatage ISO du cercle. */
  heldAt: string;
  gratitude: GratitudeNote[];
  burdens: BurdenNote[];
  intentions: string[];
}

/** État des rituels (optionnel dans AppState). */
export interface RitualsState {
  circles: Circle[];
}

// ---------------------------------------------------------------------------
// Lanternes (V3) — sessions de concentration
// ---------------------------------------------------------------------------

/** Une session de lanterne (minuteur doux) terminée. */
export interface FocusSession {
  id: string;
  /** Horodatage ISO du début. */
  startedAt: string;
  /** Durée en minutes entières 1..120. */
  minutes: number;
  who: ChoreDoer;
  label?: string;
  taskId?: string;
}

/** État des lanternes (optionnel dans AppState). Au plus FOCUS_SESSIONS_MAX. */
export interface FocusState {
  sessions: FocusSession[];
  /**
   * V4 — lanterne de pierre posée dans la forêt (id de LANTERNS). Absent =
   * lanterne de base. Un modèle inconnu ou pas encore débloqué est ignoré à
   * la validation.
   */
  selectedLantern?: string;
}

// ---------------------------------------------------------------------------
// Forêt
// ---------------------------------------------------------------------------

/** État qualitatif de la vitalité court terme (jamais de nombre affiché). */
export type VitalityState = 'quiet' | 'peaceful' | 'lively' | 'flourishing';

/**
 * Enregistrement de crédit dans le ledger.
 * - `grantedOn` : date locale de la complétion qui a généré le crédit (sert au
 *   cap quotidien).
 * - `status` : « active », « tombstoned » (crédit annulé mais conservé), ou
 *   « uncredited » (fait enregistré pendant une pause ou après le cap).
 *   Un fait non crédité ne reçoit pas de crédit au prochain re-clic.
 */
export interface CreditRecord {
  grantedOn: string;
  status: 'active' | 'tombstoned' | 'uncredited';
}

/** Clé de crédit : « ${taskId}|${scheduledLocalDate} » ou « ${taskId}|once ». */
export type CreditKey = string;

/** Ledger de crédits : clé → enregistrement. Les tombstones sont conservés. */
export type CreditLedger = Record<CreditKey, CreditRecord>;

/**
 * Une période de pause (« Mettre la maison en pause »).
 * - `start` : premier jour de pause « YYYY-MM-DD ».
 * - `end`   : dernier jour de pause « YYYY-MM-DD », ou null si la pause est
 *   toujours en cours.
 */
export interface PauseInterval {
  start: string;
  end: string | null;
}

/**
 * État de la forêt. La vitalité fluctue (court terme) ; la croissance
 * (lifetimeCare, growthStage, unlocks) est permanente et ne diminue jamais.
 */
export interface ForestState {
  /** Vitalité court terme 0..100 (jamais exposée en nombre). */
  vitality: number;
  /**
   * Soins significatifs comptés (croissance permanente). Plafonnés par jour
   * local (anti-spam) : créer/cocher 30 tâches ne fait pas farmer ce compteur.
   */
  lifetimeCare: number;
  /** Jours consécutifs (locaux) avec ≥1 action significative (jours de pause exclus). */
  currentStreak: number;
  /** Plus long streak atteint (mémoire longue, ne diminue jamais). */
  longestStreak: number;
  /** Dernière date locale avec ≥1 action significative, ou null. */
  lastMeaningfulActionDate: string | null;
  /** Stade de croissance permanent 1..N (ne diminue jamais). */
  growthStage: number;
  /** Ids des créatures débloquées (ne diminue jamais). */
  unlockedCreatureIds: string[];
  /** Ids des éléments d'environnement débloqués (ne diminue jamais). */
  unlockedEnvironmentIds: string[];
  /** Dernier événement rare déclenché (ex. « guardian »), ou null. */
  lastRareEvent: string | null;
  /** Vrai si la maison est en pause. */
  paused: boolean;
  /** Date locale de début de la pause en cours, ou null. */
  pausedAt: string | null;
  /** Historique des pauses (pour exclure les jours de pause du streak). */
  pauses: PauseInterval[];
  /** Ledger de crédits (tombstones conservés). */
  creditLedger: CreditLedger;
  /**
   * Dernier jour local observé par advanceDay. Tous les jours strictement
   * antérieurs sont réconciliés ; ce jour reste ouvert aux actions. Sert de
   * borne monotone contre les rechargements et les reculs d'horloge.
   */
  lastProcessedDay: string | null;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/**
 * Rayon d'un article de courses (catégorie automatique par mots-clés
 * français, modifiable). Ordre d'affichage et libellés : GROCERY_CATEGORIES.
 */
export type GroceryCategory =
  | 'fruits-legumes'
  | 'boulangerie'
  | 'frais'
  | 'epicerie'
  | 'boissons'
  | 'surgeles'
  | 'hygiene'
  | 'maison'
  | 'autre';

/** Qui a ajouté un article (repère discret, jamais un score). */
export type GroceryAuthor = 'a' | 'b';

/**
 * Article de la liste de courses commune.
 *
 * Rétrocompatibilité : `id`, `label`, `done` existent depuis la V2 initiale ;
 * tous les autres champs sont **optionnels** (un JSON V2 sans eux se charge
 * tel quel, sans les inventer).
 */
export interface GroceryItem {
  id: string;
  /** Libellé normalisé (espaces réduits, initiale en capitale), sans la quantité. */
  label: string;
  /** Vrai si l'article est dans le panier (coché). */
  done: boolean;
  /** Quantité libre et facultative : « ×2 », « 500 g », « 2 paquets »… */
  quantity?: string;
  /** Rayon (catégorie automatique ou choisie). Absent = à déduire du libellé. */
  category?: GroceryCategory;
  /** Horodatage ISO de l'ajout. */
  addedAt?: string;
  /** Horodatage ISO du passage au panier, null si décoché. */
  doneAt?: string | null;
  /** Qui a ajouté l'article. */
  addedBy?: GroceryAuthor;
}

/**
 * Achat archivé : un article sorti du panier par « Vider le panier ».
 * Sert à l'historique (« derniers articles achetés ») et aux suggestions
 * d'articles fréquents. Liste bornée (GROCERY_HISTORY_MAX), plus récent en tête.
 */
export interface GroceryPurchase {
  /** Id de l'article d'origine (unique dans l'historique). */
  id: string;
  label: string;
  quantity?: string;
  category?: GroceryCategory;
  addedBy?: GroceryAuthor;
  /** Horodatage ISO de l'achat (doneAt de l'article, sinon date du vidage). */
  boughtAt: string;
}

/** État du module Courses. */
export interface GroceriesState {
  /** Liste active : à acheter (done = false) + panier (done = true). */
  items: GroceryItem[];
  /**
   * Historique des achats (optionnel : absent des JSON V2 antérieurs ; créé
   * au premier « Vider le panier »).
   */
  history?: GroceryPurchase[];
  /**
   * V4 — mémoire des rayons : clé normalisée du libellé (`groceryKey`) →
   * rayon choisi à la main. Utilisée avant les mots-clés aux prochains
   * ajouts du même article. Au plus GROCERY_MEMORY_MAX entrées (les plus
   * anciennes sont oubliées). Absente tant qu'aucun rayon n'a été corrigé.
   */
  categoryMemory?: GroceryCategoryMemory;
}

/** V4 — mémoire des rayons (clé normalisée → rayon). */
export type GroceryCategoryMemory = Record<string, GroceryCategory>;

// ---------------------------------------------------------------------------
// État applicatif modulaire (V2)
// ---------------------------------------------------------------------------

/** Identité partagée d'une personne (nom + id stable). */
export interface Person {
  id: string;
  name: string;
}

/**
 * État applicatif modulaire (schéma V2).
 *
 * - `household` : identité partagée des deux personnes (utilisée par la
 *   coquille, les tâches et la forêt).
 * - `budget`    : le budget existant, **profondément identique** à la V1
 *   (réserve comprise, même si elle n'est plus affichée).
 * - `chores`    : tâches + faits Maison.
 * - `forest`    : état de la forêt (vitalité, croissance, crédits, pause).
 * - `groceries` : liste de courses commune (+ historique des achats, optionnel).
 * - `rituals`   : V3, cercles de la semaine (optionnel).
 * - `focus`     : V3, sessions de lanterne (optionnel).
 */
export interface AppState {
  schemaVersion: 2;
  household: {
    people: Person[];
  };
  budget: {
    settings: Settings;
    months: MonthRecord[];
    selectedMonth: string;
    /**
     * V4 — solde du compte commun : corrections « Recaler sur le compte »
     * (absent tant qu'aucune correction n'a été posée ; voir accountBalance.ts).
     */
    balance?: BudgetBalance;
  };
  chores: ChoresState;
  forest: ForestState;
  groceries: GroceriesState;
  /** V3 — cercles de la semaine (absent tant qu'aucun cercle n'a eu lieu). */
  rituals?: RitualsState;
  /** V3 — lanternes (absent tant qu'aucune session n'a eu lieu). */
  focus?: FocusState;
  /** V3.2 — calendrier commun (absent tant qu'aucun événement n'a été créé). */
  calendar?: CalendarState;
}
