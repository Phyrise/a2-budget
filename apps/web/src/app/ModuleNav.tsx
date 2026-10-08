/**
 * Pilule de navigation à quatre entrées (icône au-dessus du libellé),
 * lisible de 320 à 430 px ; l'entrée active prend l'accent de l'univers du
 * module (variable --module-accent posée sur .app--<module>).
 */
import { Icon, cx } from '../ui';
import { NavLetterDot } from '../features/rituals/letters/NavLetterDot';
import { NAV_ICONS } from './modules';
import { MODULES } from './prefs';
import { useShell } from './ShellContext';

export function ModuleNav() {
  const { module, setModule } = useShell();
  return (
    <nav className="app-nav" aria-label="Modules de la maison">
      {MODULES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={cx('app-nav__item', `app-nav__item--${m.id}`, m.id === module && 'is-active')}
          aria-current={m.id === module ? 'page' : undefined}
          onClick={() => {
            if (m.id !== module) {
              setModule(m.id);
              return;
            }
            // Module déjà affiché : retour en douceur vers le haut.
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
          }}
        >
          <Icon name={NAV_ICONS[m.id]} size={22} />
          <NavLetterDot tab={m.id} />
          <span className="app-nav__label">{m.label}</span>
        </button>
      ))}
    </nav>
  );
}
