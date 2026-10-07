/**
 * Réglages (feuille), allégés en V4.2 : vous deux (prénom au crayon, salaire
 * habituel sur une ligne), compte (V5, seulement si Firebase est configuré :
 * connecté avec Google ou invité), anniversaires (V4.3, au crayon), taux communs au
 * curseur (globaux : mois courant et suivants), dépenses récurrentes
 * (nouveaux mois), préférences (forêt vivante / immobile, sons), sauvegarde,
 * recommencer à zéro, à propos.
 * Plus de réserve, d'« Appliquer au mois affiché » ni de pause ici (la pause
 * reste dans l'en-tête, avec la lune).
 */
import type { PersonSettings } from '@a2/core';
import { useState, type ReactNode } from 'react';
import { AccountPanel } from '../../account/AccountPanel';
import { FIREBASE_ENABLED } from '../../sync/firebase/config';
import { useShell } from '../../app/ShellContext';
import { exportFilename } from '../../state/exportImport';
import { useApp } from '../../state/store';
import {
  AmountInput,
  Button,
  Companion,
  ConfirmDialog,
  Icon,
  InlineTextField,
  Segmented,
  Switch,
  type IconName,
} from '../../ui';
import type { WorldMotion } from '../../world/types';
import { ExpenseAddForm, ExpenseEditorList } from '../budget/ExpenseList';
import { AnniversariesEditor } from './AnniversariesEditor';
import { ImportControl } from './ImportControl';
import { SharedRatesEditor } from './SharedRates';
import { SoundSetting } from '../../app/sound';
import './settings.css';

