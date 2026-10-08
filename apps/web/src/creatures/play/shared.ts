/**
 * Bocal de kompeitō et compteur de Noiraudes PARTAGÉS (V5.1, mode connecté).
 *
 * Chaque rôle a son document `play/{rôle}` { given, spent, caught, golden },
 * jamais en baisse, écrit en incréments par ses propres gestes seulement :
 *   bocal = 20 + Σ given − Σ spent (jamais sous zéro), Noiraudes = Σ caught.
 * Un geste vu arriver de l'autre téléphone n'est jamais recompté : le
 * magasin (store.ts) ne confie au backend que les gestes faits ici, et
 * l'état reçu remplace seulement l'affichage.
 *
 * Migration unique : l'état local d'avant devient les compteurs du rôle
 * (au-dessus de 20 : donnés ; en dessous : dépensés).
 */
import type { LiveChannel, PlayCounts, PlayDocs } from '../../presence/liveTypes';
import { CATCH_GIFT, GOLDEN_GIFT, START_JAR, type PlayGesture, type PlayState } from './play';
import type { PlayBackend } from './store';

const ZERO: PlayCounts = { given: 0, spent: 0, caught: 0, golden: 0 };

/** État affiché : somme des deux documents. */
export function sharedPlayState(docs: PlayDocs): PlayState {
  const all = [docs.a ?? ZERO, docs.b ?? ZERO];
  const sum = (f: keyof PlayCounts) => all.reduce((t, d) => t + d[f], 0);
  return { jar: Math.max(0, START_JAR + sum('given') - sum('spent')), caught: sum('caught'), golden: sum('golden') };
}

/** Un geste fait ici → incréments de MES compteurs. */
export function gestureDelta(g: PlayGesture): Partial<PlayCounts> {
  switch (g.kind) {
    case 'give':
      return g.n > 0 ? { given: Math.floor(g.n) } : {};
    case 'spend':
      return g.n > 0 ? { spent: Math.floor(g.n) } : {};
    case 'catch':
      return { given: g.golden ? GOLDEN_GIFT : CATCH_GIFT, caught: 1, golden: g.golden ? 1 : 0 };
  }
}

/** L'état local d'avant, en compteurs du rôle (migration unique). */
export function migrationCounts(local: PlayState | null): PlayCounts {
  if (local === null) return { ...ZERO };
  return {
    given: Math.max(0, local.jar - START_JAR),
    spent: Math.max(0, START_JAR - local.jar),
    caught: local.caught,
    golden: local.golden,
  };
}

/** Il reste à migrer : le serveur a confirmé que MON document n'est pas marqué. */
export function needsMigration(docs: PlayDocs, role: 'a' | 'b', confirmed: boolean): boolean {
  return confirmed && docs[role]?.migrated !== true;
}

/**
 * Backend partagé du magasin. `local` : l'état local d'avant (affiché tant
 * que rien n'est reçu, migré une fois).
 */
export function sharedPlayBackend(channel: LiveChannel, local: PlayState | null): PlayBackend {
  let latest: PlayState | null = null;
  let migrating = false;
  return {
    load: () => latest ?? local,
    record(gesture) {
      channel.addPlay(gestureDelta(gesture));
    },
    subscribe(onState) {
      return channel.watchPlay((docs, confirmed) => {
        if (needsMigration(docs, channel.role, confirmed) && !migrating) {
          migrating = true;
          // Échec (hors ligne) : on réessaiera à la prochaine confirmation.
          channel.migratePlay(migrationCounts(local)).catch(() => {
            migrating = false;
          });
        }
        // Avant la migration, mon document ne contient pas encore l'état d'avant.
        const mine = docs[channel.role];
        const shown = mine?.migrated === true ? docs : { ...docs, [channel.role]: sumCounts(mine, migrationCounts(local)) };
        latest = sharedPlayState(shown);
        onState(latest);
      });
    },
  };
}

function sumCounts(x: PlayCounts | undefined, y: PlayCounts): PlayCounts & { migrated: boolean } {
  const a = x ?? ZERO;
  return { given: a.given + y.given, spent: a.spent + y.spent, caught: a.caught + y.caught, golden: a.golden + y.golden, migrated: false };
}
