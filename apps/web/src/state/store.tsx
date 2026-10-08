import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  applySharedRates as coreApplySharedRates,
  computeMonthSummary,
  currentMonthKey,
  MAX_AMOUNT_CENTS,
  MAX_RATE_BPS,
  ensureMonth as coreEnsureMonth,
  emptyAppState,
  migrateState,
  withAnniversaries,
  advanceDay,
  localDateKey,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskToday,
  isoWeekday,
  pauseForest,
  resumeForest,
  prunePaidExpenses,
  openingBalance,
  recordBalanceCorrection as coreRecordBalanceCorrection,
  balanceCorrectionFor,
  balanceStatus,
  BALANCE_ANCHOR_NOTE,
  findOccurrenceCompletion,
  nextAssignee,
  skipDateFor,
  type AppState,
  type Role,
  type ChoreDoer,
  type TaskAssignee,
  type TaskEffort,
  type TaskRecurrence,
  type HouseholdTask,
  type Expense,
  type MonthRecord,
  type MonthSummary,
  type PersistedState,
  type PersonSettings,
} from '@a2/core';
import { LocalStorageAdapter, type StorageAdapter } from './storage';
import { buildExportJson, parseImportJson, type ImportSummary } from './exportImport';
import { useCareActions, type CareActions } from './careActions';
import { useCalendarActions, type CalendarActions } from './calendarActions';
import { useQuestActions, type QuestActions } from './questActions';
import { useBudgetActions, type BudgetActions } from './budgetActions';
import { useGroceryActions, type GroceryActions } from './groceryActions';
import { newId } from './ids';
import { mapMonthOrCreate, monthOrVirtual, prepareBudget, selectBudgetMonth } from './budgetMonths';
import type { SyncLink } from '../sync/syncLink';

export type { CareActions, CircleInput, FocusInput } from './careActions';
export type { CalendarActions, CalendarActionResult, RemovedCalendarEvent } from './calendarActions';
export type { BudgetActions } from './budgetActions';
export type { AddGroceryResult, GroceryActions, RemovedGrocery } from './groceryActions';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Mode de récupération : les données locales existantes sont illisibles
 * (JSON corrompu, version inconnue) ou le stockage est inaccessible.
 *
 * - L'état en mémoire reste utilisable (état neuf), mais AUCUNE écriture n'est
 *   persistée tant qu'une action de récupération n'a pas été explicitement
 *   confirmée (reset ou import).
 * - Le contenu existant de la clé n'est jamais remplacé automatiquement.
 */
export type Recovery =
  | { kind: 'none' }
  | { kind: 'unreadable'; message: string }
  | { kind: 'storage-unavailable'; message: string };

/** Saisie d'une nouvelle tâche Maison (feuille « Ajouter »). */
export interface NewHomeTaskInput {
  title: string;
  assignee: TaskAssignee;
  recurrence: TaskRecurrence;
  /** weekly : jour ISO 1 = lundi … 7 = dimanche. Défaut : aujourd'hui. */
  weeklyDay?: number;
  /** monthly : jour du mois 1..31 (ajusté au dernier jour des mois courts). Défaut : aujourd'hui. */
  monthlyDay?: number;
  /** V3 — 1 petit geste · 2 tâche · 3 corvée. */
  effort?: TaskEffort;
  /** V3 — tour à tour (exige assignee 'a' ou 'b' = qui commence). */
  rotation?: boolean;
  /** V3 — hebdomadaire souple : n'importe quel jour de la semaine (weekly seulement). */
  flexible?: boolean;
}

/** Champs modifiables d'une tâche Maison. */
export type HomeTaskPatch = Partial<
  Pick<
    HouseholdTask,
    'title' | 'assignee' | 'recurrence' | 'weeklyDay' | 'monthlyDay' | 'effort' | 'rotation' | 'flexible'
  >
>;

