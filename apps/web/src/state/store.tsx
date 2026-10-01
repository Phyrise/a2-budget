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
  ensureMonth as coreEnsureMonth,
  emptyState,
  validatePersistedState,
  type Expense,
  type MonthRecord,
  type MonthSummary,
  type PersistedState,
  type PersonSettings,
} from '@a2/core';
import { LocalStorageAdapter, type StorageAdapter } from './storage';
import { buildExportJson, parseImportJson, type ImportSummary } from './exportImport';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AppContextValue {
  /** null tant que l'état persisté n'est pas chargé (ou initialisé). */
  state: PersistedState | null;
  saveStatus: SaveStatus;
  /**
   * Message de charge à afficher sobrement : les données locales étaient
   * illisibles et une session neuve a été démarrée. null sinon.
   */
  loadNotice: string | null;
  /** Mois sélectionné, garanti présent dans state.months une fois chargé. */
  currentMonth: MonthRecord | null;
  currentSummary: MonthSummary | null;

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

  const [state, setState] = useState<PersistedState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  // Chargement AVANT d'autoriser toute sauvegarde. Compatible StrictMode
  // (double montage) : le garde-fou hydratedRef empêche qu'un état initial
  // vide écrase les données persistées au démarrage.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await adapterRef.current?.load();
      if (cancelled) return;
      if (loaded !== null && loaded !== undefined) {
        const check = validatePersistedState(loaded);
        if (check.ok) {
          setState(check.state);
          hydratedRef.current = true;
          return;
        }
        // Données illisibles : pas de remise à zéro silencieuse. On démarre
        // une session neuve et on le signale ; l'ancienne clé ne sera
        // réécrite qu'après une modification explicite de l'utilisateur.
        setLoadNotice(
          'Les données enregistrées sur cet appareil sont illisibles. Une session neuve a été démarrée ; pensez à importer une sauvegarde si vous en avez une.',
        );
      }
      setState(emptyState());
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sauvegarde de chaque modification valide, sans debounce fragile.
  useEffect(() => {
    if (state === null || !hydratedRef.current) return;
    setSaveStatus('saving');
    void adapterRef.current?.save(state).then(
      () => setSaveStatus('saved'),
      () => setSaveStatus('error'),
    );
  }, [state]);

  const mutate = useCallback((fn: (s: PersistedState) => PersistedState) => {
    setState((prev) => (prev === null ? prev : fn(prev)));
  }, []);

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
    return state === null ? '' : buildExportJson(state);
  }, [state]);

  const importJson = useCallback(
    (text: string): { ok: true; summary: ImportSummary } | { ok: false; reason: string } => {
      const result = parseImportJson(text);
      if (!result.ok) {
        return result;
      }
      setState(result.state);
      return { ok: true, summary: result.summary };
    },
    [],
  );

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
      saveStatus,
      loadNotice,
      currentMonth,
      currentSummary,
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
      saveStatus,
      loadNotice,
      currentMonth,
      currentSummary,
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
