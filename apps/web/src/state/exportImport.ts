import {
  migrateState,
  type AppState,
} from '@a2/core';

/** Résumé d'un import, affiché avant confirmation de remplacement. */
export interface ImportSummary {
  monthCount: number;
  selectedMonth: string;
  personAName: string;
  personBName: string;
  taskCount: number;
}

/** Enveloppe d'export versionnée. */
interface ExportEnvelope {
  app: 'a2-budget';
  schemaVersion: 2;
  exportedAt: string;
  state: AppState;
}

/** JSON d'export prêt à télécharger. */
export function buildExportJson(state: AppState): string {
  const envelope: ExportEnvelope = {
    app: 'a2-budget',
    schemaVersion: state.schemaVersion,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Nom de fichier d'export daté : a2-budget-2026-10-01.json */
export function exportFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `a2-budget-${y}-${m}-${d}.json`;
}

/**
 * Analyse et validation d'un import.
 *
 * Accepte soit un PersistedState brut, soit l'enveloppe d'export
 * { app, schemaVersion, exportedAt, state }. Un fichier invalide ne modifie
 * rien : le store n'est appelé qu'après ok: true.
 */
export function parseImportJson(
  text: string,
): { ok: true; state: AppState; summary: ImportSummary } | { ok: false; reason: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }

  const candidate: unknown =
    value !== null &&
    typeof value === 'object' &&
    'app' in value &&
    (value as { app?: unknown }).app === 'a2-budget' &&
    'state' in value
      ? (value as { state: unknown }).state
      : value;

  if (value !== null && typeof value === 'object' && 'app' in value && 'state' in value) {
    const envelope = value as { app: unknown; schemaVersion?: unknown; state: unknown };
    if (envelope.app !== 'a2-budget') return { ok: false, reason: 'unexpected-app' };
    if (envelope.schemaVersion !== 1 && envelope.schemaVersion !== 2) return { ok: false, reason: 'unsupported-version' };
    if (!candidate || typeof candidate !== 'object' || !('schemaVersion' in candidate) || candidate.schemaVersion !== envelope.schemaVersion) return { ok: false, reason: 'version-mismatch' };
  }

  const check = migrateState(candidate);
  if (!check.ok) {
    return { ok: false, reason: check.reason };
  }

  const s = check.state.budget;
  return {
    ok: true,
    state: check.state,
    summary: {
      monthCount: s.months.length,
      selectedMonth: s.selectedMonth,
      personAName: s.settings.personA.name,
      personBName: s.settings.personB.name,
      taskCount: check.state.chores.tasks.length,
    },
  };
}
