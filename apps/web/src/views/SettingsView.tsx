import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { monthKeyToLabel } from '@a2/core';
import { useApp } from '../state/store';
import { exportFilename, parseImportJson, type ImportSummary } from '../state/exportImport';
import { AmountInput } from '../components/AmountInput';
import { RateInput } from '../components/RateInput';
import { ExpenseEditor } from '../components/ExpenseEditor';
import { LoadNotice } from '../components/LoadNotice';
import { PersonDot } from '../components/PersonDot';
import '../styles/shared.css';
import '../styles/settings.css';

/**
 * Réglages : personnes, dépenses récurrentes, réserve par défaut,
 * « Appliquer au mois affiché », export/import JSON.
 *
 * Import : validation + résumé + confirmation AVANT remplacement ; un fichier
 * invalide ne modifie rien. On propose d'exporter les données courantes avant
 * de remplacer.
 */

type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'confirm'; text: string; summary: ImportSummary }
  | { status: 'done'; summary: ImportSummary };

export function SettingsView() {
  const {
    state,
    updatePersonSettings,
    updateRecurringExpense,
    addRecurringExpense,
    removeRecurringExpense,
    applySettingsToCurrentMonth,
    exportJson,
    importJson,
  } = useApp();
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);
  const importConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (importState.status === 'confirm') {
      importConfirmRef.current?.focus();
    }
  }, [importState]);

  if (state === null) {
    return (
      <section className="view" aria-label="Réglages">
        <h1 className="view-title" tabIndex={-1}>Réglages</h1>
        <p className="view-loading">Chargement…</p>
      </section>
    );
  }

  const settings = state.settings;

  const handleExport = () => {
    const json = exportJson();
    if (json === '') {
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) {
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportState({
        status: 'error',
        message: 'Impossible de lire ce fichier : rien n’a été modifié. Essayez de le sélectionner à nouveau.',
      });
      return;
    }
    const result = parseImportJson(text);
    if (!result.ok) {
      setImportState({
        status: 'error',
        message: 'Fichier de sauvegarde invalide : rien n’a été modifié.',
      });
      return;
    }
    setImportState({ status: 'confirm', text, summary: result.summary });
  };

  const confirmImport = () => {
    if (importState.status !== 'confirm') {
      return;
    }
    const result = importJson(importState.text);
    if (result.ok) {
      setImportState({ status: 'done', summary: result.summary });
    } else {
      setImportState({ status: 'error', message: 'Import impossible : rien n’a été modifié.' });
    }
  };

  const personCard = (person: 'A' | 'B') => {
    const id = person.toLowerCase();
    const p = person === 'A' ? settings.personA : settings.personB;
    return (
      <section className="card" aria-label={`Réglages de ${p.name}`}>
        <h2 className="card-title settings-person__title">
          <PersonDot name={p.name} tone={person === 'A' ? 'a' : 'b'} />
          {p.name}
        </h2>
        <div className="field settings-name">
          <label className="field__label" htmlFor={`name-${id}`}>
            Nom
          </label>
          <input
            id={`name-${id}`}
            className="field__input"
            type="text"
            value={p.name}
            onChange={(event) => updatePersonSettings(person, { name: event.target.value })}
          />
        </div>
        <AmountInput
          id={`base-salary-${id}`}
          label="Salaire de base"
          valueCents={p.baseSalaryCents}
          onCommit={(cents) => updatePersonSettings(person, { baseSalaryCents: cents })}
        />
        <div className="settings-rates">
          <RateInput
            id={`base-rate-${id}`}
            label="Taux de base"
            valueBps={p.baseRateBps}
            onCommit={(bps) => updatePersonSettings(person, { baseRateBps: bps })}
          />
          <RateInput
            id={`variable-rate-${id}`}
            label="Taux variable"
            valueBps={p.variableRateBps}
            onCommit={(bps) => updatePersonSettings(person, { variableRateBps: bps })}
          />
        </div>
        <p className="card-hint">
          Le taux de base s’applique au salaire jusqu’au salaire de base ; le taux variable,
          au-delà.
        </p>
      </section>
    );
  };

  return (
    <section className="view" aria-label="Réglages">
      <LoadNotice />
      <header className="page-header">
        <p className="page-eyebrow">À notre façon</p>
        <h1 className="view-title" tabIndex={-1}>Réglages</h1>
        <p className="page-description">Les petits accords qui font notre budget.</p>
      </header>

      {personCard('A')}
      {personCard('B')}

      <section className="card" aria-label="Dépenses récurrentes">
        <h2 className="card-title">Dépenses récurrentes</h2>
        <p className="card-hint">Copiées dans chaque nouveau mois.</p>
        <ExpenseEditor
          idPrefix="recurring"
          items={settings.recurringExpenses}
          onRename={(id, label) => updateRecurringExpense(id, { label })}
          onAmount={(id, cents) => updateRecurringExpense(id, { amountCents: cents })}
          onRemove={removeRecurringExpense}
          onAdd={addRecurringExpense}
          addLabel="Nouvelle dépense récurrente"
        />
      </section>

      <section className="card" aria-label="Appliquer les valeurs par défaut">
        <h2 className="card-title">Valeurs par défaut</h2>
        <p className="card-hint">
          Elles s’appliquent aux nouveaux mois. Les mois existants ne sont jamais recalculés.
        </p>
        <button
          type="button"
          className="btn btn--primary settings-apply"
          onClick={applySettingsToCurrentMonth}
        >
          Appliquer au mois affiché
        </button>
      </section>

      <section className="card" aria-label="Données enregistrées sur cet appareil">
        <h2 className="card-title">Données</h2>
        <p className="card-hint">
          Vos données sont enregistrées sur cet appareil. Effacer les données du navigateur
          supprime l’historique. Le fichier exporté contient des données personnelles.
        </p>
        <div className="settings-data-actions">
          <button type="button" className="btn btn--ghost" onClick={handleExport}>
            Exporter une sauvegarde
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => fileRef.current?.click()}
          >
            Importer une sauvegarde
          </button>
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(event) => void handleFileSelected(event)}
            aria-label="Choisir un fichier de sauvegarde JSON"
          />
        </div>

        {importState.status === 'error' && (
          <p className="import-note import-note--error" role="alert">
            {importState.message}
          </p>
        )}
        {importState.status === 'confirm' && (
          <div
            className="import-confirm"
            ref={importConfirmRef}
            tabIndex={-1}
            role="region"
            aria-live="polite"
            aria-atomic="true"
            aria-labelledby="import-confirm-title"
            aria-describedby="import-confirm-summary"
          >
            <p className="import-confirm__title" id="import-confirm-title">Remplacer les données actuelles ?</p>
            <p className="import-confirm__summary" id="import-confirm-summary">
              Fichier : {importState.summary.monthCount} mois, sélectionné sur{' '}
              {monthKeyToLabel(importState.summary.selectedMonth)}, pour{' '}
              {importState.summary.personAName} et {importState.summary.personBName}. Maison : {importState.summary.taskCount} tâche(s).
            </p>
            <div className="import-confirm__actions">
              <button type="button" className="btn btn--primary" onClick={confirmImport}>
                Remplacer
              </button>
              <button type="button" className="btn btn--ghost" onClick={handleExport}>
                Exporter d’abord
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setImportState({ status: 'idle' })}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
        {importState.status === 'done' && (
          <div className="import-note import-note--success" role="status">
            <span>Données importées ({importState.summary.monthCount} mois).</span>
            <button
              type="button"
              className="import-note__dismiss"
              onClick={() => setImportState({ status: 'idle' })}
            >
              Fermer
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
