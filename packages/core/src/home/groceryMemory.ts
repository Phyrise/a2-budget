/**
 * Mémoire des rayons (V4) : quand on corrige le rayon d'un article, les
 * prochains ajouts du même libellé (même `groceryKey` : accents, casse,
 * pluriels simples ignorés) vont dans ce rayon. Fonctions pures.
 */

import { groceryKey, isGroceryCategory } from './groceries.js';
import type { GroceryCategory, GroceryCategoryMemory } from './types.js';
import { isPlainObject, type Fail, type Ok } from './validationHelpers.js';

/** Nombre maximal d'entrées gardées (les plus anciennes sont oubliées). */
export const GROCERY_MEMORY_MAX = 500;

function bounded(entries: Array<[string, GroceryCategory]>): GroceryCategoryMemory {
  return Object.fromEntries(entries.slice(-GROCERY_MEMORY_MAX)) as GroceryCategoryMemory;
}

/**
 * Mémorise le rayon choisi pour ce libellé. L'entrée passe en dernière
 * position (la plus récente) ; au-delà de GROCERY_MEMORY_MAX, les plus
 * anciennes sont oubliées. Déjà mémorisé à l'identique, libellé vide ou
 * rayon inconnu → même référence.
 */
export function rememberGroceryCategory(
  memory: GroceryCategoryMemory | undefined,
  label: string,
  category: GroceryCategory,
): GroceryCategoryMemory | undefined {
  const key = groceryKey(label);
  if (key === '' || !isGroceryCategory(category)) return memory;
  if (memory !== undefined && Object.hasOwn(memory, key) && memory[key] === category) return memory;
  const entries = Object.entries(memory ?? {}).filter(([k]) => k !== key);
  entries.push([key, category]);
  return bounded(entries);
}

/** Oublie le rayon mémorisé (retour au rayon automatique). Absent → même référence. */
export function forgetGroceryCategory(
  memory: GroceryCategoryMemory | undefined,
  label: string,
): GroceryCategoryMemory | undefined {
  const key = groceryKey(label);
  if (memory === undefined || !Object.hasOwn(memory, key)) return memory;
  return bounded(Object.entries(memory).filter(([k]) => k !== key));
}

/**
 * Validation (présente → stricte sur les types) : objet clé non vide →
 * rayon connu. Au-delà de GROCERY_MEMORY_MAX entrées, les plus anciennes
 * sont oubliées (jamais une raison de rendre les données illisibles).
 */
export function validateGroceryMemory(value: unknown): Ok<GroceryCategoryMemory> | Fail {
  if (!isPlainObject(value)) return { ok: false, reason: 'grocery-memory-not-object' };
  const entries: Array<[string, GroceryCategory]> = [];
  for (const [key, category] of Object.entries(value)) {
    if (key === '') return { ok: false, reason: 'grocery-memory-invalid-key' };
    if (!isGroceryCategory(category)) return { ok: false, reason: 'grocery-memory-invalid-category' };
    entries.push([key, category]);
  }
  return { ok: true, state: bounded(entries) };
}
