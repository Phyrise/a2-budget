/**
 * Mémoires locales liées aux données (mode développeur, « Tout remettre à
 * zéro ») : quêtes déjà vues ou récompensées, bocal local et son ancien
 * compteur, marques « lu » des lettres. Les préférences
 * (interface, sons, compte, saisons) et les copies de sécurité restent.
 * Jamais `localStorage.clear()`.
 */
import { reloadPlay } from '../creatures/play';
import { questMemory } from '../features/quests/questMemory';
import { forgetLocalSeen } from '../features/rituals/letters/letterStore';

export const DATA_MEMORY_KEYS = [
  'a2-budget:quests:v1',
  'a2-budget:play:v1',
  'a2-budget:susuwatari:v1',
] as const;

export function wipeLocalMemories(storage: Pick<Storage, 'removeItem'> | null = safeStorage()): void {
  for (const key of DATA_MEMORY_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      // stockage indisponible : rien à effacer
    }
  }
  forgetLocalSeen();
  questMemory.reset();
  reloadPlay();
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
