import { describe, expect, it } from 'vitest';
import { emptyState } from '../index.js';
import { emptyAppState, createTask } from './index.js';
import { buildExportJson, parseImportJson } from '../../../../apps/web/src/state/exportImport.js';

describe('app import/export V2 integration', () => {
  it('imports legacy V1 while preserving names and the complete Budget payload', () => {
    const legacy = emptyState();
    legacy.settings.personA.name = 'Personne A';
    legacy.settings.defaultReserveTargetCents = 50_000;
    const result = parseImportJson(JSON.stringify({ app: 'a2-budget', schemaVersion: 1, state: legacy }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.schemaVersion).toBe(2);
    expect(result.state.budget).toEqual({ settings: legacy.settings, months: legacy.months, selectedMonth: legacy.selectedMonth });
    expect(result.summary.personAName).toBe('Personne A');
    expect(result.summary.taskCount).toBe(0);
  });
  it('round-trips the full V2 state including chores and forest', () => {
    const app = emptyAppState();
    app.chores.tasks.push(createTask({ id: 'task', title: 'Aspirateur', assignee: 'a', recurrence: 'weekly', weeklyDay: 5 }, '2026-10-02'));
    const result = parseImportJson(buildExportJson(app));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(app);
    expect(result.summary.taskCount).toBe(1);
  });
  it('rejects malformed data and unsupported envelope versions without accepting an inner V2', () => {
    expect(parseImportJson('{')).toEqual({ ok: false, reason: 'invalid-json' });
    expect(parseImportJson(JSON.stringify({ app: 'a2-budget', schemaVersion: 99, state: emptyAppState() }))).toEqual({ ok: false, reason: 'unsupported-version' });
  });
  it('rejects mismatched schema versions and another application', () => {
    expect(parseImportJson(JSON.stringify({ app: 'a2-budget', schemaVersion: 1, state: emptyAppState() }))).toEqual({ ok: false, reason: 'version-mismatch' });
    expect(parseImportJson(JSON.stringify({ app: 'other', schemaVersion: 2, state: emptyAppState() }))).toEqual({ ok: false, reason: 'unexpected-app' });
  });
});
