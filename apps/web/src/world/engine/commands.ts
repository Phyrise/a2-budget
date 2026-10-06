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
 * « immobile » posent la lumière sans vol (fondu).
 */
export function pulseLight(e: WorldEngine, opts: PulseOptions) {
  const from = pulseStart(e.canvas, e.framing, opts.fromClientX, opts.fromClientY);
  const n = now();
  if (e.canFly) e.lights.pulse(opts.id, opts.who, from, n, opts.strong === true);
  else e.lights.sync([...(e.state?.lights ?? []).filter((l) => l.id !== opts.id), { id: opts.id, who: opts.who }], n, e.cfg.motion === 'still');
  e.requestFrame(true);
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
