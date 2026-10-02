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
  applySettingsToMonth as coreApplySettingsToMonth,
  computeMonthSummary,
  currentMonthKey,
  ensureMonth as coreEnsureMonth,
  emptyAppState,
  migrateState,
  advanceDay,
  localDateKey,
  createTask,
  isoWeekday,
  addCompletion,
  removeCompletion,
  hasCompletion,
  isDueOn,
  creditKeyFor,
  grantCredit,
  tombstoneCredit,
  updateStreak,
  evaluateRareEvents,
  evaluateUnlocks,
  pauseForest,
  resumeForest,
  type AppState,
  type TaskAssignee,
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

export interface AppContextValue {
  /** null tant que l'état persisté n'est pas chargé (ou initialisé). */
  /** Compatibility projection for Budget views; persistence is appState V2. */
  state: PersistedState | null;
  appState: AppState | null;
  today: Date;
  createHomeTask: (title: string, assignee: TaskAssignee, recurrence: TaskRecurrence) => void;
  toggleHomeTask: (task: HouseholdTask) => void;
  toggleHomePause: () => void;
  saveStatus: SaveStatus;
  /** Mode de récupération actif (données illisibles ou stockage indisponible). */
  recovery: Recovery;
  /** Mois sélectionné, garanti présent dans state.months une fois chargé. */
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

  // Édition du mois
  setSalary: (monthKey: string, person: 'A' | 'B', cents: number) => void;
  setReserve: (monthKey: string, cents: number) => void;
  setExpenseAmount: (monthKey: string, expenseId: string, cents: number) => void;
  renameExpense: (monthKey: string, expenseId: string, label: string) => void;
  addExpense: (monthKey: string, label: string, cents: number) => void;
  removeExpense: (monthKey: string, expenseId: string) => void;

  // Réglages (s'appliquent aux NOUVEAUX mois, jamais aux mois existants)
  updatePersonSettings: (person: 'A' | 'B', patch: Partial<Omit<PersonSettings, 'id'>>) => void;
  updateRecurringExpense: (expenseId: string, patch: Partial<Omit<Expense, 'id'>>) => void;
  addRecurringExpense: (label: string, amountCents: number) => void;
  removeRecurringExpense: (expenseId: string) => void;
  setDefaultReserve: (cents: number) => void;
  /** Action explicite « Appliquer au mois affiché ». */
  applySettingsToCurrentMonth: () => void;

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
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapMonth(
  state: PersistedState,
  monthKey: string,
  fn: (m: MonthRecord) => MonthRecord,
): PersistedState {
  return {
    ...state,
    months: state.months.map((m) => (m.monthKey === monthKey ? fn(m) : m)),
  };
}

function prepareApp(app: AppState): AppState {
  const budget = coreEnsureMonth({ schemaVersion: 1, ...app.budget }, app.budget.selectedMonth);
  return { ...app, budget: { settings: budget.settings, months: budget.months, selectedMonth: budget.selectedMonth }, forest: advanceDay(app.forest, localDateKey(new Date())) };
}

export function AppProvider({
  adapter,
  children,
}: {
  adapter?: StorageAdapter;
  children: ReactNode;
}) {
  const adapterRef = useRef<StorageAdapter | null>(null);
  if (adapterRef.current === null) {
    adapterRef.current = adapter ?? new LocalStorageAdapter();
  }

  const [appState, setAppState] = useState<AppState | null>(null);
  const [today, setToday] = useState(() => new Date());
  const state = useMemo<PersistedState | null>(() => appState ? ({ schemaVersion: 1, ...appState.budget }) : null, [appState]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [recovery, setRecovery] = useState<Recovery>({ kind: 'none' });
  const hydratedRef = useRef(false);
  const recoveryRef = useRef<Recovery>(recovery);
  recoveryRef.current = recovery;

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
    const result = await adapterRef.current?.load();
    if (result !== undefined) {
      applyLoadResult(result);
    }
  }, [applyLoadResult]);

  // Sauvegarde de chaque modification valide, sans debounce fragile.
  // Bloquée en mode de récupération : aucune écriture avant action explicite.
  useEffect(() => {
    if (appState === null || !hydratedRef.current) return;
    if (recoveryRef.current.kind !== 'none') return;
    setSaveStatus('saving');
    void adapterRef.current?.save(appState).then(
      () => setSaveStatus('saved'),
      () => setSaveStatus('error'),
    );
  }, [appState]);

  const mutate = useCallback((fn: (s: PersistedState) => PersistedState) => {
    setAppState((prev) => {
      if (prev === null) return prev;
      const budget = fn({ schemaVersion: 1, ...prev.budget });
      return {
        ...prev,
        budget: { settings: budget.settings, months: budget.months, selectedMonth: budget.selectedMonth },
        household: { people: [budget.settings.personA, budget.settings.personB].map(person => ({ id: person.id, name: person.name })) },
      };
    });
  }, []);

  // --- Récupération explicite ---------------------------------------------

  const confirmReset = useCallback(() => {
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
      mutate((s) => coreEnsureMonth(s, monthKey));
    },
    [mutate],
  );