/** Résultat synchrone d'une bascule de tâche (pour lancer l'animation). */
export interface ToggleHomeTaskResult {
  /** Vrai si l'occurrence du jour est désormais faite. */
  completed: boolean;
  /**
   * Id du fait Maison créé (completed) ou retiré (annulation) — à passer à
   * `useWorld().pulse({ id })`. null si rien n'a changé (tâche inconnue ou non
   * due aujourd'hui, état pas encore chargé).
   */
  completionId: string | null;
  /** V3 — qui a fait l'occurrence cochée / décochée (`doneBy ?? assignee`) ; null si rien n'a changé. */
  doneBy: TaskAssignee | null;
  /** V5 — synchronisé : rien n'a changé, l'occurrence a été cochée par l'autre (lui seul la décoche). */
  othersGesture?: true;
}

export interface AppContextValue extends CareActions, CalendarActions, BudgetActions, GroceryActions, QuestActions {
  /** null tant que l'état persisté n'est pas chargé (ou initialisé). */
  /** Compatibility projection for Budget views; persistence is appState V2. */
  state: PersistedState | null;
  /** État applicatif V2 complet (budget, Maison, forêt, courses). null avant chargement. */
  appState: AppState | null;
  /** Maintenant (rafraîchi à minuit, au focus et au retour sur l'onglet). */
  today: Date;
  /**
   * V5 — qui tient le téléphone : le rôle du compte connecté en mode
   * synchronisé ('a' = AL, 'b' = AC), null en invité (l'app ne sait pas).
   */
  me: Role | null;

  // Maison (tâches) — mêmes écritures sérialisées que le budget
  /**
   * Crée une tâche. Titre nettoyé ; jour de semaine / du mois = aujourd'hui
   * s'il n'est pas fourni. Retourne la tâche créée, ou null si la saisie est
   * invalide (titre vide, jour hors plage) ou l'état pas encore chargé.
   */
  createHomeTask: (input: NewHomeTaskInput) => HouseholdTask | null;
  /**
   * Modifie une tâche (titre, qui, récurrence, jour). Passer en weekly /
   * monthly sans jour connu prend le jour d'aujourd'hui. Les faits Maison
   * passés gardent leur titre d'origine. Retourne false si la tâche est
   * inconnue ou le patch incohérent (rien n'est modifié).
   */
  updateHomeTask: (id: string, patch: HomeTaskPatch) => boolean;
  /**
   * Supprime une tâche. Les faits Maison passés restent dans l'historique et
   * la répartition ; la forêt ne perd rien. Retourne false si inconnue.
   */
  deleteHomeTask: (id: string) => boolean;
  /**
   * Coche / décoche l'occurrence du jour (ou l'unique occurrence d'une
   * ponctuelle). Synchrone : le résultat est calculé avant setState.
   * Crédits forêt : cap quotidien, tombstone à l'annulation, recocher ne
   * redonne pas de crédit. V3 : `opts.doneBy` = qui l'a vraiment fait
   * (« je m'en occupe ») ; défaut : à qui c'était le tour. Une occurrence
   * passée (« pas aujourd'hui ») n'est pas cochable (unskipToday d'abord).
   */
  toggleHomeTask: (task: HouseholdTask, opts?: { doneBy?: ChoreDoer }) => ToggleHomeTaskResult;
  /** « Mettre la maison en pause » / « Réveiller la forêt ». */
  toggleHomePause: () => void;

  saveStatus: SaveStatus;
  /** Mode de récupération actif (données illisibles ou stockage indisponible). */
  recovery: Recovery;
  /**
   * Mois affiché une fois chargé : enregistré dans state.months, ou virtuel
   * (préparé depuis les réglages) tant qu'il n'a été que consulté.
   */
  currentMonth: MonthRecord | null;
  currentSummary: MonthSummary | null;

  // Récupération explicite
  /** Confirme la remise à zéro : supprime la clé de l'app, démarre un état neuf. */
  confirmReset: () => void;
  /** Réessaie le chargement (stockage temporairement inaccessible). */
  retryLoad: () => void;

  // Sélection de mois
  selectMonth: (monthKey: string) => void;
  selectCurrentMonth: () => void;
  /**
   * Efface l'historique : supprime tous les mois sauf le mois sélectionné.
   * V4 : le solde reporté est gardé (correction posée sur le mois conservé).
   */
  clearHistory: () => void;

