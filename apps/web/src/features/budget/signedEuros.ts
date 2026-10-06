/**
 * Solde saisi pour « Recaler sur le compte » : euros entiers, signe permis
 * (« −120 », « - 1 200 € »). `parseEurosInput` (@a2/core) tranche sur le
 * montant ; seul le signe est lu ici (présentation, aucun calcul).
 */
import { parseEurosInput, type ParseEurosResult } from '@a2/core';

type Reason = Extract<ParseEurosResult, { ok: false }>['reason'];

export function parseSignedEuros(raw: string): { ok: true; euros: number } | { ok: false; reason: Reason } {
  const text = raw.trim();
  const negative = /^[-−–]/u.test(text);
  const result = parseEurosInput(negative ? text.slice(1) : text);
  if (!result.ok) return { ok: false, reason: result.reason };
  const euros = result.cents / 100;
  return { ok: true, euros: negative && euros !== 0 ? -euros : euros };
}
