/**
 * Réglages › Anniversaires (V4.3) : une ligne chacun, modifiable au crayon
 * comme les prénoms — le couple (« tous les 19 »), AL avec Jiji, AC avec
 * Calcifer (« 19 août »). Saisie libre en français (@a2/core
 * parseCoupleDay / parseMonthDay) ; une date illisible est refusée et
 * l'ancienne revient.
 */
import {
  coupleDayLabel,
  defaultAnniversaries,
  monthDayLabel,
  parseCoupleDay,
  parseMonthDay,
  type Anniversaries,
} from '@a2/core';
import type { ReactNode } from 'react';
import { useApp } from '../../state/store';
import { Companion, Icon, InlineTextField, useToast } from '../../ui';
import { Lampion } from '../fetes/Lampion';
import { deName } from '../fetes/names';
import './anniversaries.css';

function Row({
  id,
  who,
  figure,
  name,
  label,
  value,
  onCommit,
}: {
  id: string;
  who: 'a' | 'b' | 'both';
  figure: ReactNode;
  name: string;
  label: string;
  value: string;
  onCommit: (text: string) => void;
}) {
  return (
    <li className={`settings-anniv settings-anniv--${who}`}>
      <span className="settings-anniv__figure" aria-hidden="true">
        {figure}
      </span>
      <span className="settings-anniv__name" aria-hidden="true">
        {name}
      </span>
      <div className="settings-anniv__edit">
        <InlineTextField id={id} label={label} value={value} onCommit={onCommit} maxLength={32} />
        <label htmlFor={id} className="settings-anniv__pencil" aria-hidden="true">
          <Icon name="edit" size={15} />
        </label>
      </div>
    </li>
  );
}

export function AnniversariesEditor() {
  const { appState, setAnniversaries } = useApp();
  const toast = useToast();
  if (appState === null) return null;
  const anniv: Anniversaries = appState.anniversaries ?? defaultAnniversaries();
  const names = { a: appState.budget.settings.personA.name, b: appState.budget.settings.personB.name };

  const refuse = () => toast.show({ message: 'Date non reconnue', icon: 'alert' });

  const commitCouple = (text: string) => {
    const day = parseCoupleDay(text);
    if (day === null) return refuse();
    if (day !== anniv.coupleDay) setAnniversaries({ ...anniv, coupleDay: day });
  };

  const commitPerson = (who: 'a' | 'b') => (text: string) => {
    const md = parseMonthDay(text);
    if (md === null) return refuse();
    setAnniversaries({ ...anniv, [who]: md });
  };

  return (
    <ul className="settings-annivs">
      <Row
        id="anniv-couple"
        who="both"
        figure={<Lampion size={22} />}
        name="Nous deux"
        label="Anniversaire du couple, chaque mois"
        value={coupleDayLabel(anniv.coupleDay)}
        onCommit={commitCouple}
      />
      <Row
        id="anniv-a"
        who="a"
        figure={<Companion who="a" size={30} />}
        name={names.a}
        label={`Anniversaire ${deName(names.a)}`}
        value={monthDayLabel(anniv.a)}
        onCommit={commitPerson('a')}
      />
      <Row
        id="anniv-b"
        who="b"
        figure={<Companion who="b" size={30} />}
        name={names.b}
        label={`Anniversaire ${deName(names.b)}`}
        value={monthDayLabel(anniv.b)}
        onCommit={commitPerson('b')}
      />
    </ul>
  );
}
