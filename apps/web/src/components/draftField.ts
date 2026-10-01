import { useState } from 'react';

/**
 * Chaîne d'édition locale au composant, séparée de la valeur validée.
 *
 * Règles (docs/SPEC.md, « Saisie des montants ») :
 * - `draft === null` → le champ n'est pas en édition : on affiche la valeur
 *   formatée (`displayValue`, ex. « 1 234,56 € »).
 * - Au focus, la chaîne d'édition démarre sur la notation plate de la valeur
 *   validée (`plainValue`, ex. « 1234,56 ») : curseur, focus et dernière
 *   valeur enregistrée sont préservés.
 * - À chaque frappe, `parse` tranche : valide → commit ; invalide → message
 *   local (ou rien pour un état transitoire comme « 12, ») et AUCUN
 *   changement d'état ; champ vide ≠ 0 (pas de commit, pas d'erreur).
 * - Au blur, si la chaîne finale est vide ou invalide, l'affichage revient à
 *   la dernière valeur enregistrée (l'erreur locale reste visible).
 */

export type DraftParseResult =
  | { ok: true; commit: () => void }
  | { ok: false; kind: 'empty' | 'transient' | 'error'; message?: string };

export interface DraftField {
  /** Chaîne affichée dans le champ (draft en édition, sinon valeur formatée). */
  value: string;
  /** Message d'erreur local, ou null. */
  error: string | null;
  editing: boolean;
  onFocus: () => void;
  onChange: (raw: string) => void;
  onBlur: () => void;
}

export function useDraftField(options: {
  /** Notation plate de la valeur validée (point de départ de l'édition). */
  plainValue: string;
  /** Valeur formatée affichée hors édition. */
  displayValue: string;
  /** Analyse d'une chaîne ; `final` = true au blur (pas d'état transitoire). */
  parse: (raw: string, final: boolean) => DraftParseResult;
  /** Validité de la saisie, conservée au blur même si l'affichage est rétabli. */
  onValidityChange?: (valid: boolean) => void;
}): DraftField {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFocus = () => {
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
    if (draft === null) {
      return;
    }
    const result = options.parse(draft, true);
    options.onValidityChange?.(result.ok);
    if (result.ok) {
      // Ne re-commit que si la valeur a réellement changé (évite une
      // sauvegarde à un simple focus/blur sans frappe).
      if (draft !== options.plainValue) {
        result.commit();
      }
      setError(null);
    } else if (result.kind === 'empty') {
      // Champ vidé : on revient à la dernière valeur enregistrée, sans erreur.
      setError(null);
    } else {
      // Une saisie transitoire pendant la frappe doit être signalée au blur.
      setError(result.message ?? 'Saisie invalide.');
    }
    // Valeur finale invalide : le message local reste, l'affichage revient à
    // la dernière valeur enregistrée.
    setDraft(null);
  };

  return {
    value: draft ?? options.displayValue,
    error,
    editing: draft !== null,
    onFocus,
    onChange,
    onBlur,
  };
}
