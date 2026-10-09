/**
 * Coquille A² Home.
 *
 * - Un seul monde (WorldStage) fixe en fond, plein bord ; sa présentation
 *   suit le module et la largeur : Maison mobile = hero vivant (54svh),
 *   Budget / Courses / Calendrier = bandeau peint de leur univers (24svh),
 *   ≥ 1024 px = monde en fond et carnet de 480 px à droite — forêt vivante
 *   pour Maison et Calendrier, peinture portrait de l'univers pour Budget
 *   (Chihiro) et Courses (Kiki), en fondu enchaîné (WorldBackdrop).
 * - Chaque module pose son accent de couleur (--module-accent) sur
 *   .app--<module> : pilule active et en-tête.
 * - Mode développeur (Réglages › À propos) : bouton « DEV » dans l'en-tête,
 *   panneau des valeurs cachées, aperçus non persistants de la forêt
 *   (bandeau « Aperçu »), tout effacé en quittant le mode.
 * - Le contenu défile par-dessus : fenêtre sur la forêt (--world-h) puis la
 *   feuille encre. La scène se fige quand elle est recouverte ou masquée.
 * - En-tête (marque + Historique / lune de pause sur Maison / Réglages),
 *   pilule de navigation (effacée seulement pendant que le clavier est
 *   ouvert), feuilles globales, indicateur d'enregistrement, mise à jour PWA,
 *   petits sons de la forêt (useSoundEvents, monté une fois), préchargement
 *   discret des peintures de saison (useSeasonPrefetch, monté une fois).
 * - Pas de zoom (pincement, double toucher) : useNoZoom.
 * - V4.3 : fête d'anniversaire d'AL ou d'AC à la première ouverture du jour
 *   (BirthdayParty).
 */
import '../styles/base.css';
import '../styles/ui.css';
import '../styles/shell.css';
import './nav.css';
import './universes.css';
import './desktop.css';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BudgetScreen } from '../features/budget/BudgetScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { CoursesScreen } from '../features/courses/CoursesScreen';
import { DevPanel } from '../features/dev/DevPanel';
import { BirthdayParty } from '../features/fetes/BirthdayParty';
import { QuestRewards } from '../features/quests/QuestSpot';
import { HistorySheetContent } from '../features/history/HistorySheetContent';
import { MaisonScreen } from '../features/maison/MaisonScreen';
import { SettingsSheetContent } from '../features/settings/SettingsSheetContent';
import { Sheet, ToastProvider, cx } from '../ui';
import { WorldProvider, useWorld } from '../world/WorldContext';
import { CalendarHistory } from './CalendarHistory';
import { Header } from './Header';
import { ModuleNav } from './ModuleNav';
import { HISTORY_TITLES, WORLD_RATIO, showsLivingForest } from './modules';
import type { ModuleId } from './prefs';
import { PreviewBanner } from './PreviewBanner';
import { ShellProvider, useMediaQuery, useShell } from './ShellContext';
import { useSoundEvents } from './sound';
import { UpdatePrompt } from './UpdatePrompt';
import { useKeyboardOpen } from './useKeyboardOpen';
import { useNoZoom } from './noZoom';
import { useForgetPreviewSeason, useSeasonPrefetch } from './seasonPrefetch';
import { useApp } from '../state/store';
import { WorldBackdrop } from './WorldBackdrop';
import { LiveProvider } from '../presence/LiveContext';
import { PartnerAvatar } from '../presence/avatar/PartnerAvatar';
import { LetterWatcher } from '../features/rituals/letters/LetterWatcher';

function Screen({ module }: { module: ModuleId }) {
  if (module === 'budget') return <BudgetScreen />;
  if (module === 'courses') return <CoursesScreen />;
  if (module === 'calendar') return <CalendarScreen />;
  return <MaisonScreen />;
}

