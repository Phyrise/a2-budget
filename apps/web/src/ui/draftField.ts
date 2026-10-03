import { useRef, useState } from 'react';

/**
 * Chaîne d'édition locale au composant, séparée de la valeur validée
 * (logique éprouvée de la V1, docs/SPEC.md « Saisie des montants ») :
 *
 * - `draft === null` → hors édition : on affiche la valeur formatée
 *   (`displayValue`, ex. « 1 234,56 € »).
 * - Au focus, l'édition démarre sur la notation plate de la valeur validée
 *   (`plainValue`, ex. « 1234,56 »).
 * - À chaque frappe, `parse` tranche : valide → commit ; invalide → message
 *   local (rien pour un état transitoire comme « 12, ») et AUCUN changement
 *   d'état ; champ vide ≠ 0 (ni commit, ni erreur).
 * - Au blur, une chaîne finale vide ou invalide rétablit l'affichage de la
 *   dernière valeur enregistrée (l'erreur locale reste visible).
 * - Échap annule l'édition en cours et revient à la valeur enregistrée.
 */

export type DraftParseResult =
  | { ok: true; commit: () => void }
  | { ok: false; kind: 'empty' | 'transient' | 'error'; message?: string };

export interface DraftField {
  value: string;
  error: string | null;
  editing: boolean;
  /** Vrai si la chaîne d'édition diffère de la valeur au moment du focus. */
  dirty: boolean;
  onFocus: () => void;
  onChange: (raw: string) => void;
  onBlur: () => void;
  /** Échap : annule la saisie (la valeur enregistrée reste). */
  cancel: () => void;
}

export function useDraftField(options: {
  plainValue: string;
  displayValue: string;
  parse: (raw: string, final: boolean) => DraftParseResult;
  onValidityChange?: (valid: boolean) => void;
}): DraftField {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Valeur validée au moment du focus : Échap la rétablit.
  const startRef = useRef<string>('');

  const onFocus = () => {
    startRef.current = options.plainValue;
    setDraft(options.plainValue);
    setError(null);
    options.onValidityChange?.(true);
  };

  const onChange = (raw: string) => {
    setDraft(raw);
    const result = options.parse(raw, false);
    options.onValidityChange?.(result.ok);
    if (result.ok) {
      result.commit();
      setError(null);
    } else if (result.kind === 'empty' || result.kind === 'transient') {
      setError(null);
    } else {
      setError(result.message ?? 'Saisie invalide.');
    }
  };

  const onBlur = () => {
    if (draft === null) return;
    const result = options.parse(draft, true);
    options.onValidityChange?.(result.ok);
    if (result.ok) {
      // Ne re-commit que si la chaîne a réellement changé.
      if (draft !== startRef.current) result.commit();
      setError(null);
    } else if (result.kind === 'empty') {
      setError(null);
    } else {
      setError(result.message ?? 'Saisie invalide.');
    }
    setDraft(null);
  };

  const cancel = () => {
    if (draft === null) return;
    const result = options.parse(startRef.current, true);
    if (result.ok) result.commit();
    options.onValidityChange?.(result.ok);
    setError(null);
    setDraft(startRef.current);
  };

  return {
    value: draft ?? options.displayValue,
    error,
    editing: draft !== null,
    dirty: draft !== null && draft !== startRef.current,
    onFocus,
    onChange,
    onBlur,
    cancel,
  };
}
