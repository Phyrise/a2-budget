/**
 * Mode développeur — les Noiraudes vivantes : les faire venir sans attendre
 * (une vagabonde, la dorée, la procession, des porteuses, une égarée dans
 * Courses ou Calendrier) et remplir le bocal. Le panneau se ferme, l'onglet change,
 * puis la scène de l'écran reçoit l'appel (creatures/soot).
 */
import { playGive } from '../../creatures/play';
import { summonNoiraudes, type SootSummon } from '../../creatures/soot';
import { useShell } from '../../app/ShellContext';
import type { ModuleId } from '../../app/prefs';
import { Button } from '../../ui';

/** Fermeture de la feuille et montage de l'écran avant l'appel. */
const SETTLE_MS = 700;

const CALLS: ReadonlyArray<{ label: string; kind: SootSummon; module: ModuleId }> = [
  { label: 'Une Noiraude', kind: 'stray', module: 'budget' },
  { label: 'La dorée', kind: 'golden', module: 'budget' },
  { label: 'La procession', kind: 'procession', module: 'budget' },
  { label: 'Des porteuses', kind: 'porters', module: 'budget' },
  { label: 'Égarée dans Courses', kind: 'lost', module: 'courses' },
  { label: 'Égarée dans Calendrier', kind: 'lost', module: 'calendar' },
];

export function DevNoiraudes({ onClose }: { onClose: () => void }) {
  const { setModule } = useShell();
  const call = (kind: SootSummon, module: ModuleId) => {
    onClose();
    setModule(module);
    window.setTimeout(() => summonNoiraudes(kind, module === 'maison' ? undefined : module), SETTLE_MS);
  };
  return (
    <section className="dev-section" aria-labelledby="dev-noiraudes">
      <h3 id="dev-noiraudes" className="dev-section__title">
        Noiraudes
      </h3>
      <p className="dev-section__lead">Les faire venir sans attendre (raretés comprises). Le bocal ne sert qu’à jouer.</p>
      <p className="dev-section__lead">
        Au doigt, sur n’importe quelle Noiraude : toucher = l’attraper ; appui long = elle s’enfuit ; glisser en partant d’elle = la
        pousser. Doigt immobile sur le fond près d’une vagabonde : elle grimpe dessus. Bocal : glisser un kompeitō, le lâcher.
      </p>
      <div className="dev-actions">
        {CALLS.map((c) => (
          <Button key={c.label} size="sm" variant="quiet" icon="sparkle" onClick={() => call(c.kind, c.module)}>
            {c.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" icon="plus" onClick={() => playGive(10, 'dev')}>
          +10 kompeitō
        </Button>
      </div>
    </section>
  );
}