  const selectCurrentMonth = useCallback(() => {
    // Mois courant recalculé ici (et non stocké) pour rester dans le fuseau local.
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    mutate((s) => coreEnsureMonth(s, key));
  }, [mutate]);

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

  const setReserve = useCallback(
    (monthKey: string, cents: number) => {
      mutate((s) => mapMonth(s, monthKey, (m) => ({ ...m, reserveTargetCents: cents })));
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
        mapMonth(s, monthKey, (m) => ({
          ...m,
          expenses: m.expenses.filter((e) => e.id !== expenseId),
        })),
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

  const setDefaultReserve = useCallback(
    (cents: number) => {
      mutate((s) => ({
        ...s,
        settings: { ...s.settings, defaultReserveTargetCents: cents },
      }));
    },
    [mutate],
  );

  const applySettingsToCurrentMonth = useCallback(() => {
    mutate((s) => coreApplySettingsToMonth(s, s.selectedMonth));
  }, [mutate]);

  // --- Sauvegarde / transfert manuel ---------------------------------------

  const exportJson = useCallback(() => {
    return appState === null ? '' : buildExportJson(appState);
  }, [appState]);

  const importJson = useCallback(
    (text: string): { ok: true; summary: ImportSummary } | { ok: false; reason: string } => {
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

  // --- Maison / forest: the same persisted V2 state and serialized writes. ---
  const createHomeTask = useCallback((title: string, assignee: TaskAssignee, recurrence: TaskRecurrence) => {
    const now = new Date();
    if (!title.trim()) return;
    const task = createTask({ id: newId(), title: title.trim(), assignee, recurrence, weeklyDay: recurrence === 'weekly' ? isoWeekday(now) : undefined, monthlyDay: recurrence === 'monthly' ? now.getDate() : undefined }, localDateKey(now));
    setAppState(previous => previous ? { ...previous, chores: { ...previous.chores, tasks: [...previous.chores.tasks, task] } } : previous);
  }, []);

  const toggleHomeTask = useCallback((requested: HouseholdTask) => {
    const now = new Date();
    const day = localDateKey(now);
    const id = newId();
    setAppState(previous => {
      if (!previous) return previous;
      const task = previous.chores.tasks.find(item => item.id === requested.id);
      if (!task || (task.recurrence !== 'none' && !isDueOn(task, now))) return previous;
      const dueDate = task.recurrence === 'none' ? 'once' : day;
      const key = creditKeyFor(task, dueDate);
      const forest = advanceDay(previous.forest, day);
      if (hasCompletion(previous.chores.completions, task.id, dueDate)) {
        const result = removeCompletion(previous.chores.completions, task.id, dueDate);
        return { ...previous, chores: { ...previous.chores, completions: result.completions }, forest: tombstoneCredit(forest, key).forest };
      }
      const result = addCompletion(previous.chores.completions, task, dueDate, now, id);
      if (!result.added) return previous;
      const credit = grantCredit(forest, key, day);
      let nextForest = credit.forest;
      if (credit.granted) {
        nextForest = updateStreak(nextForest, day);
        nextForest = evaluateRareEvents(nextForest, forest.currentStreak, nextForest.currentStreak).forest;
        nextForest = evaluateUnlocks(nextForest);
      }
      return { ...previous, chores: { ...previous.chores, completions: result.completions }, forest: nextForest };
    });
  }, []);

  const toggleHomePause = useCallback(() => {
    const day = localDateKey(new Date());
    setAppState(previous => previous ? { ...previous, forest: previous.forest.paused ? resumeForest(previous.forest, day) : pauseForest(advanceDay(previous.forest, day), day) } : previous);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setToday(now);
      setAppState(previous => { if (!previous) return previous; const forest = advanceDay(previous.forest, localDateKey(now)); return forest === previous.forest ? previous : { ...previous, forest }; });
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
    () => (state ? (state.months.find((m) => m.monthKey === state.selectedMonth) ?? null) : null),
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
      createHomeTask,
      toggleHomeTask,
      toggleHomePause,
      saveStatus,
      recovery,
      currentMonth,
      currentSummary,
      confirmReset,
      retryLoad,
      selectMonth,
      selectCurrentMonth,
      setSalary,
      setReserve,
      setExpenseAmount,
      renameExpense,
      addExpense,
      removeExpense,
      updatePersonSettings,
      updateRecurringExpense,
      addRecurringExpense,
      removeRecurringExpense,
      setDefaultReserve,
      applySettingsToCurrentMonth,
      exportJson,
      importJson,
    }),
    [
      state,
      appState,
      today,
      createHomeTask,
      toggleHomeTask,
      toggleHomePause,
      saveStatus,
      recovery,
      currentMonth,
      currentSummary,
      confirmReset,
      retryLoad,
      selectMonth,
      selectCurrentMonth,
      setSalary,
      setReserve,
      setExpenseAmount,
      renameExpense,
      addExpense,
      removeExpense,
      updatePersonSettings,
      updateRecurringExpense,
      addRecurringExpense,
      removeRecurringExpense,
      setDefaultReserve,
      applySettingsToCurrentMonth,
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
