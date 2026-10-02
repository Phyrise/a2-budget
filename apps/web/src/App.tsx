import { useEffect, useState } from 'react';
import type { ViewId } from './components/BottomNav';
import { NAVIGATE_EVENT } from './components/navigation';
import { SaveIndicator } from './components/SaveIndicator';
import { UpdatePrompt } from './components/UpdatePrompt';
import { OverlaySheet } from './components/OverlaySheet';
import { MaisonView, MaisonHistory } from './views/MaisonView';
import { CurrentMonthView } from './views/CurrentMonthView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import './styles/home.css';

type ModuleId = 'budget' | 'maison' | 'courses';
const modules: { id: ModuleId; label: string; icon: string }[] = [
  { id: 'budget', label: 'Budget', icon: '◈' },
  { id: 'maison', label: 'Maison', icon: '⌂' },
  { id: 'courses', label: 'Courses', icon: '♧' },
];

export function App() {
  const [module, setModule] = useState<ModuleId>(() => { const selected = new URLSearchParams(location.search).get('module'); return selected === 'maison' || selected === 'courses' ? selected : 'budget'; });
  const [overlay, setOverlay] = useState<'history' | 'settings' | null>(null);
  useEffect(() => { const url = new URL(location.href); url.searchParams.set('module', module); history.replaceState(null, '', url); }, [module]);
  const focusHeading = () => requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('.app-main h1')?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  useEffect(() => {
    const navigate = (event: Event) => {
      const view = (event as CustomEvent<ViewId>).detail;
      if (view === 'month') { setModule('budget'); setOverlay(null); focusHeading(); }
      else if (view === 'history' || view === 'settings') setOverlay(view);
    };
    window.addEventListener(NAVIGATE_EVENT, navigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, navigate);
  }, []);
  const changeModule = (next: ModuleId) => { setModule(next); focusHeading(); };

  return (
    <div className="app-shell home-shell">
      {import.meta.env.DEV && <p className="preview-note">Preview locale · version en cours de vérification</p>}
      <header className="home-header">
        <a className="home-brand" href="#contenu-principal" aria-label="A carré Home, aller au contenu"><span>A²</span> Home</a>
        <div className="home-tools">
          <button type="button" className="icon-btn" aria-label={module === 'budget' ? 'Historique du budget' : module === 'maison' ? 'Historique de la maison' : 'Historique des courses'} onClick={() => setOverlay('history')}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8.2"/><path d="M12 7v5l3 2"/></svg></button>
          <button type="button" className="icon-btn" aria-label="Réglages" onClick={() => setOverlay('settings')}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </header>
      <nav className="home-modules" aria-label="Modules de la maison">{modules.map(item => <button type="button" key={item.id} aria-current={module === item.id ? 'page' : undefined} onClick={() => changeModule(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      <main className="app-main" id="contenu-principal">
        {module === 'budget' && <CurrentMonthView />}
        {module === 'maison' && <MaisonView />}
        {module === 'courses' && <section className="module-awaiting"><span className="module-awaiting__leaf" aria-hidden="true">♧</span><p className="module-awaiting__eyebrow">Le prochain petit rituel</p><h1 tabIndex={-1}>Nos courses</h1><p>La liste commune arrive bientôt.</p><p className="card-hint">Pour garder les idées et les essentiels du quotidien au même endroit.</p></section>}
      </main>
      <OverlaySheet open={overlay === 'history'} onClose={() => setOverlay(null)} title={module === 'budget' ? 'Historique du budget' : module === 'maison' ? 'Historique de la maison' : 'Historique des courses'}>{overlay === 'history' && (module === 'budget' ? <HistoryView /> : module === 'maison' ? <MaisonHistory /> : <div className="empty-state"><p className="empty-state__title">L’histoire commence bientôt</p><p className="empty-state__hint">Les actions de ce module apparaîtront ici.</p></div>)}</OverlaySheet>
      <OverlaySheet open={overlay === 'settings'} onClose={() => setOverlay(null)} title="Réglages">{overlay === 'settings' && <SettingsView />}</OverlaySheet>
      <SaveIndicator /><UpdatePrompt />
    </div>
  );
}