  // Édition du mois
  /** Salaire du mois (entièrement au taux de base). */
  setSalary: (monthKey: string, person: 'A' | 'B', cents: number) => void;
  /** Compléments du mois (heures sup, astreintes, gardes), au taux au-delà. */
  setBonus: (monthKey: string, person: 'A' | 'B', cents: number) => void;
  setExpenseAmount: (monthKey: string, expenseId: string, cents: number) => void;
  renameExpense: (monthKey: string, expenseId: string, label: string) => void;
  addExpense: (monthKey: string, label: string, cents: number) => void;
  removeExpense: (monthKey: string, expenseId: string) => void;

  // Réglages (s'appliquent aux NOUVEAUX mois ; les taux, eux, sont globaux)
  /** Nom, salaire habituel (préremplit un nouveau mois)… Les taux : `setSharedRates`. */
  updatePersonSettings: (person: 'A' | 'B', patch: Partial<Omit<PersonSettings, 'id'>>) => void;
  /**
   * Taux communs du couple, globaux (V4.2) : réglages ET mois courant réel et
   * suivants ; les mois passés gardent les leurs (le solde reporté ne bouge pas).
   */
  setSharedRates: (baseRateBps: number, variableRateBps: number) => void;
  /** Renomme une personne (nom nettoyé, vide ignoré → false) ; household.people suit. */
  renamePerson: (person: 'A' | 'B', name: string) => boolean;
  updateRecurringExpense: (expenseId: string, patch: Partial<Omit<Expense, 'id'>>) => void;
  addRecurringExpense: (label: string, amountCents: number) => void;
  removeRecurringExpense: (expenseId: string) => void;

  // Sauvegarde / transfert manuel
  exportJson: () => string;
  importJson: (text: string) => { ok: true; summary: ImportSummary } | { ok: false; reason: string };
}

const AppContext = createContext<AppContextValue | null>(null);

const UNREADABLE_MESSAGE =
  'Les données enregistrées sur cet appareil sont illisibles (format inattendu ou version inconnue). ' +
  'Elles n’ont pas été modifiées. Vos modifications actuelles ne seront pas sauvegardées ' +
  'tant que vous n’aurez pas confirmé une action : importer une sauvegarde (Réglages) ou recommencer à zéro.';

const STORAGE_UNAVAILABLE_MESSAGE =
  'Le stockage local de ce navigateur est inaccessible. L’application reste utilisable, ' +
  'mais aucune modification ne sera sauvegardée. Réessayez, ou vérifiez les paramètres du navigateur.';

/** Identifiant stable, avec repli hors contexte sécurisé (LAN en HTTP). */
/** Taux en bps valide (entier 0–10000) : garde-fou avant une transition qui lèverait. */
function isRateBps(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_RATE_BPS;
}

/** Modifie un mois ; un mois virtuel (seulement consulté) est créé à cette première modification. */
function mapMonth(
  state: PersistedState,
  monthKey: string,
  fn: (m: MonthRecord) => MonthRecord,
): PersistedState {
  return mapMonthOrCreate(state, monthKey, fn);
}

function prepareApp(app: AppState): AppState {
  const now = new Date();
  // Mois courant créé s'il est affiché ; données d'avant le solde ancrées (V4).
  const budget = prepareBudget(app.budget, now, { id: newId(), recordedAt: now.toISOString() });
  // V4.3 : anniversaires préremplis s'ils manquent (idempotent).
  return withAnniversaries({ ...app, budget, forest: advanceDay(app.forest, localDateKey(now)) });
}

