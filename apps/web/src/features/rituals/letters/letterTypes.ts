/**
 * Lettres du cercle (V5.2) : contrat du canal « lu » (sans Firebase).
 *
 * La marque de lecture est l'heure (`heldAt`) de la dernière lettre lue,
 * gardée dans `memberState/{mon rôle}.circleSeen` : partagée entre mes
 * appareils, écrite par moi seul (règles). Le « non lu » se déduit des
 * parts du cercle elles-mêmes (core : unreadLetter).
 */
export interface LetterChannel {
  /** Ma marque de lecture (null : jamais rien lu), à chaque changement. */
  watchSeen(listener: (seen: string | null) => void): () => void;
  /** Lettre lue jusqu'à `mark` (fusion dans ma fiche, jamais en arrière côté appelant). */
  markSeen(mark: string): void;
  dispose(): void;
}

/** Champ de `memberState/{rôle}`. */
export const SEEN_FIELD = 'circleSeen';
