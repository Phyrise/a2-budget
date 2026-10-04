/**
 * Feuille d'ajout / d'édition d'un événement : titre, nature (chips
 * illustrées), jour, journée entière ou heures, pour qui, lieu, note,
 * « tous les ans » (automatique pour un anniversaire, avec l'année de
 * naissance facultative pour afficher l'âge). Suppression : le parent
 * retire l'événement et propose « Annuler » dans un toast.
 */
import { parseLocalDateKey, type CalendarEvent, type CalendarEventKind, type CalendarWho } from '@a2/core';
import { useRef, useState } from 'react';
import { useApp } from '../../state/store';
import { Button, Companion, Icon, Segmented, Sheet, TextField, cx, longDate } from '../../ui';
import { Switch } from '../../ui/Switch';
import { initialValues, reasonMessage, toDraft, validate, type EventFormValues, type EventSheetState, type FieldErrors } from './eventForm';
import { KINDS, KindIcon, kindStyle } from './kinds';
import './event-sheet.css';

function KindPicker({ value, onChange }: { value: CalendarEventKind; onChange: (kind: CalendarEventKind) => void }) {
  return (
    <fieldset className="cal-kinds">
      <legend className="field__label">Quel genre de moment&#8239;?</legend>
      <div className="cal-kinds__list">
        {KINDS.map((k) => (
          <label key={k.kind} className={cx('cal-kind-chip', value === k.kind && 'is-checked')} style={kindStyle(k.kind)}>
            <input
              type="radio"
              name="event-kind"
              value={k.kind}
              checked={value === k.kind}
              onChange={() => onChange(k.kind)}
              className="cal-kind-chip__input"
            />
            <span className="cal-kind-chip__icon">
              <KindIcon kind={k.kind} size={18} />
            </span>
            <span className="cal-kind-chip__label">{k.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function WhoOption({ who, name }: { who: CalendarWho; name: string }) {
  return (
    <span className="cal-who-option">
      <Companion who={who} size={who === 'both' ? 22 : 26} />
      <span>{name}</span>
    </span>
  );
}

export function EventSheet({
  state,
  onClose,
  onSaved,
  onRemove,
}: {
  state: EventSheetState;
  onClose: () => void;
  onSaved: (event: CalendarEvent, created: boolean) => void;
  onRemove: (event: CalendarEvent) => void;
}) {
  const { appState, addCalendarEvent, updateCalendarEvent } = useApp();
  const titleRef = useRef<HTMLInputElement>(null);
  const editing = state?.mode === 'edit' ? state.event : null;
  const [v, setV] = useState<EventFormValues | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [yearlyTouched, setYearlyTouched] = useState(false);
  const [shownState, setShownState] = useState<EventSheetState>(null);

  // Réinitialise le formulaire à chaque ouverture, pendant le rendu : le
  // champ titre existe dès que la feuille prend le focus.
  if (state !== shownState) {
    setShownState(state);
    if (state !== null) {
      setV(initialValues(state));
      setErrors({});
      setFormError(null);
      setYearlyTouched(state.mode === 'edit');
    }
  }

  const names = {
    a: appState?.budget.settings.personA.name ?? 'AL',
    b: appState?.budget.settings.personB.name ?? 'AC',
  };

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setV((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError(null);
  };

  const setKind = (kind: CalendarEventKind) => {
    setV((prev) => {
      if (!prev) return prev;
      const next = { ...prev, kind };
      // « Tous les ans » suit l'anniversaire tant qu'on n'y a pas touché.
      if (!yearlyTouched) next.yearly = kind === 'anniversaire';
      return next;
    });
  };

  const submit = () => {
    if (!v) return;
    const found = validate(v, new Date());
    if (Object.keys(found).length > 0) {
      setErrors(found);
      if (found.title) titleRef.current?.focus();
      return;
    }
    const draft = toDraft(v, new Date());
    const result = editing ? updateCalendarEvent(editing.id, draft) : addCalendarEvent(draft);
    if (!result.ok) {
      setFormError(reasonMessage(result.reason));
      return;
    }
    onSaved(result.event, editing === null);
  };

  const whoOptions = [
    { value: 'both' as const, ariaLabel: 'Ensemble', label: <WhoOption who="both" name="Ensemble" /> },
    { value: 'a' as const, ariaLabel: names.a, label: <WhoOption who="a" name={names.a} /> },
    { value: 'b' as const, ariaLabel: names.b, label: <WhoOption who="b" name={names.b} /> },
  ];
  const birthday = v?.kind === 'anniversaire';

  return (
    <Sheet
      open={state !== null}
      onClose={onClose}
      title={editing ? 'Modifier l’événement' : 'Nouvel événement'}
      size="auto"
      initialFocusRef={editing ? undefined : titleRef}
      className="event-sheet"
      footer={
        <>
          {editing && (
            <Button variant="danger-ghost" icon="trash" onClick={() => onRemove(editing)} className="event-sheet__delete">
              Supprimer
            </Button>
          )}
          <Button variant="primary" onClick={submit} icon={editing ? 'check' : 'plus'}>
            {editing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </>
      }
    >
      {v && (
        <form
          className="cal-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <TextField
            ref={titleRef}
            id="event-title"
            label="Quoi&#8239;?"
            value={v.title}
            onChange={(value) => set('title', value)}
            placeholder={birthday ? 'Ex. Léa' : 'Ex. Dîner chez Léa'}
            maxLength={120}
            enterKeyHint="done"
            error={errors.title}
            autoCapitalize="sentences"
            hint={birthday ? 'Le prénom suffit : on affichera « Anniversaire de… ».' : undefined}
          />

          <KindPicker value={v.kind} onChange={setKind} />

          <div className="cal-form__group">
            <div className={cx('field', errors.date && 'is-invalid')}>
              <label className="field__label" htmlFor="event-date">
                Quel jour&#8239;?
              </label>
              <input
                id="event-date"
                className="field__input cal-form__date"
                type="date"
                value={v.date}
                onChange={(event) => set('date', event.target.value)}
                aria-invalid={errors.date ? true : undefined}
                aria-describedby={errors.date ? 'event-date-error' : 'event-date-hint'}
                required
              />
              {!errors.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && (
                <p className="field__hint" id="event-date-hint">
                  {longDate(parseLocalDateKey(v.date))}
                  {v.yearly ? ', puis chaque année' : ''}
                  {v.yearly && v.date.endsWith('-02-29') ? ' (le 28\u00a0février les années sans 29)' : ''}
                </p>
              )}
              {errors.date && (
                <p className="field__error" id="event-date-error" role="alert">
                  {errors.date}
                </p>
              )}
            </div>
            {birthday && (
              <TextField
                id="event-birth-year"
                label="Année de naissance (facultatif)"
                value={v.birthYear}
                onChange={(value) => set('birthYear', value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="Ex. 1991"
                maxLength={4}
                error={errors.birthYear}
                hint="Pour afficher l’âge. Sinon, on n’en parle pas."
              />
            )}
            <Switch
              id="event-allday"
              checked={v.allDay}
              onChange={(checked) => set('allDay', checked)}
              label="Toute la journée"
              icon={<Icon name="sun" size={19} />}
            />
            {!v.allDay && (
              <div className="cal-form__times">
                <div className={cx('field', errors.time && 'is-invalid')}>
                  <label className="field__label" htmlFor="event-time">
                    Début
                  </label>
                  <input
                    id="event-time"
                    className="field__input cal-form__time"
                    type="time"
                    value={v.time}
                    onChange={(event) => set('time', event.target.value)}
                    aria-invalid={errors.time ? true : undefined}
                    aria-describedby={errors.time ? 'event-time-error' : undefined}
                  />
                </div>
                <div className={cx('field', errors.endTime && 'is-invalid')}>
                  <label className="field__label" htmlFor="event-end">
                    Fin <span className="cal-form__optional">(facultatif)</span>
                  </label>
                  <input
                    id="event-end"
                    className="field__input cal-form__time"
                    type="time"
                    value={v.endTime}
                    onChange={(event) => set('endTime', event.target.value)}
                    aria-invalid={errors.endTime ? true : undefined}
                    aria-describedby={errors.endTime ? 'event-end-error' : undefined}
                  />
                </div>
                {(errors.time || errors.endTime) && (
                  <p className="field__error cal-form__times-error" id={errors.time ? 'event-time-error' : 'event-end-error'} role="alert">
                    {errors.time ?? errors.endTime}
                  </p>
                )}
                {v.endTime !== '' && v.time !== '' && v.endTime < v.time && (
                  <p className="field__hint cal-form__times-error">Se termine après minuit.</p>
                )}
              </div>
            )}
          </div>

          <Segmented name="event-who" legend="Pour qui&#8239;?" options={whoOptions} value={v.who} onChange={(who) => set('who', who)} columns={3} className="cal-form__who" />

          <TextField
            id="event-place"
            label="Où&#8239;? (facultatif)"
            value={v.place}
            onChange={(value) => set('place', value)}
            placeholder="Ex. Chez Léa, Montreuil"
            maxLength={120}
            autoCapitalize="sentences"
          />

          <div className="field">
            <label className="field__label" htmlFor="event-note">
              Un petit mot <span className="cal-form__optional">(facultatif)</span>
            </label>
            <textarea
              id="event-note"
              className="field__input cal-form__note"
              value={v.note}
              onChange={(event) => set('note', event.target.value)}
              placeholder="Apporter le dessert, réserver la table…"
              maxLength={1000}
              rows={2}
            />
          </div>

          <Switch
            id="event-yearly"
            checked={v.yearly}
            onChange={(checked) => {
              setYearlyTouched(true);
              set('yearly', checked);
            }}
            label="Tous les ans"
            description="Revient chaque année à la même date."
            icon={<Icon name="repeat" size={19} />}
          />

          {formError && (
            <p className="field__error cal-form__error" role="alert">
              {formError}
            </p>
          )}
        </form>
      )}
    </Sheet>
  );
}
