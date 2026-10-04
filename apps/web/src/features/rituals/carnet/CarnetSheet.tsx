/**
 * Carnet de la forêt : créatures rencontrées, stades du cèdre, souvenirs.
 * Une mémoire de ce qui a été vécu — jamais un score : pas de pourcentage,
 * pas de « 3/7 », des phrases.
 */
import { CREATURES, type AppState } from '@a2/core';
import { useShell } from '../../../app/ShellContext';
import { useApp } from '../../../state/store';
import { Icon, Sheet, cx, type IconName } from '../../../ui';
import { manifest } from '../../../world/manifest';
import type { GrowthStage } from '../../../world/types';
import { ofName } from '../../maison/taskText';
import { NB, capitalizeFirst, countWords, durationWords, numberWords, typo } from '../ritualText';
import { CREATURE_ENTRIES, KODAMA, STAGE_NAMES } from './carnetData';

function CreatureCard({ name, legend, sprite, met }: { name: string; legend: string; sprite: string | undefined; met: boolean }) {
  return (
    <li className={cx('carnet-creature', !met && 'is-unmet')}>
      <span className="carnet-creature__art" aria-hidden="true">
        {sprite ? <img src={sprite} alt="" loading="lazy" decoding="async" draggable={false} /> : <Icon name="leaf" size={28} />}
      </span>
      <span className="carnet-creature__text">
        <span className="carnet-creature__name">{met ? name : 'Une silhouette dans la brume'}</span>
        <span className="carnet-creature__legend">{met ? legend : 'pas encore rencontrée'}</span>
      </span>
    </li>
  );
}

function memories(app: AppState, guardianSeen: boolean): Array<{ icon: IconName; text: string }> {
  const f = app.forest;
  const circles = app.rituals?.circles.length ?? 0;
  const sessions = app.focus?.sessions ?? [];
  const minutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const out: Array<{ icon: IconName; text: string }> = [];

  out.push({
    icon: 'leaf',
    text:
      f.longestStreak >= 2
        ? `${capitalizeFirst(countWords(f.longestStreak, 'jour', 'jours'))} d’affilée à prendre soin de la maison${NB}: votre plus belle série.`
        : f.longestStreak === 1
          ? `Un premier jour de soin, et la forêt s’en souvient.`
          : `La première série commencera au prochain geste.`,
  });
  out.push({
    icon: 'sparkle',
    text:
      guardianSeen || f.lastRareEvent === 'guardian'
        ? `Le gardien de la forêt vous a rendu visite, un soir de brume.`
        : `Le gardien veille, quelque part dans la brume.`,
  });
  out.push({
    icon: 'users',
    text:
      circles > 1
        ? `${capitalizeFirst(countWords(circles, 'cercle tenu', 'cercles tenus'))} ensemble, et autant de mercis échangés.`
        : circles === 1
          ? `Un premier cercle tenu ensemble — le début d’une habitude douce.`
          : `Le premier cercle sera le plus doux.`,
  });
  out.push({
    icon: 'sun',
    text:
      sessions.length > 0
        ? `${capitalizeFirst(countWords(sessions.length, 'lanterne allumée', 'lanternes allumées', true))}${NB}: ${durationWords(minutes)} de calme.`
        : `La première lanterne attend son moment — cinq minutes suffisent.`,
  });
  // Le dernier merci échangé : un mot à relire, pas un chiffre.
  const all = app.rituals?.circles ?? [];
  const lastThanks = [...all].reverse().find((c) => c.gratitude.length > 0)?.gratitude[0];
  if (lastThanks) {
    const names = { a: app.budget.settings.personA.name, b: app.budget.settings.personB.name };
    out.push({
      icon: 'feather',
      text: `Le dernier merci, ${ofName(names[lastThanks.from])} à ${names[lastThanks.to]}${NB}: «${NB}${typo(lastThanks.text)}${NB}»`,
    });
  }
  return out;
}

export function CarnetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appState } = useApp();
  const { prefs } = useShell();
  if (!appState) return null;
  const met = new Set(appState.forest.unlockedCreatureIds);
  const stage = Math.min(7, Math.max(1, appState.forest.growthStage)) as GrowthStage;
  const kodama = manifest.sprites.kodama[0];

  return (
    <Sheet open={open} onClose={onClose} title="Carnet de la forêt" description="Ce que la forêt a vu, et garde en mémoire." size="full" className="carnet-sheet">
      <section className="carnet-section" aria-labelledby="carnet-creatures">
        <h3 id="carnet-creatures" className="carnet-section__title display">
          Créatures
        </h3>
        <ul className="carnet-creatures">
          <CreatureCard name={KODAMA.name} legend={KODAMA.legend} sprite={kodama} met />
          {CREATURES.map((c) => {
            const entry = CREATURE_ENTRIES[c.id];
            return (
              <CreatureCard
                key={c.id}
                name={entry?.name ?? c.id}
                legend={entry?.legend ?? ''}
                sprite={manifest.sprites.creatures[c.id]}
                met={met.has(c.id)}
              />
            );
          })}
        </ul>
      </section>

      <section className="carnet-section" aria-labelledby="carnet-cedar">
        <h3 id="carnet-cedar" className="carnet-section__title display">
          Le cèdre
        </h3>
        <p className="carnet-section__lead">
          Aujourd’hui{NB}: <strong>{STAGE_NAMES[stage]}</strong>. Il grandit au rythme de vos gestes, et ne rapetisse jamais.
        </p>
        <ol className="carnet-stages">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => {
            const future = n > stage;
            return (
              <li key={n} className={cx('carnet-stage', future && 'is-future', n === stage && 'is-current')} aria-current={n === stage ? 'step' : undefined}>
                <span className="carnet-stage__img" aria-hidden="true">
                  <img src={manifest.stages[n].color} alt="" loading="lazy" decoding="async" draggable={false} />
                </span>
                <span className="carnet-stage__name">{future ? 'À venir' : STAGE_NAMES[n]}</span>
                <span className="visually-hidden">{future ? `Stade ${numberWords(n)}, à venir` : `Stade ${numberWords(n)}`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="carnet-section" aria-labelledby="carnet-memories">
        <h3 id="carnet-memories" className="carnet-section__title display">
          Souvenirs
        </h3>
        <ul className="carnet-memories">
          {memories(appState, prefs.guardianSeen).map((m) => (
            <li key={m.text} className="carnet-memory">
              <span className="carnet-memory__icon" aria-hidden="true">
                <Icon name={m.icon} size={18} />
              </span>
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </Sheet>
  );
}
