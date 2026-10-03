/**
 * Contexte du monde : une seule scène forêt (un seul canvas) montée par la
 * coquille, partagée par tous les écrans.
 *
 * - La coquille (app/) monte <WorldStage /> une fois et choisit sa
 *   présentation (hero Maison, bandeau, colonne desktop) via `setPresentation`.
 * - Les écrans déclenchent les retours visuels via `pulse` / `playGuardian`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useApp } from '../state/store';
import { LivingForest } from './LivingForest';
import type { LivingForestHandle, WorldState, WorldVariant, Who } from './types';
import { toWorldState } from './worldState';

export interface WorldPresentation {
  variant: WorldVariant;
  /** Animation active (false = image fixe). */
  live: boolean;
}

interface WorldContextValue {
  state: WorldState | null;
  presentation: WorldPresentation;
  setPresentation: (p: WorldPresentation) => void;
  pulse: (opts: { id: string; who: Who; fromClientX?: number; fromClientY?: number }) => void;
  playGuardian: () => void;
  /** Utilisé uniquement par <WorldStage>. */
  handleRef: React.MutableRefObject<LivingForestHandle | null>;
}

const WorldContext = createContext<WorldContextValue | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const { appState, today } = useApp();
  const handleRef = useRef<LivingForestHandle | null>(null);
  const [presentation, setPresentationState] = useState<WorldPresentation>({ variant: 'hero', live: true });
  const state = useMemo(() => (appState ? toWorldState(appState, today) : null), [appState, today]);

  const setPresentation = useCallback((p: WorldPresentation) => {
    setPresentationState((prev) => (prev.variant === p.variant && prev.live === p.live ? prev : p));
  }, []);
  const pulse = useCallback<WorldContextValue['pulse']>((opts) => handleRef.current?.pulse(opts), []);
  const playGuardian = useCallback(() => handleRef.current?.playGuardian(), []);

  const value = useMemo(
    () => ({ state, presentation, setPresentation, pulse, playGuardian, handleRef }),
    [state, presentation, setPresentation, pulse, playGuardian],
  );
  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}

export function useWorld(): WorldContextValue {
  const ctx = useContext(WorldContext);
  if (ctx === null) throw new Error('useWorld doit être utilisé dans <WorldProvider>');
  return ctx;
}

/** La scène elle-même, montée une seule fois par la coquille. */
export function WorldStage({ className }: { className?: string }) {
  const { state, presentation, handleRef } = useWorld();
  if (state === null) return null;
  return (
    <LivingForest
      ref={handleRef}
      state={state}
      variant={presentation.variant}
      live={presentation.live}
      className={className}
    />
  );
}
