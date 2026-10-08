/**
 * V5.2 — lien Courses ↔ Maison, côté Maison :
 * - `GroceryBadge` : sur la ligne de la tâche courses, le petit balai de
 *   Kiki et le nombre d'articles restants ; ouvre l'onglet Courses ;
 * - `GroceryChip` : dans la feuille de tâche, la suggestion « Courses » qui
 *   lie la tâche à la liste (pressée = liée).
 */
import { groceriesLeft } from '@a2/core';
import { useShell } from '../../app/ShellContext';
import { useApp } from '../../state/store';
import { coursesTheme } from '../../themes/manifest';
import { cx, plural } from '../../ui';
import './grocery-link.css';

function Broom({ size }: { size: number }) {
  return <img className="grocery-broom" src={coursesTheme.broom} alt="" aria-hidden="true" draggable={false} style={{ width: size }} />;
}

export function GroceryBadge() {
  const { appState } = useApp();
  const { setModule } = useShell();
  const left = groceriesLeft(appState?.groceries.items ?? []);
  return (
    <button
      type="button"
      className="grocery-badge"
      onClick={() => setModule('courses')}
      aria-label={`Liste de courses : ${left === 0 ? 'vide' : plural(left, 'article')}`}
    >
      <Broom size={26} />
      <span className="grocery-badge__count" aria-hidden="true">
        {left}
      </span>
    </button>
  );
}

export function GroceryChip({ linked, onToggle }: { linked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cx('chip', 'grocery-chip', linked && 'is-selected')}
      aria-pressed={linked}
      aria-label="Liée à la liste de courses"
      onClick={onToggle}
    >
      <Broom size={22} />
      Courses
    </button>
  );
}
