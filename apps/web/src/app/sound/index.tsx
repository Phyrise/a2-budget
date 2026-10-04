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
 * - `playCue(cue)` : un son joué par un écran, à travers la même porte
 *   anti-rafale que la coquille (jamais `soundEngine.play` directement).
 * - `soundEngine` : accès direct (unlock dans un geste, « Écouter »).
 */
export { useSoundEvents } from './useSoundEvents';
export { SoundSetting } from './SoundSetting';
export { playCue } from './play';
export { soundEngine } from './engine';
export type { SoundCue, SoundVoice } from './cues';
