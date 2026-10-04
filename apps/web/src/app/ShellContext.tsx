/**
 * Contexte de la coquille : module affiché, feuilles globales (Historique,
 * Réglages), préférences d'interface. Les écrans (sans props) le lisent via
 * `useShell()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { moduleFromUrl, readPrefs, syncModuleInUrl, writePrefs, type ModuleId, type UiPrefs } from './prefs';

export type ShellSheet = 'history' | 'settings' | 'dev' | null;

interface ShellContextValue {
  module: ModuleId;
  setModule: (module: ModuleId) => void;
  sheet: ShellSheet;
  openSheet: (sheet: Exclude<ShellSheet, null>) => void;
  closeSheet: () => void;
  prefs: UiPrefs;
  updatePrefs: (patch: Partial<UiPrefs>) => void;
  /** Largeur ≥ 1024 px : carnet à droite, forêt en fond. */
  isDesktop: boolean;
  /** Une feuille de premier plan (tâche, article…) est ouverte dans un écran. */
  setForegroundSheet: (open: boolean) => void;
  foregroundSheet: boolean;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(() => {
    const stored = readPrefs();
    const fromUrl = moduleFromUrl();
    return fromUrl ? { ...stored, module: fromUrl } : stored;
  });
  const [sheet, setSheet] = useState<ShellSheet>(null);
  const [foregroundSheet, setForegroundSheet] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    writePrefs(prefs);
  }, [prefs]);

  const updatePrefs = useCallback((patch: Partial<UiPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      return (Object.keys(patch) as Array<keyof UiPrefs>).every((k) => prev[k] === next[k]) ? prev : next;
    });
  }, []);

  const setModule = useCallback(
    (module: ModuleId) => {
      updatePrefs({ module });
      syncModuleInUrl(module);
    },
    [updatePrefs],
  );

  const openSheet = useCallback((next: Exclude<ShellSheet, null>) => setSheet(next), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const value = useMemo<ShellContextValue>(
    () => ({
      module: prefs.module,
      setModule,
      sheet,
      openSheet,
      closeSheet,
      prefs,
      updatePrefs,
      isDesktop,
      foregroundSheet,
      setForegroundSheet,
    }),
    [prefs, setModule, sheet, openSheet, closeSheet, updatePrefs, isDesktop, foregroundSheet],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (ctx === null) throw new Error('useShell doit être utilisé dans <ShellProvider>');
  return ctx;
}
