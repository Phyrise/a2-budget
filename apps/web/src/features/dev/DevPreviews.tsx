/**
 * Mode développeur — les aperçus : surcharges NON PERSISTANTES de ce que
 * montre la forêt (WorldContext.setPreview, jamais écrites dans les
 * données), gardien, lanterne, et chaque petit son à écouter.
 */
import type { ReactNode } from 'react';
import { soundEngine, type SoundCue } from '../../app/sound';
import { Button, cx } from '../../ui';
import type { Mood, Season } from '../../world/types';
import { useWorld } from '../../world/WorldContext';
import type { WorldPreview } from '../../world/worldState';

interface Choice<T> {
  value: T | undefined;
  label: string;
}

const STAGES: Choice<number>[] = [{ value: undefined, label: 'Réel' }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))];
const MOODS: Choice<Mood>[] = [
  { value: undefined, label: 'Réelle' },
  { value: 'quiet', label: 'Calme' },
  { value: 'peaceful', label: 'Paisible' },
  { value: 'lively', label: 'Vivante' },
  { value: 'flourishing', label: 'Florissante' },
];
const SEASONS: Choice<Season>[] = [
  { value: undefined, label: 'Réelle' },
  { value: 'spring', label: 'Printemps' },
  { value: 'summer', label: 'Été' },
  { value: 'autumn', label: 'Automne' },
  { value: 'winter', label: 'Hiver' },
];
const PAUSES: Choice<boolean>[] = [
  { value: undefined, label: 'Réelle' },
  { value: false, label: 'Éveillée' },
  { value: true, label: 'Endormie' },
];
const LANTERNS: Choice<number>[] = [
  { value: undefined, label: 'Éteinte' },
  { value: 0.25, label: '25 %' },
  { value: 0.6, label: '60 %' },
  { value: 1, label: 'Pleine' },
];

export const SOUND_LABELS: Record<SoundCue, string> = {
  done: 'Tâche faite',
  chore: 'Corvée',
  undo: 'Annuler',
  skip: 'Pas aujourd’hui',
  creature: 'Créature',
  growth: 'La forêt grandit',
  guardian: 'Gardien',
  circle: 'Cercle',
  lantern: 'Lanterne',
  coins: 'Pièces d’or',
  konpeito: 'Kompeitō',
  broom: 'Coup de balai',
  shopBell: 'Clochette',
  woodNote: 'Note de bois',
  nom: 'Paiement mangé',
  spend: 'Pièces qui partent',
  ah: 'Sans-Visage touché',
  balanceBell: 'Solde recalé',
  lanternLit: 'Lanterne allumée',
  lanternNew: 'Nouvelle lanterne',
};

function ChoiceRow<T>({
  legend,
  choices,
  value,
  onChange,
}: {
  legend: string;
  choices: Choice<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <fieldset className="dev-choices">
      <legend className="dev-choices__legend">{legend}</legend>
      <div className="dev-choices__list">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            className={cx('dev-choice', c.value === value && 'is-on')}
            aria-pressed={c.value === value}
            onClick={() => onChange(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="dev-section" aria-labelledby={id}>
      <h3 id={id} className="dev-section__title">
        {title}
      </h3>
      {lead && <p className="dev-section__lead">{lead}</p>}
      {children}
    </section>
  );
}

export function DevPreviews({ onShowForest, onGuardian }: { onShowForest: () => void; onGuardian: () => void }) {
  const { preview, setPreview, previewActive } = useWorld();
  const set = <K extends keyof WorldPreview>(key: K, value: WorldPreview[K] | undefined) =>
    setPreview((prev) => {
      const next: WorldPreview = { ...(prev ?? {}) };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return Object.keys(next).length === 0 ? null : next;
    });

  return (
    <>
      <Section
        id="dev-previews"
        title="Aperçus de la forêt"
        lead="Pour voir chaque état sans attendre : rien n’est écrit dans vos données, tout s’efface en quittant le mode."
      >
        <ChoiceRow legend="Stade" choices={STAGES} value={preview?.stage} onChange={(v) => set('stage', v)} />
        <ChoiceRow legend="Humeur" choices={MOODS} value={preview?.mood} onChange={(v) => set('mood', v)} />
        <ChoiceRow legend="Saison" choices={SEASONS} value={preview?.season} onChange={(v) => set('season', v)} />
        <ChoiceRow legend="Pause" choices={PAUSES} value={preview?.paused} onChange={(v) => set('paused', v)} />
        <ChoiceRow legend="Lanterne" choices={LANTERNS} value={preview?.lantern} onChange={(v) => set('lantern', v)} />
        <div className="dev-actions">
          <Button size="sm" variant="primary" icon="leaf" onClick={onShowForest}>
            Voir la forêt
          </Button>
          <Button size="sm" variant="quiet" icon="sparkle" onClick={onGuardian}>
            Jouer le gardien
          </Button>
          <Button size="sm" variant="ghost" icon="undo" onClick={() => setPreview(null)} disabled={!previewActive}>
            Revenir au réel
          </Button>
        </div>
      </Section>

      <Section id="dev-sounds" title="Petits sons" lead="Chaque son, même si les petits sons sont coupés dans les préférences.">
        <div className="dev-sounds">
          {(Object.keys(SOUND_LABELS) as SoundCue[]).map((cue) => (
            <button
              key={cue}
              type="button"
              className="dev-choice dev-sound"
              onClick={() => {
                soundEngine.unlock(true);
                soundEngine.play(cue, { who: 'both', force: true, maxWakeLagMs: 800 });
              }}
            >
              {SOUND_LABELS[cue]}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}
