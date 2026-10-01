/**
 * PLACEHOLDER — propriété de l'agent UI (docs/agents/UI.md, docs/DESIGN.md).
 * Conserver l'export, le type ViewId et la signature des props (câblés par le
 * lead dans App.tsx).
 */
export type ViewId = 'month' | 'history' | 'settings';

export function BottomNav({
  current,
  onChange,
}: {
  current: ViewId;
  onChange: (view: ViewId) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <button
        type="button"
        aria-current={current === 'month' ? 'page' : undefined}
        onClick={() => onChange('month')}
      >
        Ce mois
      </button>
      <button
        type="button"
        aria-current={current === 'history' ? 'page' : undefined}
        onClick={() => onChange('history')}
      >
        Historique
      </button>
      <button
        type="button"
        aria-current={current === 'settings' ? 'page' : undefined}
        onClick={() => onChange('settings')}
      >
        Réglages
      </button>
    </nav>
  );
}
