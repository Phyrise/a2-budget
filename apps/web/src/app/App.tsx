/**
 * Coquille A² Home.
 *
 * - Un seul monde (WorldStage) fixe en fond, plein bord ; sa présentation
 *   suit le module et la largeur : Maison mobile = hero vivant (54svh),
 *   Budget / Courses = bandeau peint fixe (24svh), ≥ 1024 px = forêt en fond
 *   et carnet de 480 px à droite.
 * - Le contenu défile par-dessus : fenêtre sur la forêt (--world-h) puis la
 *   feuille encre. La scène se fige quand elle est recouverte ou masquée.
 * - En-tête (marque + Historique / Réglages), pilule de navigation, feuilles
 *   globales, indicateur d'enregistrement, mise à jour PWA.
 */
import '../styles/base.css';
import '../styles/ui.css';
import '../styles/shell.css';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BudgetScreen } from '../features/budget/BudgetScreen';
import { CoursesScreen } from '../features/courses/CoursesScreen';
import { HistorySheetContent } from '../features/history/HistorySheetContent';
import { MaisonScreen } from '../features/maison/MaisonScreen';
import { SettingsSheetContent } from '../features/settings/SettingsSheetContent';
import { Icon, IconButton, Sheet, ToastProvider, cx, type IconName } from '../ui';
import { manifest } from '../world/manifest';
import { WorldProvider, WorldStage, useWorld } from '../world/WorldContext';
import { MODULES, type ModuleId } from './prefs';
import { SaveIndicator } from './SaveIndicator';
import { ShellProvider, useMediaQuery, useShell } from './ShellContext';
import { UpdatePrompt } from './UpdatePrompt';

const NAV_ICONS: Record<ModuleId, IconName> = { budget: 'budget', maison: 'home', courses: 'basket' };

/** Part de la hauteur d'écran occupée par la fenêtre sur la forêt (mobile). */
const WORLD_RATIO: Record<ModuleId, number> = { maison: 0.54, budget: 0.24, courses: 0.24 };

const HISTORY_TITLES: Record<ModuleId, string> = {
  budget: 'Historique du budget',
  maison: 'Historique de la maison',
  courses: 'Historique des courses',
};

function Screen({ module }: { module: ModuleId }) {
  if (module === 'budget') return <BudgetScreen />;
  if (module === 'courses') return <CoursesScreen />;
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

function Header({ solid }: { solid: boolean }) {
  const { module, openSheet } = useShell();
  return (
    <header className={cx('app-header', solid && 'is-solid')}>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <p className="brand" aria-label="A² Home">
        <span className="brand__a" aria-hidden="true">
          A<span className="brand__sq">2</span>
        </span>
        <span className="brand__home" aria-hidden="true">
          Home
        </span>
      </p>
      <div className="app-header__end">
        <SaveIndicator />
        <IconButton icon="history" label={HISTORY_TITLES[module]} variant="glass" onClick={() => openSheet('history')} />
        <IconButton icon="settings" label="Réglages" variant="glass" onClick={() => openSheet('settings')} />
      </div>
    </header>
  );
}

function ModuleNav() {
  const { module, setModule } = useShell();
  return (
    <nav className="app-nav" aria-label="Modules de la maison">
      {MODULES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={cx('app-nav__item', m.id === module && 'is-active')}
          aria-current={m.id === module ? 'page' : undefined}
          onClick={() => setModule(m.id)}
        >
          <Icon name={NAV_ICONS[m.id]} size={22} />
          <span className="app-nav__label">{m.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Shell() {
  const { module, sheet, closeSheet, prefs, isDesktop, foregroundSheet } = useShell();
  const { setPresentation } = useWorld();
  const { solid, covered } = useScrollState(module, isDesktop);
  const visible = usePageVisible();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shownModule = useRef(module);

  // Présentation du monde selon module, largeur, recouvrement et préférence.
  const variant = isDesktop ? 'backdrop' : module === 'maison' ? 'hero' : 'banner';
  const live =
    module === 'maison' && visible && !covered && sheet === null && !(foregroundSheet && !isDesktop);
  const motion = reducedMotion ? 'still' : prefs.forestMotion;
  useEffect(() => {
    setPresentation({ variant, live, motion });
  }, [setPresentation, variant, live, motion]);

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
      className={cx('app', `app--${module}`, isDesktop && 'app--desktop')}
      style={{ '--world-ratio': WORLD_RATIO[module] } as CSSProperties}
    >
      <div className="app-world" aria-hidden="true">
        {manifest.placeholder && <img className="app-world__placeholder" src={manifest.placeholder} alt="" />}
        <WorldStage className="app-world__stage" />
        {(['budget', 'courses'] as const).map((key) =>
          manifest.banners[key] ? (
            <img
              key={key}
              className={cx('app-world__banner', !isDesktop && module === key && 'is-shown')}
              src={manifest.banners[key]}
              alt=""
              decoding="async"
            />
          ) : null,
        )}
        <div className="app-world__shade" />
      </div>

      <Header solid={solid} />

      <main id="contenu" className="app-main" tabIndex={-1}>
        <div key={module} className="module-view">
          <Screen module={module} />
        </div>
      </main>

      <div className="app-dock">
        <ModuleNav />
      </div>
      <UpdatePrompt />

      <Sheet open={sheet === 'history'} onClose={closeSheet} title={HISTORY_TITLES[module]} size="full">
        <HistorySheetContent />
      </Sheet>
      <Sheet open={sheet === 'settings'} onClose={closeSheet} title="Réglages" size="full">
        <SettingsSheetContent />
      </Sheet>
    </div>
  );
}

export function App() {
  return (
    <WorldProvider>
      <ToastProvider>
        <ShellProvider>
          <Shell />
        </ShellProvider>
      </ToastProvider>
    </WorldProvider>
  );
}
