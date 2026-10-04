/**
 * Ligne de réglage « Petits sons » : interrupteur + bouton « Écouter », qui
 * fait entendre, à chaque appui, un exemple différent (tâche d'AL, d'AC,
 * corvée à deux, créature, forêt qui grandit…). Le gardien garde son secret.
 */
import { useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { Button } from '../../ui';
import { Switch } from '../../ui/Switch';
import type { SoundCue, SoundVoice } from './cues';
import { soundEngine } from './engine';
import { setSoundEnabled, useSoundPrefs } from './prefs';
import './sound.css';

interface Sample {
  cue: SoundCue;
  who?: SoundVoice;
  label: (a: string, b: string) => string;
}

const SAMPLES: readonly Sample[] = [
  { cue: 'done', who: 'a', label: (a) => `Une tâche faite par ${a}` },
  { cue: 'done', who: 'b', label: (_, b) => `Une tâche faite par ${b}` },
  { cue: 'chore', who: 'both', label: () => 'Une corvée, faite ensemble' },
  { cue: 'creature', label: () => 'Une créature rencontrée' },
  { cue: 'growth', label: () => 'La forêt grandit' },
  { cue: 'skip', label: () => '« Pas aujourd’hui »' },
  { cue: 'circle', label: () => 'Le cercle de la semaine' },
  { cue: 'lantern', label: () => 'Une lanterne terminée' },
];

function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 17.5V6.2l10-2.2v11.3" />
      <circle cx="6.8" cy="17.6" r="2.3" />
      <circle cx="16.8" cy="15.4" r="2.3" />
    </svg>
  );
}

export function SoundSetting() {
  const { enabled } = useSoundPrefs();
  const { appState } = useApp();
  const supported = soundEngine.supported();
  const next = useRef(0);
  const [heard, setHeard] = useState<string | null>(null);

  const people = appState?.household.people ?? [];
  const nameA = people.find((p) => p.id === 'a')?.name ?? 'AL';
  const nameB = people.find((p) => p.id === 'b')?.name ?? 'AC';

  const toggle = (on: boolean) => {
    setSoundEnabled(on);
    if (on) {
      // Le geste débloque le son ; une note douce confirme.
      soundEngine.unlock(true);
      soundEngine.play('done', { who: 'none', force: true });
    }
  };

  const listen = () => {
    const sample = SAMPLES[next.current % SAMPLES.length]!;
    next.current += 1;
    soundEngine.unlock(true);
    soundEngine.play(sample.cue, { who: sample.who ?? 'none', force: true });
    setHeard(sample.label(nameA, nameB));
  };

  return (
    <div className="sound-setting">
      <Switch
        checked={supported && enabled}
        disabled={!supported}
        onChange={toggle}
        icon={<NoteIcon />}
        label="Petits sons"
        description={
          supported
            ? 'Une note légère quand une tâche est faite, qu’une créature apparaît ou que la forêt grandit.'
            : 'Les sons ne sont pas disponibles sur ce navigateur.'
        }
      />
      {supported && (
        <div className="sound-setting__try">
          <Button variant="ghost" size="sm" icon="sparkle" onClick={listen}>
            Écouter
          </Button>
          <span className="sound-setting__sample" aria-live="polite">
            {heard ?? 'Un exemple à chaque appui, tout en douceur.'}
          </span>
        </div>
      )}
    </div>
  );
}
