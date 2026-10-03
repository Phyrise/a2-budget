/**
 * Réglages (feuille) : personnes, dépenses récurrentes, réserve par défaut,
 * « Appliquer au mois affiché », forêt (pause, mouvement), sauvegarde,
 * recommencer à zéro, à propos. Les valeurs par défaut s'appliquent aux
 * nouveaux mois ; les mois existants ne changent jamais sans action explicite.
 */
import { monthKeyToLabel, type PersonSettings } from '@a2/core';
import { useState, type ReactNode } from 'react';
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
  RateInput,
  Segmented,
  useToast,
  type IconName,
} from '../../ui';
import type { WorldMotion } from '../../world/types';
import { ExpenseAddForm, ExpenseEditorList } from '../budget/ExpenseList';
import { ImportControl } from './ImportControl';
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
        <Companion who={who} size={46} />
        <div className="settings-person__name">
          <InlineTextField
            id={`person-name-${who}`}
            label={`Prénom (compagnon : ${person === 'A' ? 'Jiji' : 'Calcifer'})`}
            value={settings.name}
            onCommit={(name) => renamePerson(person, name)}
            maxLength={24}
            appearance="large"
          />
          <p className="settings-person__companion" aria-hidden="true">
            avec {person === 'A' ? 'Jiji' : 'Calcifer'}
          </p>
        </div>
      </div>
      <AmountInput
        id={`base-salary-${who}`}
        label="Salaire de base"
        valueCents={settings.baseSalaryCents}
        onCommit={(cents) => updatePersonSettings(person, { baseSalaryCents: cents })}
        hint="Prérempli chaque nouveau mois."
      />
      <div className="settings-person__rates">
        <RateInput
          id={`base-rate-${who}`}
          label="Taux de base"
          valueBps={settings.baseRateBps}
          onCommit={(bps) => updatePersonSettings(person, { baseRateBps: bps })}
        />
        <RateInput
          id={`variable-rate-${who}`}
          label="Taux au-delà"
          valueBps={settings.variableRateBps}
          onCommit={(bps) => updatePersonSettings(person, { variableRateBps: bps })}
        />
      </div>
    </div>
  );
}

const MOTION_OPTIONS: ReadonlyArray<{ value: WorldMotion; label: string }> = [
  { value: 'full', label: 'Vivante' },
  { value: 'gentle', label: 'Douce' },
  { value: 'still', label: 'Immobile' },
];

const MOTION_HELP: Record<WorldMotion, string> = {
  full: 'La brume dérive, l’eau coule, les fougères bougent.',
  gentle: 'Mouvements réduits de moitié, sans dérive automatique.',
  still: 'Images fixes, en fondu. Idéal pour économiser la batterie.',
};

export function SettingsSheetContent() {
  const {
    state,
    appState,
    currentMonth,
    updateRecurringExpense,
    removeRecurringExpense,
    addRecurringExpense,
    setDefaultReserve,
    applySettingsToCurrentMonth,
    toggleHomePause,
    exportJson,
    confirmReset,
  } = useApp();
  const { prefs, updatePrefs } = useShell();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmReset2, setConfirmReset2] = useState(false);
  const [applied, setApplied] = useState(false);

  if (state === null || appState === null) return null;
  const settings = state.settings;
  const paused = appState.forest.paused;
  const monthLabel = currentMonth ? monthKeyToLabel(currentMonth.monthKey) : 'le mois affiché';

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
      <Section id="people" icon="users" title="Vous deux" description="Noms, salaires de base et taux. Ils s’appliquent aux nouveaux mois.">
        <div className="settings-people">
          <PersonSettingsCard person="A" settings={settings.personA} />
          <PersonSettingsCard person="B" settings={settings.personB} />
        </div>
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

      <Section id="reserve" icon="shield" title="Réserve" description="Ce que vous souhaitez mettre de côté chaque mois. 0 = pas de réserve.">
        <AmountInput
          id="default-reserve"
          label="Réserve par défaut"
          valueCents={settings.defaultReserveTargetCents}
          onCommit={setDefaultReserve}
        />
      </Section>

      <Section
        id="apply"
        icon="calendar"
        title="Appliquer au mois affiché"
        description={
          <>
            Remplace les personnes, dépenses et réserve de <strong>{monthLabel}</strong> par ces réglages. Les salaires saisis sont
            conservés.
          </>
        }
      >
        <Button variant="quiet" icon="check" onClick={() => setConfirmApply(true)}>
          Appliquer à {monthLabel}
        </Button>
        {applied && (
          <p className="settings__note" role="status">
            <Icon name="check" size={16} /> Réglages appliqués à {monthLabel}.
          </p>
        )}
      </Section>

      <Section id="forest" icon="leaf" title="Forêt" description="La maison en pause : la forêt dort, rien ne se perd.">
        <Button variant={paused ? 'primary' : 'quiet'} icon={paused ? 'sun' : 'moon'} onClick={toggleHomePause}>
          {paused ? 'Réveiller la forêt' : 'Mettre la maison en pause'}
        </Button>
        <div className="settings__motion">
          <Segmented
            name="forest-motion"
            legend="Mouvement de la forêt"
            options={MOTION_OPTIONS}
            value={prefs.forestMotion}
            onChange={(forestMotion) => updatePrefs({ forestMotion })}
          />
          <p className="field__hint">{MOTION_HELP[prefs.forestMotion]}</p>
        </div>
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
        <div className="settings-about__pair" aria-hidden="true">
          <Companion who="a" size={40} mood="sleepy" />
          <Companion who="b" size={38} mood="sleepy" />
        </div>
        <p className="settings-about__name display">A² Home</p>
        <p className="settings-about__text">
          Notre quotidien à deux&nbsp;: budget, maison et courses. Vos données restent sur cet appareil — aucun compte, aucune
          connexion.
        </p>
      </section>

      <ConfirmDialog
        open={confirmApply}
        title={`Appliquer à ${monthLabel} ?`}
        confirmLabel="Appliquer"
        onCancel={() => setConfirmApply(false)}
        onConfirm={() => {
          setConfirmApply(false);
          applySettingsToCurrentMonth();
          setApplied(true);
          toast.show({ message: `Réglages appliqués à ${monthLabel}`, icon: 'check' });
        }}
      >
        <p>Les personnes, les dépenses et la réserve de ce mois seront remplacées par les réglages actuels. Les salaires saisis restent.</p>
      </ConfirmDialog>

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
