/**
 * Petits prédicats de validation partagés (appState, rituels, lanternes).
 */

import { isValidLocalDateKey } from './dates.js';

export type Ok<T> = { ok: true; state: T };
export type Fail = { ok: false; reason: string };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIntInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Horodatage ISO 8601 complet et valide (ex. new Date().toISOString()). */
export function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP_RE.test(value) &&
    isValidLocalDateKey(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** 'a' ou 'b'. */
export function isPerson(value: unknown): value is 'a' | 'b' {
  return value === 'a' || value === 'b';
}

/** 'a', 'b' ou 'both' (qui a fait). */
export function isDoer(value: unknown): value is 'a' | 'b' | 'both' {
  return value === 'a' || value === 'b' || value === 'both';
}
