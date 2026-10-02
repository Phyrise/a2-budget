import { useApp } from '../state/store';
import { LoadNotice } from '../components/LoadNotice';
import { MaisonModule } from '../modules/chores/MaisonModule';
import { MaisonActions } from '../modules/chores/MaisonActions';

export function MaisonView() {
  const { appState, today, createHomeTask, toggleHomeTask, toggleHomePause } = useApp();
  if (!appState) return <section className="view"><h1 tabIndex={-1}>Notre maison</h1><p>Chargement…</p></section>;
  return <section className="view maison-view">
    <LoadNotice />
    <header className="maison-heading"><h1 tabIndex={-1}>Notre maison</h1><p>Les petits gestes qui font du bien.</p></header>
    <MaisonModule tasks={appState.chores.tasks} completions={appState.chores.completions} forest={appState.forest} people={appState.household.people} today={today} onToggle={toggleHomeTask} actions={<MaisonActions people={appState.household.people} paused={appState.forest.paused} onCreate={createHomeTask} onPauseToggle={toggleHomePause} />} />
  </section>;
}

export function MaisonHistory() {
  const { appState } = useApp();
  const completions = appState ? [...appState.chores.completions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)) : [];
  const names = appState?.household.people ?? [];
  const who = (assignee: string) => assignee === 'a' ? names[0]?.name ?? 'AL' : assignee === 'b' ? names[1]?.name ?? 'AC' : assignee === 'both' ? 'Ensemble' : 'À répartir';
  if (!completions.length) return <div className="empty-state"><p className="empty-state__title">Les petits gestes apparaîtront ici</p><p className="empty-state__hint">Chaque tâche terminée garde une trace, simplement.</p></div>;
  return <ul className="maison-history">{completions.map(completion => <li key={completion.id}><strong>{completion.taskTitle}</strong><span>{who(completion.assignee)} · <time dateTime={completion.completedAt}>{new Date(completion.completedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</time></span></li>)}</ul>;
}
