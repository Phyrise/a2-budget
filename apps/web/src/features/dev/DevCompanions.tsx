/**
 * Mode développeur — les compagnons (V4.3) : chaque réaction « inutile » à
 * voir sans attendre, sur place (Jiji, Calcifer, Totoro endormi, Jiji des
 * Courses) ou dans la forêt (karakara des kodama). Aperçus non persistants :
 * rien n'est écrit dans les données.
 */
import { useRef } from 'react';
import { coursesTheme } from '../../themes/manifest';
import { Companion } from '../../ui';
import { previewPoke, type PokeKind, type PokeWho } from '../../ui/companionPoke';
import { previewYawn, SleepingTotoro } from '../calendar/SleepingTotoro';
import { jijiPaw } from '../courses/jijiPaw';

const POKES: { who: PokeWho; kind: PokeKind; label: string }[] = [
  { who: 'b', kind: 'poke', label: 'Calcifer crépite' },
  { who: 'b', kind: 'upset', label: 'Calcifer s’énerve' },
  { who: 'a', kind: 'poke', label: 'Jiji penche la tête' },
  { who: 'a', kind: 'upset', label: 'Jiji boude' },
];

export function DevCompanions({ onKodama }: { onKodama: () => void }) {
  const pawRef = useRef<HTMLImageElement>(null);
  return (
    <section className="dev-section" aria-labelledby="dev-companions">
      <h3 id="dev-companions" className="dev-section__title">
        Compagnons
      </h3>
      <div className="dev-companions">
        <Companion who="a" size={56} touchable />
        <Companion who="b" size={54} touchable />
        <SleepingTotoro />
        <span className="dev-companions__basket" aria-hidden="true">
          <img src={coursesTheme.basket.half} alt="" draggable={false} />
          <img ref={pawRef} src={coursesTheme.jiji.teacup} alt="" draggable={false} />
        </span>
      </div>
      <div className="dev-actions">
        {POKES.map((p) => (
          <button key={p.label} type="button" className="dev-choice" onClick={() => previewPoke(p.who, p.kind)}>
            {p.label}
          </button>
        ))}
        <button type="button" className="dev-choice" onClick={previewYawn}>
          Totoro bâille
        </button>
        <button type="button" className="dev-choice" onClick={() => jijiPaw(pawRef.current, 0)}>
          Jiji : coup de patte
        </button>
        <button type="button" className="dev-choice" onClick={onKodama}>
          Kodama : karakara
        </button>
      </div>
    </section>
  );
}
