/**
 * Mode développeur — V5.1 quêtes communes : « Faire apparaître une quête »
 * (type au choix), aujourd'hui. Synchronisé : ÉCRITE dans le foyer partagé,
 * elle apparaît chez les deux en temps réel. Invité : apparition locale, et
 * deux touchers au choix (AL / AC) pour tester seul. V5.3 : emplacement
 * au choix (Auto = celui du modèle, sinon 1 à 3) pour voir chaque place.
 */
import { useState } from 'react';
import { QUEST_SPOTS, QUEST_TAB, localDateKey, questOfDay, type QuestKind } from '@a2/core';
import { useShell } from '../../app/ShellContext';
import { questMemory } from '../quests/questMemory';
import { useApp } from '../../state/store';
import { Button, useToast } from '../../ui';

const KINDS: Array<{ kind: QuestKind; label: string }> = [
  { kind: 'rocher', label: 'Rocher (Budget)' },
  { kind: 'tresor', label: 'Colis (Courses)' },
  { kind: 'pousse', label: 'Pousse (Calendrier)' },
];

/** Le temps que la feuille se ferme avant de montrer l'onglet. */
const CLOSE_MS = 320;

export function DevQuests({ onClose }: { onClose: () => void }) {
  const { appState, today, me, spawnQuest, helpQuest } = useApp();
  const { setModule } = useShell();
  const toast = useToast();
  const [spot, setSpot] = useState<number | undefined>(undefined);
  const current = questOfDay(appState?.quests?.items, localDateKey(today), { scheduled: me !== null });

  const go = (kind: QuestKind) => {
    onClose();
    window.setTimeout(() => setModule(QUEST_TAB[kind]), CLOSE_MS);
  };

  const spawn = (kind: QuestKind) => {
    const q = spawnQuest(kind, spot);
    if (q === null) {
      toast.show({ message: 'La quête n’a pas pu apparaître', icon: 'alert' });
      return;
    }
    go(kind);
  };

  const helpAs = (role: 'a' | 'b') => {
    if (current === null) return;
    if (helpQuest(current, role) === null) toast.show({ message: 'Déjà aidé', icon: 'check' });
    else {
      questMemory.markHelped(current.id);
      go(current.kind);
    }
  };

  return (
    <section className="dev-section" aria-labelledby="dev-quests">
      <h3 id="dev-quests" className="dev-section__title">
        Quêtes à deux
      </h3>
      <p className="dev-section__lead">
        {me !== null ? 'Écrite dans le foyer partagé : elle apparaît chez les deux.' : 'Invité : locale, touchez comme AL puis AC.'}
      </p>
      <div className="dev-actions" role="group" aria-label="Emplacement">
        {[undefined, ...Array.from({ length: QUEST_SPOTS }, (_, i) => i)].map((s) => (
          <Button key={s ?? 'auto'} size="sm" variant={spot === s ? 'primary' : 'quiet'} aria-pressed={spot === s} onClick={() => setSpot(s)}>
            {s === undefined ? 'Auto' : `Place ${s + 1}`}
          </Button>
        ))}
      </div>
      <div className="dev-actions">
        {KINDS.map((k) => (
          <Button key={k.kind} size="sm" variant="quiet" onClick={() => spawn(k.kind)}>
            {k.label}
          </Button>
        ))}
      </div>
      {me === null && current !== null && (
        <div className="dev-actions">
          <Button size="sm" variant="quiet" disabled={current.helpers.a !== undefined} onClick={() => helpAs('a')}>
            Aide AL
          </Button>
          <Button size="sm" variant="quiet" disabled={current.helpers.b !== undefined} onClick={() => helpAs('b')}>
            Aide AC
          </Button>
        </div>
      )}
    </section>
  );
}
