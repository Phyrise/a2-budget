/**
 * STUB — remplacé par l'agent SONS (V3.1). Petits sons de la forêt, déclenchés
 * par les transitions d'état (tâche faite, créature rencontrée, croissance…).
 *
 * Contrat :
 * - `useSoundEvents()` : hook monté UNE fois par la coquille (App), qui observe
 *   l'AppState (useApp) et joue les sons ; ne rend rien.
 * - `<SoundSetting />` : ligne de réglage « Sons » placée dans les Réglages.
 */
export function useSoundEvents(): void {}

export function SoundSetting() {
  return null;
}
