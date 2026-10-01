import {
  validatePersistedState,
  type PersistedState,
} from '@a2/core';

/** Résumé d'un import, affiché avant confirmation de remplacement. */
export interface ImportSummary {
  monthCount: number;
  selectedMonth: string;
  personAName: string;
  personBName: string;
}

/** Enveloppe d'export versionnée. */
interface ExportEnvelope {
  app: 'a2-budget';
  schemaVersion: 1;
  exportedAt: string;
  state: PersistedState;
}

/** JSON d'export prêt à télécharger. */
export function buildExportJson(state: PersistedState): string {
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
): { ok: true; state: PersistedState; summary: ImportSummary } | { ok: false; reason: string } {
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

  const check = validatePersistedState(candidate);
  if (!check.ok) {
    return { ok: false, reason: check.reason };
  }

  const s = check.state;
  return {
    ok: true,
    state: s,
    summary: {
      monthCount: s.months.length,
      selectedMonth: s.selectedMonth,
      personAName: s.settings.personA.name,
      personBName: s.settings.personB.name,
    },
  };
}
