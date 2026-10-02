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

import type { MonthRecord, Settings } from '../types.js';

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
}

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
// Courses (futur — simple échafaudage)
// ---------------------------------------------------------------------------

/** Article de la liste de courses (MVP minimal, module à venir). */
export interface GroceryItem {
  id: string;
  label: string;
  done: boolean;
}

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
 * - `groceries` : échafaudage du futur module Courses.
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
  };
  chores: {
    tasks: HouseholdTask[];
    completions: ChoreCompletion[];
  };
  forest: ForestState;
  groceries: {
    items: GroceryItem[];
  };
}