export function AppProvider({
  adapter,
  sync,
  children,
}: {
  adapter?: StorageAdapter;
  /**
   * V5 — mode synchronisé (copie commune) : l'état vient du lien et chaque
   * transition locale lui est confiée ; `a2-budget:state:v1` n'est ni lu ni
   * écrit. Absent (invité) : le store d'avant, inchangé. Fixe pour un montage.
   */
  sync?: SyncLink;
  children: ReactNode;
}) {
  const adapterRef = useRef<StorageAdapter | null>(null);
  if (adapterRef.current === null) {
    adapterRef.current = adapter ?? new LocalStorageAdapter();
  }
  const syncRef = useRef(sync);
  const me = sync?.role ?? null;

  const [appState, setAppState] = useState<AppState | null>(null);
  const [today, setToday] = useState(() => new Date());
  const state = useMemo<PersistedState | null>(() => appState ? ({ schemaVersion: 1, ...appState.budget }) : null, [appState]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [recovery, setRecovery] = useState<Recovery>({ kind: 'none' });
  const hydratedRef = useRef(false);
  const recoveryRef = useRef<Recovery>(recovery);
  recoveryRef.current = recovery;
  // Dernier état connu, pour les actions qui renvoient un résultat synchrone
  // (toggleHomeTask, addGrocery…). Resynchronisé à chaque rendu, et avancé
  // de façon optimiste par `transact` pour que deux actions dans le même tick
  // (double tap) voient la première.
  const latestRef = useRef<AppState | null>(appState);
  latestRef.current = appState;

  /**
   * Applique une transition PURE et déterministe (ids et horloge capturés
   * par l'appelant) : le résultat est calculé tout de suite sur le dernier
   * état connu, puis la même transition est rejouée dans l'updater de
   * setState (sûr en StrictMode, qui rejoue les updaters ; composé avec les
   * autres mises à jour en attente). Écriture sérialisée par l'effet de
   * sauvegarde, comme toute autre modification.
   */
  const transact = useCallback(
    <R,>(fn: (s: AppState) => { state: AppState; result: R }, fallback: R): R => {
      const current = latestRef.current;
      if (current === null) return fallback;
      const { state: next, result } = fn(current);
      if (next !== current) {
        latestRef.current = next;
        const link = syncRef.current;
        if (link !== undefined) {
          // Synchronisé : une seule transition, confiée au lien ; l'état
          // projeté qui revient (souvent dans le même tour) la remplace.
          setAppState(next);
          link.commit(current, next);
        } else {
          setAppState((prev) => (prev === null ? prev : fn(prev).state));
        }
      }
      return result;
    },
    [],
  );

  // Application d'un résultat de chargement à l'état du store.
  const applyLoadResult = useCallback((result: Awaited<ReturnType<StorageAdapter['load']>>) => {
    if (result.status === 'absent') {
      setAppState(prepareApp(emptyAppState()));
      setRecovery({ kind: 'none' });
      hydratedRef.current = true;
      return;
    }

    if (result.status === 'ok') {
      const check = migrateState(result.state);
      if (check.ok) {
        setAppState(prepareApp(check.state));
        setRecovery({ kind: 'none' });
        hydratedRef.current = true;
        return;
      }
      // Contenu lisible mais invalide (version inconnue, champs invalides) :
      // mode de récupération. L'état en mémoire est neuf et utilisable, mais
      // rien n'est persisté ; la clé existante n'est pas touchée.
      setAppState(prepareApp(emptyAppState()));
      setRecovery({ kind: 'unreadable', message: UNREADABLE_MESSAGE });
      hydratedRef.current = true;
      return;
    }

    // result.status === 'error' : JSON corrompu (raw préservé dans la clé)
    // ou accès au stockage refusé.
    setAppState(prepareApp(emptyAppState()));
    setRecovery(
      result.reason === 'access'
        ? { kind: 'storage-unavailable', message: STORAGE_UNAVAILABLE_MESSAGE }
        : { kind: 'unreadable', message: UNREADABLE_MESSAGE },
    );
    hydratedRef.current = true;
  }, []);

  // Chargement AVANT d'autoriser toute sauvegarde. Compatible StrictMode
  // (double montage) : le premier montage annulé n'applique rien ; le
  // garde-fou hydratedRef empêche qu'un état initial vide écrase les données
  // persistées au démarrage.
  useEffect(() => {
    const link = syncRef.current;
    if (link !== undefined) {
      // Copie commune : affichée tout de suite, préparée (mois courant…) comme une transition locale.
      const prepared = prepareApp(link.initial);
      latestRef.current = prepared;
      hydratedRef.current = true;
      setAppState(prepared);
      link.commit(link.initial, prepared);
      return link.listen((projected) => {
        latestRef.current = projected;
        setAppState(projected);
      });
    }
    let cancelled = false;
    void (async () => {
      const result = await adapterRef.current?.load();
      if (cancelled || result === undefined) return;
      applyLoadResult(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLoadResult]);

  const doLoad = useCallback(async () => {
    if (syncRef.current !== undefined) return; // copie commune : jamais les données locales
    const result = await adapterRef.current?.load();
    if (result !== undefined) {
      applyLoadResult(result);
    }
  }, [applyLoadResult]);

  // Sauvegarde de chaque modification valide, sans debounce fragile.
  // Bloquée en mode de récupération : aucune écriture avant action explicite.
  useEffect(() => {
    if (appState === null || !hydratedRef.current) return;
    if (recoveryRef.current.kind !== 'none' || syncRef.current !== undefined) return;
    setSaveStatus('saving');
    void adapterRef.current?.save(appState).then(
      () => setSaveStatus('saved'),
      () => setSaveStatus('error'),
    );
  }, [appState]);

  const mutate = useCallback((fn: (s: PersistedState) => PersistedState) => {
    const apply = (prev: AppState): AppState => {
      const budget = fn({ schemaVersion: 1, ...prev.budget });
      return {
        ...prev,
        // `...prev.budget` garde le solde du compte commun (V4, budget.balance).
        budget: { ...prev.budget, settings: budget.settings, months: budget.months, selectedMonth: budget.selectedMonth },
        household: { people: [budget.settings.personA, budget.settings.personB].map(person => ({ id: person.id, name: person.name })) },
      };
    };
    // Synchronisé : calculée une fois (ids compris), confiée au lien.
    if (syncRef.current !== undefined) transact((s) => ({ state: apply(s), result: undefined }), undefined);
    else setAppState((prev) => (prev === null ? prev : apply(prev)));
  }, [transact]);

  // --- Récupération explicite ---------------------------------------------

  const confirmReset = useCallback(() => {
    if (syncRef.current !== undefined) return; // la copie commune ne s'efface pas d'ici
    void adapterRef.current?.clear().then(() => {
      setAppState(prepareApp(emptyAppState()));
      setRecovery({ kind: 'none' });
    }, () => setSaveStatus('error'));
  }, []);

  const retryLoad = useCallback(() => {
    void doLoad();
  }, [doLoad]);

  // --- Sélection de mois -------------------------------------------------

  const selectMonth = useCallback(
    (monthKey: string) => {
      // Consulter n'écrit rien : seul le mois courant est créé (budgetMonths).
      mutate((s) => selectBudgetMonth(s, monthKey));
    },
    [mutate],
  );

  const selectCurrentMonth = useCallback(() => {
    // Mois courant recalculé ici (et non stocké) pour rester dans le fuseau local.
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    mutate((s) => coreEnsureMonth(s, key));
  }, [mutate]);

  const clearHistory = useCallback(() => {
    // Supprime tous les mois sauf le mois sélectionné (conservé pour ne pas
    // perdre le mois en cours d'édition). V4 : le report des mois effacés est
    // gardé en posant une correction (solde d'ouverture) sur le mois conservé.
    const id = newId();
    const recordedAt = new Date().toISOString();
    transact((s) => {
      const keep = s.budget.selectedMonth;
      if (s.budget.months.every((m) => m.monthKey === keep)) return { state: s, result: undefined };
      // Le mois affiché (même seulement consulté) est conservé.
      const months = [monthOrVirtual(s.budget, keep)];
      let budget: AppState['budget'] = { ...s.budget, months };
      const hadEarlier = s.budget.months.some((m) => m.monthKey < keep);
      if (hadEarlier && balanceCorrectionFor(s.budget, keep) === undefined) {
        const note = balanceStatus(s.budget).confirmed ? undefined : BALANCE_ANCHOR_NOTE;
        budget = coreRecordBalanceCorrection(budget, keep, openingBalance(s.budget, keep), {
          id,
          recordedAt,
          ...(note !== undefined ? { note } : {}),
        });
      }
      return { state: { ...s, budget }, result: undefined };
    }, undefined);
  }, [transact]);

  // --- Édition du mois ----------------------------------------------------

  const setSalary = useCallback(
    (monthKey: string, person: 'A' | 'B', cents: number) => {
      mutate((s) =>
        mapMonth(s, monthKey, (m) =>
          person === 'A' ? { ...m, salaryACents: cents } : { ...m, salaryBCents: cents },
        ),
      );
    },
    [mutate],
  );

  const setBonus = useCallback(
    (monthKey: string, person: 'A' | 'B', cents: number) => {
      if (!Number.isInteger(cents) || cents < 0 || cents > MAX_AMOUNT_CENTS) return;
      mutate((s) =>
        mapMonth(s, monthKey, (m) =>
          person === 'A' ? { ...m, bonusACents: cents } : { ...m, bonusBCents: cents },
        ),
      );
    },
    [mutate],
  );

  const setExpenseAmount = useCallback(
    (monthKey: string, expenseId: string, cents: number) => {
      mutate((s) =>
        mapMonth(s, monthKey, (m) => ({
          ...m,
          expenses: m.expenses.map((e) => (e.id === expenseId ? { ...e, amountCents: cents } : e)),
        })),
      );
    },
    [mutate],
  );

  const renameExpense = useCallback(
    (monthKey: string, expenseId: string, label: string) => {
      mutate((s) =>
        mapMonth(s, monthKey, (m) => ({
          ...m,
          expenses: m.expenses.map((e) => (e.id === expenseId ? { ...e, label } : e)),
        })),
      );
    },
    [mutate],
  );

  const addExpense = useCallback(
    (monthKey: string, label: string, cents: number) => {
      mutate((s) =>
        mapMonth(s, monthKey, (m) => ({
          ...m,
          expenses: [...m.expenses, { id: newId(), label, amountCents: cents }],
        })),
      );
    },
    [mutate],
  );

  const removeExpense = useCallback(
    (monthKey: string, expenseId: string) => {
      mutate((s) =>
        mapMonth(s, monthKey, (m) =>
          // V4 : la case « payée » de la dépense retirée disparaît aussi.
          prunePaidExpenses({ ...m, expenses: m.expenses.filter((e) => e.id !== expenseId) }),
        ),
      );
    },
    [mutate],
  );

  // --- Réglages -----------------------------------------------------------

  const updatePersonSettings = useCallback(
    (person: 'A' | 'B', patch: Partial<Omit<PersonSettings, 'id'>>) => {
      mutate((s) => ({
        ...s,
        settings: {
          ...s.settings,
          [person === 'A' ? 'personA' : 'personB']: {
            ...s.settings[person === 'A' ? 'personA' : 'personB'],
            ...patch,
          },
        },
      }));
    },
    [mutate],
  );

  const setSharedRates = useCallback(
    (baseRateBps: number, variableRateBps: number) => {
      if (!isRateBps(baseRateBps) || !isRateBps(variableRateBps)) return;
      // Mois courant réel capturé ici (et non dans l'updater, rejoué en StrictMode).
      const from = currentMonthKey(new Date());
      mutate((s) => coreApplySharedRates(s, baseRateBps, variableRateBps, from));
    },
    [mutate],
  );

  const renamePerson = useCallback(
    (person: 'A' | 'B', name: string): boolean => {
      const clean = name.replace(/\s+/g, ' ').trim();
      if (clean === '') return false;
      // mutate resynchronise household.people depuis les réglages.
      updatePersonSettings(person, { name: clean });
      return true;
    },
    [updatePersonSettings],
  );

  const updateRecurringExpense = useCallback(
    (expenseId: string, patch: Partial<Omit<Expense, 'id'>>) => {
      mutate((s) => ({
        ...s,
        settings: {
          ...s.settings,
          recurringExpenses: s.settings.recurringExpenses.map((e) =>
            e.id === expenseId ? { ...e, ...patch } : e,
          ),
        },
      }));
    },
    [mutate],
  );

  const addRecurringExpense = useCallback(
    (label: string, amountCents: number) => {
      mutate((s) => ({
        ...s,
        settings: {
          ...s.settings,
          recurringExpenses: [
            ...s.settings.recurringExpenses,
            { id: newId(), label, amountCents },
          ],
        },
      }));
    },
    [mutate],
  );

  const removeRecurringExpense = useCallback(
    (expenseId: string) => {
      mutate((s) => ({
        ...s,
        settings: {
          ...s.settings,
          recurringExpenses: s.settings.recurringExpenses.filter((e) => e.id !== expenseId),
        },
      }));
    },
    [mutate],
  );

  // --- Sauvegarde / transfert manuel ---------------------------------------

  const exportJson = useCallback(() => {
    return appState === null ? '' : buildExportJson(appState);
  }, [appState]);

  const importJson = useCallback(
    (text: string): { ok: true; summary: ImportSummary } | { ok: false; reason: string } => {
      // Copie commune : un import remplacerait les données des deux (refusé).
      if (syncRef.current !== undefined) return { ok: false, reason: 'sync' };
      const result = parseImportJson(text);
      if (!result.ok) {
        return result;
      }
      // Import confirmé par l'utilisateur : remplacement explicite de l'état
      // (et sortie du mode de récupération, si actif).
      setAppState(prepareApp(result.state));
      setRecovery({ kind: 'none' });
      return { ok: true, summary: result.summary };
    },
    [],
  );

  // --- Maison : tâches + forêt (même état V2, mêmes écritures sérialisées) ---

  const createHomeTask = useCallback(
    (input: NewHomeTaskInput): HouseholdTask | null => {
      const now = new Date();
      let task: HouseholdTask;
      try {
        task = createTask(
          {
            id: newId(),
            title: input.title,
            assignee: input.assignee,
            recurrence: input.recurrence,
            weeklyDay: input.recurrence === 'weekly' ? (input.weeklyDay ?? isoWeekday(now)) : undefined,
            monthlyDay: input.recurrence === 'monthly' ? (input.monthlyDay ?? now.getDate()) : undefined,
            ...(input.effort !== undefined ? { effort: input.effort } : {}),
            ...(input.rotation === true ? { rotation: true } : {}),
            ...(input.flexible === true && input.recurrence === 'weekly' ? { flexible: true } : {}),
          },
          localDateKey(now),
        );
      } catch {
        return null;
      }
      return transact(
        (s) => ({
          state: { ...s, chores: { ...s.chores, tasks: [...s.chores.tasks, task] } },
          result: task as HouseholdTask | null,
        }),
        null,
      );
    },
    [transact],
  );

  const updateHomeTask = useCallback(
    (id: string, patch: HomeTaskPatch): boolean => {
      const now = new Date();
      return transact((s) => {
        const current = s.chores.tasks.find((t) => t.id === id);
        if (current === undefined) return { state: s, result: false };
        const recurrence = patch.recurrence ?? current.recurrence;
        const effective: HomeTaskPatch = { ...patch };
        if (recurrence === 'weekly' && effective.weeklyDay === undefined && current.weeklyDay === undefined) {
          effective.weeklyDay = isoWeekday(now);
        }
        if (recurrence === 'monthly' && effective.monthlyDay === undefined && current.monthlyDay === undefined) {
          effective.monthlyDay = now.getDate();
        }
        try {
          const tasks = updateTask(s.chores.tasks, id, effective);
          return {
            state: tasks === s.chores.tasks ? s : { ...s, chores: { ...s.chores, tasks } },
            result: true,
          };
        } catch {
          return { state: s, result: false };
        }
      }, false);
    },
    [transact],
  );

  const deleteHomeTask = useCallback(
    (id: string): boolean =>
      transact((s) => {
        const tasks = deleteTask(s.chores.tasks, id);
        return tasks === s.chores.tasks
          ? { state: s, result: false }
          : { state: { ...s, chores: { ...s.chores, tasks } }, result: true };
      }, false),
    [transact],
  );

  const toggleHomeTask = useCallback(
    (task: HouseholdTask, opts?: { doneBy?: ChoreDoer }): ToggleHomeTaskResult => {
      const now = new Date();
      const completionId = newId();
      const link = syncRef.current;
      const current = latestRef.current;
      const live = current === null ? undefined : findOccurrenceCompletion(task, current.chores.completions, now);
      // Synchronisé : on ne décoche que ses propres gestes (ceux de l'autre restent).
      if (link !== undefined && live !== undefined && !link.canUndo('completions', task.id, live.dueDate)) {
        return { completed: false, completionId: null, doneBy: null, othersGesture: true };
      }
      return transact<ToggleHomeTaskResult>(
        (s) => {
          // « Qui ? » sans réponse (tâche libre) : le compte connecté.
          const doneBy = opts?.doneBy ??
            (me !== null && nextAssignee(task, s.chores.completions) === 'unassigned' ? me : undefined);
          const r = toggleTaskToday(s, task.id, now, completionId, doneBy !== undefined ? { doneBy } : {});
          return {
            state: r.state,
            result: { completed: r.completed, completionId: r.completionId, doneBy: r.doneBy ?? null },
          };
        },
        { completed: false, completionId: null, doneBy: null },
      );
    },
    [transact, me],
  );

  const toggleHomePause = useCallback(() => {
    const day = localDateKey(new Date());
    const toggle = (s: AppState): AppState => ({ ...s, forest: s.forest.paused ? resumeForest(s.forest, day) : pauseForest(advanceDay(s.forest, day), day) });
    if (syncRef.current !== undefined) transact((s) => ({ state: toggle(s), result: undefined }), undefined);
    else setAppState(previous => previous ? toggle(previous) : previous);
  }, [transact]);

  // --- V3 « Prendre soin ensemble » (passages, suggestions, cercle, lanternes)
  const careActions = useCareActions(transact);
  // V5 — « pas aujourd'hui » : signé du compte connecté ; on n'annule que les siens.
  const care = useMemo<CareActions>(() => {
    if (syncRef.current === undefined) return careActions;
    const link = syncRef.current;
    return {
      ...careActions,
      skipToday: (task, by) => careActions.skipToday(task, by ?? me ?? undefined),
      unskipToday: (task) => link.canUndo('skips', task.id, skipDateFor(task, new Date())) && careActions.unskipToday(task),
    };
  }, [careActions, me]);
  const calendar = useCalendarActions(transact);
  const budgetV4 = useBudgetActions(transact);

  // --- Courses (V5 : l'ajout est signé du compte connecté) ---------------
  const groceries = useGroceryActions(transact, me);
  // V5.1 — quêtes communes
  const quests = useQuestActions(transact, me);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setToday(now);
      // Synchronisé : la forêt est rejouée par le moteur jusqu'au nouveau jour.
      if (syncRef.current !== undefined) syncRef.current.refresh();
      else setAppState(previous => { if (!previous) return previous; const forest = advanceDay(previous.forest, localDateKey(now)); return forest === previous.forest ? previous : { ...previous, forest }; });
      clearTimeout(timer);
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, tomorrow.getTime() - now.getTime() + 100);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // --- Dérivés --------------------------------------------------------------

  const currentMonth = useMemo(
    // Mois affiché : enregistré, ou virtuel (consulté seulement, jamais écrit).
    () => (state ? monthOrVirtual(state, state.selectedMonth) : null),
    [state],
  );

  const currentSummary = useMemo(
    () => (currentMonth ? computeMonthSummary(currentMonth) : null),
    [currentMonth],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      appState,
      today,
      me,
      createHomeTask,
      updateHomeTask,
      deleteHomeTask,
      toggleHomeTask,
      toggleHomePause,
      ...care,
      ...calendar,
      ...budgetV4,
      ...groceries,
      ...quests,
      saveStatus,
      recovery,
      currentMonth,
      currentSummary,
      confirmReset,
      retryLoad,
      selectMonth,
      selectCurrentMonth,
      clearHistory,
      setSalary,
      setBonus,
      setExpenseAmount,
      renameExpense,
      addExpense,
      removeExpense,
      updatePersonSettings,
      setSharedRates,
      renamePerson,
      updateRecurringExpense,
      addRecurringExpense,
      removeRecurringExpense,
      exportJson,
      importJson,
    }),
    [
      state,
      appState,
      today,
      me,
      createHomeTask,
      updateHomeTask,
      deleteHomeTask,
      toggleHomeTask,
      toggleHomePause,
      care,
      calendar,
      budgetV4,
      groceries,
      quests,
      saveStatus,
      recovery,
      currentMonth,
      currentSummary,
      confirmReset,
      retryLoad,
      selectMonth,
      selectCurrentMonth,
      clearHistory,
      setSalary,
      setBonus,
      setExpenseAmount,
      renameExpense,
      addExpense,
      removeExpense,
      updatePersonSettings,
      setSharedRates,
      renamePerson,
      updateRecurringExpense,
      addRecurringExpense,
      removeRecurringExpense,
      exportJson,
      importJson,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (ctx === null) {
    throw new Error('useApp doit être utilisé dans <AppProvider>');
  }
  return ctx;
}
