/**
 * Pastille discrète sur l'onglet qui porte le cercle (Maison) tant qu'une
 * lettre de l'autre attend d'être lue. Décorative (le bouton de la barre
 * garde son nom) ; rien en invité.
 */
import type { ModuleId } from '../../../app/prefs';
import { useLetters } from './letterStore';

export function NavLetterDot({ tab }: { tab: ModuleId }) {
  const { unread } = useLetters();
  if (tab !== 'maison' || unread === null) return null;
  return <span className="nav-letter-dot" data-testid="nav-letter-dot" aria-hidden="true" />;
}
