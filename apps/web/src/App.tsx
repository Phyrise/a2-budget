import { useState } from 'react';
import { BottomNav, type ViewId } from './components/BottomNav';
import { SaveIndicator } from './components/SaveIndicator';
import { UpdatePrompt } from './components/UpdatePrompt';
import { CurrentMonthView } from './views/CurrentMonthView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';

/**
 * Coquille de l'application (lead). La navigation est un simple état React,
 * sans routeur. Les vues lisent l'état via useApp() (apps/web/src/state/store.tsx).
 */
export function App() {
  const [view, setView] = useState<ViewId>('month');

  return (
    <div className="app-shell">
      <main className="app-main" id="contenu-principal">
        {view === 'month' && <CurrentMonthView />}
        {view === 'history' && <HistoryView />}
        {view === 'settings' && <SettingsView />}
      </main>
      <BottomNav current={view} onChange={setView} />
      <SaveIndicator />
      <UpdatePrompt />
    </div>
  );
}
