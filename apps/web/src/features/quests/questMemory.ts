/**
 * Mémoire LOCALE des quêtes (ce téléphone) : quelles fêtes ont déjà été
 * vues, quelles récompenses déjà données. Clé dédiée, lecture et écriture
 * protégées (sans stockage : vaut pour la session). Jamais dans l'AppState :
 * chacun reçoit SES +3 kompeitō dans son bocal, une fois par quête, sur
 * l'appareil où il a aidé (bocal partagé : son téléphone et son ordinateur
 * ne la comptent pas deux fois).
 */
const KEY = 'a2-budget:quests:v1';
const KEEP = 60;

interface Memory {
  shown: string[];
  rewarded: string[];
  helped: string[];
}

let memory: Memory | null = null;

function read(): Memory {
  if (memory !== null) return memory;
  memory = { shown: [], rewarded: [], helped: [] };
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<Memory> | null;
    if (raw && Array.isArray(raw.shown)) memory.shown = raw.shown.filter((x) => typeof x === 'string');
    if (raw && Array.isArray(raw.rewarded)) memory.rewarded = raw.rewarded.filter((x) => typeof x === 'string');
    if (raw && Array.isArray(raw.helped)) memory.helped = raw.helped.filter((x) => typeof x === 'string');
  } catch {
    // Stockage indisponible ou abîmé : on repart de rien.
  }
  return memory;
}

function write(next: Memory): void {
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : vaut pour la session.
  }
}

function mark(list: 'shown' | 'rewarded' | 'helped', id: string): boolean {
  const m = read();
  if (m[list].includes(id)) return false;
  write({ ...m, [list]: [...m[list], id].slice(-KEEP) });
  return true;
}

export const questMemory = {
  wasShown: (id: string) => read().shown.includes(id),
  markShown: (id: string) => mark('shown', id),
  /** Ce téléphone a posé une aide sur cette quête. */
  markHelped: (id: string) => mark('helped', id),
  /** Vrai la première fois seulement, et seulement là où l'on a aidé (la récompense part alors). */
  claimReward: (id: string) => read().helped.includes(id) && mark('rewarded', id),
  /** Tests. */
  reset: () => {
    memory = null;
  },
};