/** Suivi du défilement : en-tête opaque, scène recouverte. */
function useScrollState(module: ModuleId, isDesktop: boolean) {
  const [state, setState] = useState({ solid: false, covered: false });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const worldH = isDesktop ? 0 : window.innerHeight * WORLD_RATIO[module];
      const solid = isDesktop ? y > 8 : y > worldH - 72;
      const covered = !isDesktop && y > worldH * 0.6;
      setState((prev) => (prev.solid === solid && prev.covered === covered ? prev : { solid, covered }));
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [module, isDesktop]);
  return state;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

function Shell() {
  const { module, sheet, closeSheet, prefs, isDesktop, foregroundSheet } = useShell();
  const { setPresentation, setPreview, realState, preview } = useWorld();
  const { today } = useApp();
  const { solid, covered } = useScrollState(module, isDesktop);
  const visible = usePageVisible();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shownModule = useRef(module);
  const keyboardOpen = useKeyboardOpen();
  // Petits sons de la forêt (tâche faite, créature, croissance…), montés une fois.
  useSoundEvents();
  useNoZoom();
  // Peintures de saison hors précache : préchargement discret (saison en
  // cours, puis la suivante ~14 jours avant), d'après la VRAIE forêt.
  useSeasonPrefetch(realState?.stage ?? null, today, isDesktop);
  // Fin d'un aperçu de saison : ses images ne restent pas dans le cache des saisons.
  useForgetPreviewSeason(preview?.season ?? null);

  // Présentation du monde selon module, largeur, recouvrement et préférence.
  // La forêt ne s'anime que là où elle se voit : Maison, et Calendrier sur
  // ordinateur ; sous une peinture d'univers, elle se fige.
  const variant = isDesktop ? 'backdrop' : module === 'maison' ? 'hero' : 'banner';
  const live =
    showsLivingForest(module, isDesktop) && visible && !covered && sheet === null && !(foregroundSheet && !isDesktop);
  const motion = reducedMotion ? 'still' : prefs.forestMotion;
  useEffect(() => {
    setPresentation({ variant, live, motion });
  }, [setPresentation, variant, live, motion]);

  // Quitter le mode développeur efface tout aperçu (la vraie forêt revient).
  useEffect(() => {
    if (!prefs.devMode) setPreview(null);
  }, [prefs.devMode, setPreview]);

  // Changement de module : retour en haut, puis focus du titre de l'écran.
  useLayoutEffect(() => {
    if (shownModule.current === module) return;
    shownModule.current = module;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const title = document.getElementById(`${module}-title`);
    title?.focus({ preventScroll: true });
  }, [module]);

  return (
    <div
      className={cx('app', `app--${module}`, isDesktop && 'app--desktop', keyboardOpen && 'app--keyboard', motion === 'still' && 'app--still')}
      style={{ '--world-ratio': WORLD_RATIO[module] } as CSSProperties}
    >
      <WorldBackdrop module={module} isDesktop={isDesktop} />

      <Header solid={solid} />
      <PreviewBanner />

      <main id="contenu" className="app-main" tabIndex={-1}>
        <div key={module} className="module-view">
          <Screen module={module} />
        </div>
      </main>

      <div className="app-dock">
        <PartnerAvatar />
        <ModuleNav />
      </div>
      <UpdatePrompt />
      <BirthdayParty />
      <QuestRewards />
      <LetterWatcher />

      <Sheet open={sheet === 'history'} onClose={closeSheet} title={HISTORY_TITLES[module]} size="full">
        {module === 'calendar' ? <CalendarHistory /> : <HistorySheetContent />}
      </Sheet>
      <Sheet open={sheet === 'settings'} onClose={closeSheet} title="Réglages" size="full">
        <SettingsSheetContent />
      </Sheet>
      {prefs.devMode && <DevPanel open={sheet === 'dev'} onClose={closeSheet} />}
    </div>
  );
}

export function App() {
  return (
    <WorldProvider>
      <ToastProvider>
        <ShellProvider>
          <LiveProvider>
            <Shell />
          </LiveProvider>
        </ShellProvider>
      </ToastProvider>
    </WorldProvider>
  );
}
