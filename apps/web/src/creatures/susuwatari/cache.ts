/**
 * Cache des sprites d'un calque (sprites.ts), invalidé par une clé de
 * paramètres (`spriteKey`) : quand l'apparence change (curseurs du Labo),
 * tous les sprites sont reconstruits, pas à pas, et les anciens restent
 * affichés en attendant (jamais de Noiraude qui disparaît).
 *
 * Rayons regroupés par paliers de 20 %, construits au-dessus du besoin :
 * l'affichage réduit un sprite (17 % au plus), ne l'agrandit jamais.
 */
import { spriteKey, type SootSpriteParams } from './params';
import { buildSteps, releaseCanvases, spriteCanvases, type BodySprites } from './sprites';

/**
 * Palier de rayon (20 %) : un rayon voulu → rayon du sprite à construire,
 * toujours au-dessus (l'affichage ne fait que réduire, de 17 % au plus :
 * le trait reste net).
 */
export function bucketRadius(radius: number): number {
  const k = Math.ceil(Math.log(Math.max(4, radius)) / Math.log(1.2) - 1e-9);
  return Math.ceil(Math.pow(1.2, k));
}

/**
 * Budget de reconstruction PARTAGÉ par tous les calques d'une même image
 * (le Labo en a trois) : pendant un glissé de curseur, la page entière ne
 * peint pas plus de REBUILD_BUDGET_MS de sprites par image.
 */
const REBUILD_BUDGET_MS = 9;
const shared = { frame: -1, spent: 0 };

interface Job {
  key: string;
  steps: Generator<void, BodySprites, void>;
  /** Toiles déjà peintes par ce chantier (libérées s'il est abandonné). */
  made: HTMLCanvasElement[];
}

/**
 * `get` rend le meilleur sprite DISPONIBLE (le palier exact, sinon le plus
 * proche déjà construit, sinon celui des anciens paramètres) et met le palier
 * manquant en chantier ; `pump` avance les chantiers dans un budget de temps
 * (au moins une toile par appel).
 */
export class SpriteCache {
  private sets = new Map<string, BodySprites>();
  /** Sprites des paramètres précédents, affichés pendant la reconstruction. */
  private stale = new Map<string, BodySprites>();
  private jobs: Job[] = [];
  private used = new Map<string, number>();
  private key: string;
  /** Dernier instant (performance.now) où une toile a été peinte. */
  builtAt = 0;

  constructor(
    private rim: number,
    private params: SootSpriteParams,
  ) {
    this.key = spriteKey(params);
  }

  /** Clé des paramètres des sprites en cours (tests, Labo). */
  get paramsKey(): string {
    return this.key;
  }

  /** Sprites encore à peindre. */
  get pending(): number {
    return this.jobs.length;
  }

  /** Vrai tant que des sprites des anciens paramètres attendent leur remplaçant. */
  get rebuilding(): boolean {
    return this.stale.size > 0;
  }

  setRim(rim: number): void {
    if (rim === this.rim) return;
    this.rim = rim;
    this.invalidate();
  }

  setParams(params: SootSpriteParams): void {
    this.params = params;
    const key = spriteKey(params);
    if (key === this.key) return;
    this.key = key;
    this.invalidate();
  }

  private invalidate(): void {
    for (const [k, set] of this.sets) {
      const old = this.stale.get(k);
      if (old) releaseCanvases(spriteCanvases(old));
      this.stale.set(k, set);
    }
    this.sets.clear();
    for (const job of this.jobs) releaseCanvases(job.made);
    this.jobs = [];
  }

  private dropStale(key?: string): void {
    for (const [k, set] of this.stale) {
      if (key !== undefined && k !== key) continue;
      releaseCanvases(spriteCanvases(set));
      this.stale.delete(k);
    }
  }

  get(variant: number, radius: number, now: number): BodySprites | null {
    const r = bucketRadius(radius);
    const key = `${variant}:${r}`;
    const hit = this.sets.get(key);
    this.used.set(key, now);
    if (hit) return hit;
    if (!this.jobs.some((j) => j.key === key)) {
      const made: HTMLCanvasElement[] = [];
      this.jobs.push({ key, steps: buildSteps(variant, r, this.rim, this.params, made), made });
    }
    // En attendant : l'ancien sprite de ce palier, sinon le palier le plus
    // proche de la même variante (nouveaux paramètres d'abord).
    const old = this.stale.get(key);
    if (old) return old;
    return nearest(this.sets, variant, r) ?? nearest(this.stale, variant, r);
  }

  private advance(job: Job): boolean {
    const step = job.steps.next();
    this.builtAt = performance.now();
    if (!step.done) return false;
    this.sets.set(job.key, step.value);
    this.dropStale(job.key);
    this.jobs.splice(this.jobs.indexOf(job), 1);
    if (this.jobs.length === 0) this.dropStale();
    return true;
  }

  /**
   * Avance les chantiers tant que le budget (ms) le permet, au moins d'une
   * toile. Pendant une reconstruction (`frame` : horodatage de l'image), le
   * budget est plus large mais partagé entre les calques de cette image.
   */
  pump(budgetMs: number, now: number, frame = -1): void {
    const start = performance.now();
    let budget = budgetMs;
    const rebuilding = this.stale.size > 0;
    if (rebuilding) {
      if (shared.frame !== frame) {
        shared.frame = frame;
        shared.spent = 0;
      }
      budget = Math.max(0, REBUILD_BUDGET_MS - shared.spent);
    }
    while (this.jobs.length > 0) {
      this.advance(this.jobs[0]!);
      if (performance.now() - start > budget) break;
    }
    if (rebuilding) shared.spent += performance.now() - start;
    // Les paliers oubliés depuis 10 s (curseur de taille) sont libérés.
    if (this.sets.size > 16) {
      for (const [key, at] of this.used) {
        const set = this.sets.get(key);
        if (now - at <= 10 || !set) continue;
        releaseCanvases(spriteCanvases(set));
        this.sets.delete(key);
        this.used.delete(key);
      }
    }
  }

  /** Libère toutes les toiles (calque détruit). */
  dispose(): void {
    for (const set of this.sets.values()) releaseCanvases(spriteCanvases(set));
    this.sets.clear();
    this.dropStale();
    for (const job of this.jobs) releaseCanvases(job.made);
    this.jobs = [];
  }

  /** Premier affichage d'une variante : construite tout de suite (sinon le palier voisin sert). */
  warm(variant: number, radius: number, now: number): void {
    if (this.get(variant, radius, now) !== null) return;
    const key = `${variant}:${bucketRadius(radius)}`;
    const job = this.jobs.find((j) => j.key === key);
    if (job) while (!this.advance(job));
  }
}

function nearest(sets: Map<string, BodySprites>, variant: number, r: number): BodySprites | null {
  let best: BodySprites | null = null;
  for (const [k, set] of sets) {
    if (!k.startsWith(`${variant}:`)) continue;
    if (best === null || Math.abs(set.radius - r) < Math.abs(best.radius - r)) best = set;
  }
  return best;
}
