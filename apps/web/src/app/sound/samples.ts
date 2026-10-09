/**
 * Échantillons audio (V5.7) : les seuls vrais fichiers sonores de l'app, à
 * côté des sons synthétisés. Aujourd'hui un seul — le « hin » asthmatique
 * de Hin, extrait du film (samples/hin.mp3 : mono, ≈ 0,3 s, ≈ 4 Ko, rogné,
 * fondus et crête à −1 dBFS ; précaché par le service worker).
 *
 * - Octets récupérés une fois (fetch), dès qu'un Hin est à l'écran
 *   (prefetchSample) ou dès que le contexte audio existe.
 * - Décodés une seule fois par contexte (cache de Promise), dès sa création
 *   (preloadSamples, appelé par le moteur au premier geste) : jamais de son
 *   joué au chargement.
 * - Lecture : AudioBufferSourceNode → gain → route() du bus (même chemin sec
 *   + réverbération courte que les voix synthétisées).
 * - Pas encore décodé au moment du son : on l'attend s'il arrive vite
 *   (≤ 250 ms), sinon on rejoue le son synthétisé d'avant. Rendu hors ligne
 *   (mesures) : repli immédiat si rien n'est décodé.
 * - Ne lève jamais d'erreur : sans fetch, sans décodage, tout retombe sur la
 *   synthèse.
 */
import hinUrl from './samples/hin.mp3?no-inline';
import { route, type Bus } from './synth';

export type SampleId = 'hin';

const URLS: Record<SampleId, string> = { hin: hinUrl };
const SAMPLE_IDS = Object.keys(URLS) as SampleId[];

/** Attente tolérée d'un échantillon pas encore décodé, avant le repli. */
export const SAMPLE_WAIT_MS = 250;

/** Octets bruts (partagés par tous les contextes). */
const bytes = new Map<SampleId, Promise<ArrayBuffer | null>>();
/** Décodage en cours ou fait, par contexte. */
const decoding = new WeakMap<BaseAudioContext, Map<SampleId, Promise<AudioBuffer | null>>>();
/** Tampons décodés, lisibles sans attendre. */
const decoded = new WeakMap<BaseAudioContext, Map<SampleId, AudioBuffer>>();

function fetchBytes(id: SampleId): Promise<ArrayBuffer | null> {
  let p = bytes.get(id);
  if (p === undefined) {
    p = (async () => {
      try {
        if (typeof fetch !== 'function') return null;
        const res = await fetch(URLS[id]);
        return res.ok ? await res.arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    bytes.set(id, p);
    // Échec (hors ligne sans précache…) : on retentera au prochain besoin.
    void p.then((b) => {
      if (b === null) bytes.delete(id);
    });
  }
  return p;
}

/** Récupère les octets d'un échantillon (sans contexte audio, sans son). */
export function prefetchSample(id: SampleId): void {
  void fetchBytes(id);
}

/** decodeAudioData, forme à rappels (vieux Safari) et à Promise ; null en cas d'échec. */
function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise((resolve) => {
    try {
      // Copie : le décodage détache le tampon, les octets servent à d'autres contextes.
      const p = ctx.decodeAudioData(data.slice(0), (b) => resolve(b), () => resolve(null)) as Promise<AudioBuffer> | undefined;
      if (p !== undefined && typeof p.catch === 'function') p.catch(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** Échantillon décodé pour ce contexte (une seule fois ; null s'il est introuvable). */
export function loadSample(ctx: BaseAudioContext, id: SampleId): Promise<AudioBuffer | null> {
  let perCtx = decoding.get(ctx);
  if (perCtx === undefined) {
    perCtx = new Map();
    decoding.set(ctx, perCtx);
  }
  const cached = perCtx.get(id);
  if (cached !== undefined) return cached;
  const p = fetchBytes(id)
    .then((data) => (data === null ? null : decode(ctx, data)))
    .then((buf) => {
      if (buf !== null) {
        let ready = decoded.get(ctx);
        if (ready === undefined) {
          ready = new Map();
          decoded.set(ctx, ready);
        }
        ready.set(id, buf);
      } else {
        perCtx.delete(id);
      }
      return buf;
    });
  perCtx.set(id, p);
  return p;
}

/** Décode tous les échantillons pour ce contexte (sans rien jouer). */
export function preloadSamples(ctx: BaseAudioContext): void {
  for (const id of SAMPLE_IDS) void loadSample(ctx, id);
}

/** Le tampon s'il est déjà décodé pour ce contexte. */
export function sampleReady(ctx: BaseAudioContext, id: SampleId): AudioBuffer | null {
  return decoded.get(ctx)?.get(id) ?? null;
}

export interface SampleOptions {
  /** Gain de la voix (le fichier est à −1 dBFS de crête). */
  gain: number;
  /** Vitesse de lecture : < 1 plus grave et plus lent. */
  rate?: number;
  wet?: number;
}

/** Joue un tampon décodé à l'instant `t` (fondus déjà dans le fichier). */
export function playSample(bus: Bus, buffer: AudioBuffer, t: number, o: SampleOptions): void {
  const { ctx } = bus;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = o.rate ?? 1;
  const out = ctx.createGain();
  out.gain.setValueAtTime(o.gain, t);
  src.connect(out);
  src.start(t);
  route(bus, out, o.wet ?? 0.18, [src], src);
}

function isOffline(ctx: BaseAudioContext): boolean {
  return typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
}

/**
 * Joue `play` avec l'échantillon s'il est décodé ; sinon l'attend
 * ≤ SAMPLE_WAIT_MS, puis rejoue `fallback` (la synthèse) s'il manque encore.
 * Joué en retard, le son part dès que possible, jamais avant `t`.
 */
export function withSample(
  bus: Bus,
  id: SampleId,
  t: number,
  play: (buffer: AudioBuffer, t: number) => void,
  fallback: (t: number) => void,
): void {
  const { ctx } = bus;
  const ready = sampleReady(ctx, id);
  if (ready !== null) {
    play(ready, t);
    return;
  }
  if (isOffline(ctx)) {
    fallback(t);
    return;
  }
  let settled = false;
  const go = (buffer: AudioBuffer | null) => {
    if (settled) return;
    settled = true;
    const now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    const at = Math.max(t, now + 0.015);
    try {
      if (buffer !== null) play(buffer, at);
      else fallback(at);
    } catch {
      /* jamais d'erreur visible pour un son */
    }
  };
  loadSample(ctx, id).then(go, () => go(null));
  setTimeout(() => go(null), SAMPLE_WAIT_MS);
}
