/**
 * Choix de l'accueil, mémorisé sur le téléphone (V5) : « Se connecter avec
 * Google » ou « Continuer en invité ». Préférence d'interface locale, sous une
 * clé dédiée `a2-budget:account:v1` (comme `a2-budget:sound:v1` : la clé
 * `a2-budget:ui:v1` est réécrite en entier par la coquille). Jamais
 * synchronisée, jamais mêlée aux données (`a2-budget:state:v1`).
 *
 * Lecture et écriture protégées : sans stockage, l'accueil revient à chaque
 * ouverture et l'app fonctionne quand même.
 */

export type AccountEntry = 'guest' | 'google';

export const ACCOUNT_KEY = 'a2-budget:account:v1';

interface StoredChoice {
  entry: AccountEntry;
}

export function parseEntry(raw: string | null): AccountEntry | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredChoice> | null;
    return value?.entry === 'guest' || value?.entry === 'google' ? value.entry : null;
  } catch {
    return null;
  }
}

export function readEntry(): AccountEntry | null {
  try {
    return parseEntry(window.localStorage.getItem(ACCOUNT_KEY));
  } catch {
    return null;
  }
}

/** null efface le choix : l'accueil reviendra à la prochaine ouverture. */
export function writeEntry(entry: AccountEntry | null): void {
  try {
    if (entry === null) window.localStorage.removeItem(ACCOUNT_KEY);
    else window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ entry } satisfies StoredChoice));
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite.
  }
}
