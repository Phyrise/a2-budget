/**
 * Les mots des compagnons pour les rituels. Jiji : pince-sans-rire, élégant.
 * Calcifer : grognon, dramatique, attachant. Teto : sauvage, sec, confiant
 * à petits pas. Hin : vieux chien las, tendre dessous. Jamais de reproche,
 * jamais de comparaison.
 *
 * V5.6 : chacun parle avec la voix du compagnon CHOISI (`companions`, par
 * défaut ceux du rôle : Jiji pour AL, Calcifer pour AC).
 */
import { defaultCompanion, type CompanionId, type CompanionRole } from '@a2/core';
import { companionProfile } from '../../ui/companions';
import { NB, capitalizeFirst, durationWords } from './ritualText';

export type RitualCompanions = Record<CompanionRole, CompanionId>;
const DEFAULTS: RitualCompanions = { a: defaultCompanion('a'), b: defaultCompanion('b') };

function pick<T>(list: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length]!;
}

/** Le petit geste propre à chacun (« Jiji hoche la tête »). */
const GESTURE: Record<CompanionId, string> = {
  jiji: 'hoche la tête',
  calcifer: 'crépite',
  teto: 'agite la queue',
  hin: 'soupire',
};

/** « Jiji hoche la tête, Calcifer crépite » avec les compagnons choisis. */
export function companionsGesture(companions: RitualCompanions): string {
  return (['a', 'b'] as const).map((r) => `${companionProfile(companions[r]).name} ${GESTURE[companions[r]]}`).join(', ');
}

function lanternSoft(d: string): Record<CompanionId, readonly string[]> {
  return {
    jiji: [`S’arrêter à temps est une forme d’élégance.`, `${capitalizeFirst(d)}. C’est noté, avec respect.`],
    calcifer: [`${capitalizeFirst(d)}${NB}! Chaque minute compte, et celles-là comptent double.`, `Pff. Moi aussi je fais des pauses. Souvent.`],
    teto: [`Kss. ${capitalizeFirst(d)}. Assez pour flairer le calme.`, `On s’arrête. Les renards aussi savent quand rentrer.`],
    hin: [`Hin. ${capitalizeFirst(d)}. C’est déjà beaucoup.`, `S’arrêter${NB}? Hin hin. Je fais ça très bien, moi aussi.`],
  };
}

function lanternFull(d: string): Record<CompanionId, readonly string[]> {
  return {
    jiji: [
      `Impeccable. Je n’en attendais pas moins.`,
      `${capitalizeFirst(d)} sans un faux pas. Élégant.`,
      `Voilà qui est fait — avec style, évidemment.`,
    ],
    calcifer: [
      `${capitalizeFirst(d)} entières${NB}! Je brûle de fierté${NB}!`,
      `Jusqu’au bout${NB}! Je ne pleure pas, c’est la fumée.`,
      `Quelle flamme${NB}! Même moi, je suis impressionné.`,
    ],
    teto: [
      `${capitalizeFirst(d)}. Pas un bruit. Ma queue s’agite.`,
      `Jusqu’au bout. Kss. Je te fais confiance, maintenant.`,
      `Calme et tenace. Une vraie bête de la forêt.`,
    ],
    hin: [
      `${capitalizeFirst(d)}. Hin. Je n’ai pas fermé l’œil. Presque.`,
      `Jusqu’au bout. Hin hin. Je remue la queue, c’est dire.`,
      `Bien tenu. Je soupire de fierté.`,
    ],
  };
}

export function lanternDoneLine(
  who: 'a' | 'b' | 'both',
  minutes: number,
  completed: boolean,
  seed: string,
  companions: RitualCompanions = DEFAULTS,
): string {
  const d = durationWords(minutes);
  if (!completed) {
    if (who === 'both') return pick([`${capitalizeFirst(d)} à deux${NB}: la forêt a tout vu, et elle a aimé.`], seed);
    return pick(lanternSoft(d)[companions[who]], seed);
  }
  if (who === 'both') {
    return pick(
      [`${companionsGesture(companions)}${NB}: ${d} à deux, quelle belle lumière.`, `Ensemble, ${d}. La clairière en est toute dorée.`],
      seed,
    );
  }
  return pick(lanternFull(d)[companions[who]], seed);
}

const CIRCLE: Record<CompanionId, readonly string[]> = {
  jiji: [`Joli cercle. Je reste assis ici, par pure élégance.`, `C’était parfait. Enfin, presque autant que moi.`],
  calcifer: [`Tous ces mercis${NB}! Je crépite de partout${NB}!`, `Bon. J’ai peut-être une braise dans l’œil.`],
  teto: [`Kss. Je me suis approché tout du long.`, `Tous ces mercis. Je reste. Tout près.`],
  hin: [`Hin. Un bon cercle. Je m’allonge au milieu.`, `Tous ces mercis. Hin hin. Ça me réchauffe les vieux os.`],
};

export function circleClosingLine(seed: string, companions: RitualCompanions = DEFAULTS): { a: string; b: string } {
  return {
    a: pick(CIRCLE[companions.a], seed),
    b: pick(CIRCLE[companions.b], seed + 'b'),
  };
}
