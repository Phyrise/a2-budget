/**
 * « En une phrase » : en tête de la feuille d'ajout, une phrase
 * (« dîner chez Léa samedi 20h ») remplit le reste au fil de la frappe —
 * titre, jour, heure, genre de moment ; on relit dessous, puis on ajoute.
 */
import { forwardRef } from 'react';
import { Icon } from '../../ui';

export const SentenceField = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void }>(function SentenceField(
  { value, onChange },
  ref,
) {
  return (
    <div className="field cal-sentence">
      <label className="field__label" htmlFor="event-sentence">
        En une phrase
      </label>
      <div className="cal-sentence__box">
        <Icon name="sparkle" size={18} className="cal-sentence__icon" />
        <input
          ref={ref}
          id="event-sentence"
          className="cal-sentence__input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="dîner chez Léa samedi 20h"
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          maxLength={160}
          aria-describedby="event-sentence-hint"
        />
      </div>
      <p className="field__hint" id="event-sentence-hint">
        Le jour, l’heure et le genre de moment sont reconnus&#8239;; relisez ci-dessous avant d’ajouter.
      </p>
    </div>
  );
});
