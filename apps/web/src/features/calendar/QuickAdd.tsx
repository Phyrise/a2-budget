/**
 * Saisie rapide : une phrase (« dîner chez Léa samedi 20h ») pré-remplit la
 * feuille d'ajout (titre, jour, heure, nature) ; on relit puis on valide.
 */
import { useState } from 'react';
import type { CalendarEventKind } from '@a2/core';
import { Button, Icon } from '../../ui';
import { quickParse } from './quickParse';

export interface QuickPrefill {
  title?: string;
  date?: string;
  time?: string;
  endTime?: string;
  kind?: CalendarEventKind;
}

export function QuickAdd({ now, onSubmit }: { now: Date; onSubmit: (prefill: QuickPrefill) => void }) {
  const [text, setText] = useState('');

  const submit = () => {
    const raw = text.trim();
    if (raw === '') {
      onSubmit({});
      return;
    }
    const parsed = quickParse(raw, now);
    const prefill: QuickPrefill = { title: parsed.title || raw };
    if (parsed.date) prefill.date = parsed.date;
    if (parsed.time) prefill.time = parsed.time;
    if (parsed.endTime) prefill.endTime = parsed.endTime;
    if (parsed.kind) prefill.kind = parsed.kind;
    onSubmit(prefill);
    setText('');
  };

  return (
    <form
      className="cal-quick"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="visually-hidden" htmlFor="cal-quick-input">
        Prévoir un moment en une phrase
      </label>
      <Icon name="calendar" size={20} className="cal-quick__icon" />
      <input
        id="cal-quick-input"
        className="cal-quick__input"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="dîner samedi 20h"
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="go"
        maxLength={160}
        aria-describedby="cal-quick-hint"
      />
      <Button type="submit" variant="primary" size="sm" icon="plus" className="cal-quick__submit">
        Prévoir
      </Button>
      <span id="cal-quick-hint" className="visually-hidden">
        Le jour, l’heure et le genre de moment sont reconnus ; vous pourrez tout relire avant d’ajouter.
      </span>
    </form>
  );
}
