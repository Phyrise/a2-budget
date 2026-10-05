/**
 * Contexte du monde : une seule scène forêt (un seul canvas) montée par la
 * coquille, partagée par tous les écrans.
 *
 * - La coquille (app/) monte <WorldStage /> une fois et choisit sa
 *   présentation (hero Maison, bandeau, colonne desktop) via `setPresentation`.
 * - Les écrans déclenchent les retours visuels via `pulse` / `playGuardian`.
 * - Mode développeur : `setPreview` surcharge ce que montre la forêt (stade,
 *   humeur, saison, pause, lanterne) sans jamais toucher aux données ; la
 *   coquille l'efface en quittant le mode. La saison de l'aperçu change aussi
 *   les peintures (forêt de saison, bandeaux des univers) ; `realState` garde
 *   la vraie saison (préchargement des saisons, panneau DEV).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useApp } from '../state/store';
import { LivingForest } from './LivingForest';
import type { LivingForestHandle, PulseOptions, WorldMotion, WorldState, WorldVariant, Who } from './types';
import { applyPreview, isPreviewActive, toWorldState, type WorldPreview } from './worldState';

export interface WorldPresentation {
  variant: WorldVariant;
  /** Animation active (false = image fixe). */
  live: boolean;
  /** Préférence « Forêt » (réglages). */
  motion: WorldMotion;
}

interface WorldContextValue {
  /** Ce que montre la forêt (état réel + aperçu éventuel). */
  state: WorldState | null;
  /** État réel, sans aperçu (saison réelle, stade réel : préchargement, DEV). */
  realState: WorldState | null;
  presentation: WorldPresentation;
  setPresentation: (p: WorldPresentation) => void;
  pulse: (opts: PulseOptions) => void;
  playGuardian: () => void;
  /** Lanterne : progression 0..1, ou null pour l'éteindre. */
  focus: (progress: number | null, who?: Who) => void;
  /** Aperçu non persistant (mode développeur), null = la vraie forêt. */
  preview: WorldPreview | null;
  setPreview: (p: SetStateAction<WorldPreview | null>) => void;
  /** Un aperçu change ce que montre la forêt. */
  previewActive: boolean;
  /** Utilisé uniquement par <WorldStage>. */
  handleRef: React.MutableRefObject<LivingForestHandle | null>;
}

const WorldContext = createContext<WorldContextValue | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const { appState, today } = useApp();
  const handleRef = useRef<LivingForestHandle | null>(null);
  const [presentation, setPresentationState] = useState<WorldPresentation>({ variant: 'hero', live: true, motion: 'full' });
  const [preview, setPreview] = useState<WorldPreview | null>(null);
  const realState = useMemo(() => (appState ? toWorldState(appState, today) : null), [appState, today]);
  const state = useMemo(() => (realState ? applyPreview(realState, preview) : null), [realState, preview]);
  const previewActive = isPreviewActive(preview);

  const setPresentation = useCallback((p: WorldPresentation) => {
    setPresentationState((prev) => (prev.variant === p.variant && prev.live === p.live && prev.motion === p.motion ? prev : p));
  }, []);
  const pulse = useCallback<WorldContextValue['pulse']>((opts) => handleRef.current?.pulse(opts), []);
  const playGuardian = useCallback(() => handleRef.current?.playGuardian(), []);
  const focus = useCallback((progress: number | null, who?: Who) => handleRef.current?.focus(progress, who), []);

  // Lanterne de l'aperçu : allumée / éteinte seulement quand l'aperçu change
  // (la lanterne d'une vraie session garde la main sinon).
  const previewLantern = preview?.lantern;
  const lanternShown = useRef(false);
  useEffect(() => {
    if (previewLantern !== undefined) {
      lanternShown.current = true;
      handleRef.current?.focus(previewLantern, 'both');
    } else if (lanternShown.current) {
      lanternShown.current = false;
      handleRef.current?.focus(null);
    }
  }, [previewLantern]);

  const value = useMemo(
    () => ({ state, realState, presentation, setPresentation, pulse, playGuardian, focus, preview, setPreview, previewActive, handleRef }),
    [state, realState, presentation, setPresentation, pulse, playGuardian, focus, preview, previewActive],
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
      motion={presentation.motion}
      className={className}
    />
  );
}
