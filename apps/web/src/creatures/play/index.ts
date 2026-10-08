/**
 * Jeu des Noiraudes : bocal de kompeitō et compteur « Noiraudes
 * attrapées », isolés de l'AppState derrière `PlayBackend` (stockage local
 * aujourd'hui, état partagé synchronisé plus tard). Voir store.ts.
 */
export { CATCH_GIFT, GOLDEN_GIFT, START_JAR, applyGesture, canSpend, parsePlay, type GiveCause, type PlayGesture, type PlayState } from './play';
export {
  getPlay,
  localPlayBackend,
  playCatch,
  playGive,
  playSpend,
  setPlayBackend,
  subscribePlay,
  usePlay,
  type PlayBackend,
} from './store';
