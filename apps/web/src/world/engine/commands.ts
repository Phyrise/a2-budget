/**
 * Commandes du moteur qui touchent plusieurs systèmes : envol d'une lumière
 * (pulse), gardien, lanterne de pierre choisie.
 */
import type { PulseOptions } from '../types';
import type { WorldEngine } from './Engine';
import { now } from './Engine';
import { pulseStart } from './pulse';

/**
 * Envol d'une lumière depuis la case cochée jusqu'à son ancre. Le vol se joue
 * même si la coquille vient de figer la scène (`live: false` : feuille
 * ouverte, liste défilée qui recouvre la forêt) : il la réveille jusqu'à
 * l'atterrissage (Engine.animated). Seuls le bandeau et le mouvement
 * « immobile » posent la lumière sans vol (fondu). Un vol réservé dont la
 * tâche a été annulée entre-temps ne part pas (DayLights.takeCancelled).
 */
export function pulseLight(e: WorldEngine, opts: PulseOptions) {
  e.lights.unreserve(opts.id);
  // Tâche annulée pendant que la feuille se fermait : aucune lumière.
  if (e.lights.takeCancelled(opts.id)) return;
  const from = pulseStart(e.canvas, e.framing, opts.fromClientX, opts.fromClientY);
  const n = now();
  if (e.canFly) e.lights.pulse(opts.id, opts.who, from, n, opts.strong === true);
  else e.lights.sync([...(e.state?.lights ?? []).filter((l) => l.id !== opts.id), { id: opts.id, who: opts.who }], n, e.cfg.motion === 'still');
  e.requestFrame(true);
}

/** Délai maximal d'attente d'un vol réservé (s) : au-delà, la lumière est posée. */
const RESERVE_S = 2.5;

/**
 * Cochée depuis une feuille : le vol partira à sa fermeture. D'ici là, la
 * lumière n'apparaît pas à son ancre (DayLights.reserve). Filet : si le vol
 * n'arrive jamais (écran quitté), la lumière est posée en fondu.
 */
export function expectPulse(e: WorldEngine, id: string) {
  e.lights.reserve(id, now() + RESERVE_S);
  window.setTimeout(() => {
    if (e.isDestroyed || !e.lights.unreserve(id)) return;
    e.lights.sync(e.state?.lights ?? [], now(), true);
    e.requestFrame(true);
  }, RESERVE_S * 1000 + 100);
}

export function playGuardian(e: WorldEngine) {
  const n = now();
  e.spirits.startGuardian(n);
  const url = e.cfg.manifest.sprites.guardian;
  if (url && !e.spirits.guardian) {
    void e.res.sprite(url).then((a) => {
      if (a && !e.isDestroyed) e.spirits.guardian = a;
    });
  }
  e.requestFrame(true);
}

/** Libère le sprite du gardien une fois la séquence terminée. */
export function releaseGuardian(e: WorldEngine) {
  if (e.spirits.guardian) {
    e.res.free(e.spirits.guardian.tex);
    e.spirits.guardian = null;
  }
}

/** Pose la lanterne de pierre de l'état (modèle choisi ; défaut kasuga-moss). */
export function syncLantern(e: WorldEngine) {
  void e.stone.want(e.state?.lantern?.id, now).then((changed) => {
    if (e.isDestroyed) return;
    // Peintures introuvables (hors ligne, fichier manquant) : la lanterne de papier procédurale sert de repli.
    e.lantern.painted = e.stone.model !== null;
    if (!changed) return;
    e.lantern.geo = e.stone.geometry();
    e.requestFrame(true);
  });
}
