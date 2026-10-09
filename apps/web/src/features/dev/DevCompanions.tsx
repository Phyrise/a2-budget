/**
 * Mode développeur — les compagnons (V4.3) : chaque réaction « inutile » à
 * voir sans attendre, sur place (Jiji, Calcifer, Teto, Hin, Totoro endormi,
 * Jiji des Courses) ou dans la forêt (karakara des kodama). Aperçus non
 * persistants : rien n'est écrit dans les données.
 * V5.6 : les quatre compagnons au choix, leurs cinq poses et leurs réactions.
 */
import { useRef } from 'react';
import { coursesTheme } from '../../themes/manifest';
import { Companion } from '../../ui';
import { previewPoke, type PokeKind } from '../../ui/companionPoke';
import { COMPANION_IDS, companionProfile, type CompanionId } from '../../ui/companions';
import type { CompanionMood } from '../../world/types';
import { previewYawn, SleepingTotoro } from '../calendar/SleepingTotoro';
import { jijiPaw } from '../courses/jijiPaw';

const POSES: readonly CompanionMood[] = ['idle', 'happy', 'proud', 'sleepy', 'curious'];
const POSE_LABEL: Record<CompanionMood, string> = { idle: 'calme', happy: 'joie', proud: 'fierté', sleepy: 'sommeil', curious: 'curiosité' };

/** Rôle d'affichage (couleur de personne) : celui dont c'est le compagnon par défaut. */
const ROLE: Record<CompanionId, 'a' | 'b'> = { jiji: 'a', calcifer: 'b', teto: 'a', hin: 'b' };

const POKE_LABEL: Record<CompanionId, Record<PokeKind, string>> = {
  jiji: { poke: 'Jiji penche la tête', upset: 'Jiji boude' },
  calcifer: { poke: 'Calcifer crépite', upset: 'Calcifer s’énerve' },
  teto: { poke: 'Teto : toucher', upset: 'Teto se renfrogne' },
  hin: { poke: 'Hin : toucher', upset: 'Hin s’effondre' },
};

export function DevCompanions({ onKodama }: { onKodama: () => void }) {
  const pawRef = useRef<HTMLImageElement>(null);
  return (
    <section className="dev-section" aria-labelledby="dev-companions">
      <h3 id="dev-companions" className="dev-section__title">
        Compagnons
      </h3>
      <div className="dev-companions__set">
        {COMPANION_IDS.map((id) => (
          <div key={id} className="dev-companions__row" data-companion={id}>
            <Companion who={ROLE[id]} companion={id} size={52} touchable />
            <span className="dev-companions__poses">
              {POSES.map((mood) => (
                <Companion key={mood} who={ROLE[id]} companion={id} mood={mood} size={34} label={`${companionProfile(id).name} : ${POSE_LABEL[mood]}`} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="dev-companions">
        <SleepingTotoro />
        <span className="dev-companions__basket" aria-hidden="true">
          <img src={coursesTheme.basket.half} alt="" draggable={false} />
          <img ref={pawRef} src={coursesTheme.jiji.teacup} alt="" draggable={false} />
        </span>
      </div>
      <div className="dev-actions">
        {COMPANION_IDS.flatMap((id) =>
          (['poke', 'upset'] as const).map((kind) => (
            <button key={`${id}-${kind}`} type="button" className="dev-choice" onClick={() => previewPoke(id, kind)}>
              {POKE_LABEL[id][kind]}
            </button>
          )),
        )}
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
