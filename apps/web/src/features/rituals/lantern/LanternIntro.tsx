/**
 * Première ouverture de la lanterne : ce que c'est, en trois gestes
 * illustrés (choisir une durée → la lanterne s'allume dans la forêt → à la
 * fin, cocher la tâche). Montrée tant qu'aucune lanterne n'a été allumée
 * (focus.sessions vide) et pas encore lue (préférence d'interface) ; « Comment ça
 * marche ? » la rouvre depuis la préparation.
 */
import { Button } from '../../../ui';
import { NB } from '../ritualText';
import './lantern-intro.css';

/** À montrer tant qu'elle n'a pas été lue (préférence `lanternIntroSeen`) et qu'aucune lanterne n'a été allumée. */
export function lanternIntroDue(seen: boolean, sessionsCount: number): boolean {
  return !seen && sessionsCount === 0;
}

function StepArt({ step }: { step: 1 | 2 | 3 }) {
  return (
    <svg
      className="lantern-intro__art"
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {step === 1 && (
        <>
          {/* Un cadran doux : la durée choisie. */}
          <circle cx="28" cy="30" r="15" opacity="0.5" />
          <path d="M28 15a15 15 0 0 1 13 22.5" className="lantern-intro__warm" />
          <path d="M28 30v-8M28 30l5 3" />
          <path d="M24 10h8" />
        </>
      )}
      {step === 2 && (
        <>
          {/* La lanterne entre deux troncs, sa lumière autour. */}
          <circle cx="28" cy="31" r="13" className="lantern-intro__glow" stroke="none" />
          <path d="M9 50V8M47 50V8" opacity="0.45" />
          <path d="M28 12v5M25 17h6M25.6 41h4.8" />
          <path d="M28 17c5 0 7 3.5 7 8.5S33 34 28 34s-7-3.5-7-8.5 2-8.5 7-8.5Z" className="lantern-intro__warm" />
          <path d="M28 34v7" />
          <path d="M14 46c4-1.6 8-1.6 12 0M30 46c4-1.6 8-1.6 12 0" opacity="0.45" />
        </>
      )}
      {step === 3 && (
        <>
          {/* La lanterne a fleuri : la case se coche. */}
          <path d="M28 8c2.6 3 2.6 6 0 9-2.6-3-2.6-6 0-9Z" className="lantern-intro__warm" />
          <path d="M19.5 12.5c3.9.6 5.8 2.9 5.6 6.8-3.9-.6-5.8-2.9-5.6-6.8ZM36.5 12.5c-3.9.6-5.8 2.9-5.6 6.8 3.9-.6 5.8-2.9 5.6-6.8Z" opacity="0.7" />
          <rect x="16" y="25" width="24" height="24" rx="8" />
          <path d="m22 37 4.5 4.5L34 32" className="lantern-intro__warm" />
        </>
      )}
    </svg>
  );
}

const STEPS: ReadonlyArray<{ step: 1 | 2 | 3; title: string; body: string }> = [
  { step: 1, title: 'Choisissez une durée', body: `5, 10, 15 ou 25${NB}minutes, pour une seule chose (ranger le bureau, trier le courrier…).` },
  {
    step: 2,
    title: 'La lanterne s’allume dans la forêt',
    body: 'Une lanterne de pierre s’allume au pied du cèdre. Un petit bandeau garde le temps, au-dessus de la navigation.',
  },
  { step: 3, title: 'À la fin, elle fleurit', body: 'Si elle était liée à une tâche du jour, il ne reste qu’à la cocher. Au fil des lanternes, d’autres modèles se dévoilent dans le carnet. Arrêter plus tôt ne compte jamais contre vous.' },
];

export function LanternIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="lantern-card lantern-intro">
      <p className="lantern-intro__lead">Un minuteur doux pour s’y mettre — la forêt s’illumine pendant que vous rangez.</p>
      <ol className="lantern-intro__steps">
        {STEPS.map((s) => (
          <li key={s.step} className="lantern-intro__step">
            <span className="lantern-intro__figure">
              <StepArt step={s.step} />
              <span className="lantern-intro__num" aria-hidden="true">
                {s.step}
              </span>
            </span>
            <span className="lantern-intro__text">
              <span className="lantern-intro__title">{s.title}</span>
              <span className="lantern-intro__body">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" block icon="sparkle" onClick={onContinue}>
        Choisir une durée
      </Button>
    </div>
  );
}
