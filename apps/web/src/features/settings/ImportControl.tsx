/**
 * Import d'une sauvegarde JSON : lecture du fichier, résumé, confirmation
 * explicite, puis remplacement par le store. Un fichier invalide ne change
 * rien. Utilisé par les Réglages et par la bannière de récupération.
 */
import { monthKeyToLabel } from '@a2/core';
import { useId, useRef, useState } from 'react';
import { parseImportJson, type ImportSummary } from '../../state/exportImport';
import { useApp } from '../../state/store';
import { Button, ConfirmDialog, Icon, plural, type ButtonVariant } from '../../ui';

function reasonMessage(reason: string): string {
  switch (reason) {
    case 'invalid-json':
      return 'Fichier invalide : ce n’est pas une sauvegarde A² Home lisible.';
    case 'unexpected-app':
      return 'Fichier invalide : il ne provient pas d’A² Home.';
    case 'unsupported-version':
    case 'version-mismatch':
      return 'Sauvegarde invalide : version non prise en charge.';
    default:
      return 'Sauvegarde invalide : contenu inattendu. Rien n’a été modifié.';
  }
}

function safeMonthLabel(key: string): string {
  try {
    return monthKeyToLabel(key);
  } catch {
    return key;
  }
}

export function ImportControl({
  variant = 'quiet',
  label = 'Importer une sauvegarde',
  block = false,
}: {
  variant?: ButtonVariant;
  label?: string;
  block?: boolean;
}) {
  const { importJson, appState } = useApp();
  const currentEvents = appState?.calendar?.events.length ?? 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [pending, setPending] = useState<{ text: string; summary: ImportSummary; name: string } | null>(null);
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setNote(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNote({ tone: 'error', text: 'Fichier illisible. Rien n’a été modifié.' });
      return;
    }
    const parsed = parseImportJson(text);
    if (!parsed.ok) {
      setNote({ tone: 'error', text: reasonMessage(parsed.reason) });
      return;
    }
    setPending({ text, summary: parsed.summary, name: file.name });
  };

  const confirm = () => {
    if (pending === null) return;
    const result = importJson(pending.text);
    setPending(null);
    setNote(
      result.ok
        ? { tone: 'success', text: 'Sauvegarde importée. Les données de cet appareil ont été remplacées.' }
        : { tone: 'error', text: reasonMessage(result.reason) },
    );
  };

  const s = pending?.summary;

  return (
    <div className="import-control">
      <input
        ref={inputRef}
        id={inputId}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Button variant={variant} icon="upload" block={block} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      {note && (
        <p className={`import-note import-note--${note.tone}`} role={note.tone === 'error' ? 'alert' : 'status'}>
          <Icon name={note.tone === 'error' ? 'alert' : 'check'} size={18} />
          <span>{note.text}</span>
        </p>
      )}
      <ConfirmDialog
        open={pending !== null}
        title={"Remplacer les données\u202f?"}
        confirmLabel="Remplacer"
        tone="danger"
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      >
        {s && (
          <div className="import-confirm">
            <p>
              La sauvegarde <strong>{pending?.name}</strong> remplacera toutes les données de cet appareil.
            </p>
            <ul className="import-confirm__list">
              <li>
                {s.personAName} et {s.personBName}
              </li>
              <li>
                Budget&nbsp;: {plural(s.monthCount, 'mois', 'mois')}, mois affiché {safeMonthLabel(s.selectedMonth)}
              </li>
              <li>
                Maison&nbsp;: {plural(s.taskCount, 'tâche')}, {plural(s.completionCount, 'geste')} dans l’historique
              </li>
              <li>Courses&nbsp;: {plural(s.groceryCount, 'article')}</li>
              <li>
                Calendrier&nbsp;: {plural(s.calendarEventCount, 'événement')}
                {s.calendarEventCount < currentEvents && ` (${plural(currentEvents, 'événement')} sur cet appareil aujourd’hui)`}
              </li>
            </ul>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
