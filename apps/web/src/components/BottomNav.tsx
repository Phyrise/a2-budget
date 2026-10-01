import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { NAVIGATE_EVENT } from './navigation';
import '../styles/bottom-nav.css';

/**
 * Navigation inférieure fixe (trois destinations).
 *
 * - `aria-current="page"` sur la destination active.
 * - `padding-bottom: env(safe-area-inset-bottom)` (voir bottom-nav.css).
 * - S'abonne à NAVIGATE_EVENT : une vue (ex. Historique) peut demander
 *   l'ouverture d'une autre vue sans props (voir navigation.ts).
 */
export type ViewId = 'month' | 'history' | 'settings';

interface NavItem {
  id: ViewId;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'month',
    label: 'Ce mois',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'Historique',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 1.8" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Réglages',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        <circle cx="15" cy="6.5" r="2.2" fill="var(--surface)" />
        <circle cx="8.5" cy="12" r="2.2" fill="var(--surface)" />
        <circle cx="16.5" cy="17.5" r="2.2" fill="var(--surface)" />
      </svg>
    ),
  },
];

export function BottomNav({
  current,
  onChange,
}: {
  current: ViewId;
  onChange: (view: ViewId) => void;
}) {
  const previousViewRef = useRef(current);
  const focusFrameRef = useRef<number | null>(null);

  const focusViewHeading = useCallback(() => {
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    // Attendre le rendu de la nouvelle vue, y compris après un événement
    // de navigation émis par l'historique pendant un clic React.
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.querySelector<HTMLHeadingElement>('#contenu-principal h1')?.focus({
          preventScroll: true,
        });
      });
    });
  }, []);

  useEffect(() => {
    if (previousViewRef.current !== current) {
      previousViewRef.current = current;
      focusViewHeading();
    }
  }, [current, focusViewHeading]);

  useEffect(
    () => () => {
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ViewId>).detail;
      if (detail === 'month' || detail === 'history' || detail === 'settings') {
        onChange(detail);
        // Réouvrir un mois doit aussi replacer le contexte si la vue est
        // déjà active ; un simple clic sur l'onglet actif ne le fait pas.
        focusViewHeading();
      }
    };
    window.addEventListener(NAVIGATE_EVENT, handler);
    return () => window.removeEventListener(NAVIGATE_EVENT, handler);
  }, [onChange, focusViewHeading]);

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={
            item.id === current ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'
          }
          aria-current={item.id === current ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