function Section({ id, icon, title, children, description }: { id: string; icon: IconName; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="settings-section" aria-labelledby={`${id}-title`}>
      <header className="settings-section__head">
        <span className="settings-section__icon">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h3 id={`${id}-title`} className="settings-section__title">
            {title}
          </h3>
          {description && <p className="settings-section__desc">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function PersonSettingsCard({ person, settings }: { person: 'A' | 'B'; settings: PersonSettings }) {
  const { updatePersonSettings, renamePerson } = useApp();
  const who = person === 'A' ? 'a' : 'b';
  return (
    <div className={`settings-person settings-person--${who}`}>
      <div className="settings-person__head">
        <Companion who={who} size={46} touchable />
        <div className="settings-person__name">
          <div className="settings-person__edit">
            <InlineTextField
              id={`person-name-${who}`}
              label={`Prénom (compagnon : ${person === 'A' ? 'Jiji' : 'Calcifer'})`}
              value={settings.name}
              onCommit={(name) => renamePerson(person, name)}
              maxLength={24}
              appearance="large"
            />
            {/* Le crayon dit « modifiable » ; le toucher place le curseur dans le prénom. */}
            <label htmlFor={`person-name-${who}`} className="settings-person__pencil" aria-hidden="true">
              <Icon name="edit" size={17} />
            </label>
          </div>
          <p className="settings-person__companion" aria-hidden="true">
            avec {person === 'A' ? 'Jiji' : 'Calcifer'}
          </p>
        </div>
      </div>
      <AmountInput
        id={`base-salary-${who}`}
        label="Salaire habituel"
        valueCents={settings.baseSalaryCents}
        onCommit={(cents) => updatePersonSettings(person, { baseSalaryCents: cents })}
        className="settings-person__salary"
      />
    </div>
  );
}

/** V4.2 : deux choix seulement (l'ancienne « douce » se lit « vivante », app/prefs.ts). */
type ForestChoice = Extract<WorldMotion, 'full' | 'still'>;

const MOTION_OPTIONS: ReadonlyArray<{ value: ForestChoice; label: string }> = [
  { value: 'full', label: 'Vivante' },
  { value: 'still', label: 'Immobile' },
];

const MOTION_HELP: Record<ForestChoice, string> = {
  full: 'La brume dérive, l’eau coule, les fougères bougent.',
  still: 'Images fixes, en fondu. Idéal pour économiser la batterie.',
};

export function SettingsSheetContent() {
  const { state, updateRecurringExpense, removeRecurringExpense, addRecurringExpense, exportJson, confirmReset } = useApp();
  const { prefs, updatePrefs } = useShell();
  const [adding, setAdding] = useState(false);
  const [confirmReset2, setConfirmReset2] = useState(false);

  if (state === null) return null;
  const settings = state.settings;
  const motion: ForestChoice = prefs.forestMotion === 'still' ? 'still' : 'full';

  const doExport = () => {
    const json = exportJson();
    if (json === '') return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="settings">
      <div className="settings-people" role="group" aria-label="Vous deux">
        <PersonSettingsCard person="A" settings={settings.personA} />
        <PersonSettingsCard person="B" settings={settings.personB} />
      </div>

      {FIREBASE_ENABLED && (
        <Section id="account" icon="user" title="Compte">
          <AccountPanel />
        </Section>
      )}

      <Section id="anniversaries" icon="sparkle" title="Anniversaires">
        <AnniversariesEditor />
      </Section>

      <Section id="rates" icon="budget" title="Taux communs">
        <SharedRatesEditor settings={settings} />
      </Section>

      <Section id="recurring" icon="repeat" title="Dépenses récurrentes" description="Copiées dans chaque nouveau mois.">
        {settings.recurringExpenses.length > 0 && (
          <ExpenseEditorList
            idPrefix="rec"
            expenses={settings.recurringExpenses}
            onRename={(id, label) => updateRecurringExpense(id, { label })}
            onAmount={(id, cents) => updateRecurringExpense(id, { amountCents: cents })}
            onRemove={removeRecurringExpense}
          />
        )}
        {adding ? (
          <ExpenseAddForm idPrefix="rec" onAdd={addRecurringExpense} onClose={() => setAdding(false)} />
        ) : (
          <Button variant="ghost" icon="plus" size="sm" className="settings__add" onClick={() => setAdding(true)}>
            Ajouter une dépense récurrente
          </Button>
        )}
      </Section>

      <Section id="prefs" icon="leaf" title="Préférences" description="Rien que pour cet appareil.">
        <div className="settings__motion">
          <Segmented
            name="forest-motion"
            legend="Forêt"
            options={MOTION_OPTIONS}
            value={motion}
            onChange={(forestMotion) => updatePrefs({ forestMotion })}
          />
          <p className="field__hint">{MOTION_HELP[motion]}</p>
        </div>
        <SoundSetting />
      </Section>

      <Section id="backup" icon="download" title="Sauvegarde" description="Un fichier JSON pour garder vos données ou les passer sur un autre appareil.">
        <div className="settings__backup">
          <Button variant="quiet" icon="download" onClick={doExport}>
            Exporter une sauvegarde
          </Button>
          <ImportControl />
        </div>
      </Section>

      <Section id="reset" icon="alert" title="Recommencer à zéro" description="Efface toutes les données de cet appareil : budget, maison, forêt et courses.">
        <Button variant="danger-ghost" icon="trash" onClick={() => setConfirmReset2(true)}>
          Tout effacer…
        </Button>
      </Section>

      <section className="settings-about" aria-label="À propos">
        <div className="settings-about__pair">
          <Companion who="a" size={40} mood="sleepy" touchable />
          <Companion who="b" size={38} mood="sleepy" touchable />
        </div>
        <p className="settings-about__name display">A² Home</p>
        <div className="settings-about__dev">
          <Switch
            id="dev-mode"
            checked={prefs.devMode}
            onChange={(devMode) => updatePrefs({ devMode })}
            label="Mode développeur"
            description={
              prefs.devMode
                ? 'Pour régler l’app pendant sa création. Le bouton « DEV » de l’en-tête révèle les valeurs cachées de la forêt.'
                : 'Pour régler l’app pendant sa création : révèle les valeurs cachées de la forêt.'
            }
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset2}
        title={'Tout effacer ?'}
        confirmLabel="Effacer définitivement"
        tone="danger"
        acknowledge="Je comprends que toutes les données de cet appareil seront supprimées."
        onCancel={() => setConfirmReset2(false)}
        onConfirm={() => {
          setConfirmReset2(false);
          confirmReset();
        }}
      >
        <p>Budget, tâches, forêt et courses repartiront de zéro. Exportez d’abord une sauvegarde si vous voulez les garder.</p>
      </ConfirmDialog>
    </div>
  );
}
