/**
 * Petits sons de la forêt (V3.1) — légers, courts, entièrement générés en
 * WebAudio, déclenchés par les transitions d'état faites pendant la session
 * (tâche faite, corvée, annulation, « pas aujourd'hui », créature
 * rencontrée, forêt qui grandit, gardien, cercle, lanterne).
 *
 * Contrat :
 * - `useSoundEvents()` : hook monté UNE fois par la coquille (App), qui
 *   observe l'AppState (useApp) et joue les sons ; ne rend rien.
 * - `<SoundSetting />` : ligne de réglage « Petits sons » (interrupteur +
 *   « Écouter ») à placer dans les Réglages.
 * - `soundEngine` : accès direct (unlock dans un geste, play d'un son).
 */
export { useSoundEvents } from './useSoundEvents';
export { SoundSetting } from './SoundSetting';
export { soundEngine } from './engine';
export type { SoundCue, SoundVoice } from './cues';
