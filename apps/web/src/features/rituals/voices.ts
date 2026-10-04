/**
 * Les mots des compagnons pour les rituels. Jiji (AL) : pince-sans-rire,
 * élégant. Calcifer (AC) : grognon, dramatique, attachant. Jamais de
 * reproche, jamais de comparaison.
 */
import { NB, capitalizeFirst, durationWords } from './ritualText';

function pick<T>(list: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length]!;
}

export function lanternDoneLine(who: 'a' | 'b' | 'both', minutes: number, completed: boolean, seed: string): string {
  const d = durationWords(minutes);
  if (!completed) {
    const soft = {
      a: [`S’arrêter à temps est une forme d’élégance.`, `${capitalizeFirst(d)}. C’est noté, avec respect.`],
      b: [`${capitalizeFirst(d)}${NB}! Chaque minute compte, et celles-là comptent double.`, `Pff. Moi aussi je fais des pauses. Souvent.`],
      both: [`${capitalizeFirst(d)} à deux${NB}: la forêt a tout vu, et elle a aimé.`],
    } as const;
    return pick(soft[who], seed);
  }
  const lines = {
    a: [
      `Impeccable. Je n’en attendais pas moins.`,
      `${capitalizeFirst(d)} sans un faux pas. Élégant.`,
      `Voilà qui est fait — avec style, évidemment.`,
    ],
    b: [
      `${capitalizeFirst(d)} entières${NB}! Je brûle de fierté${NB}!`,
      `Jusqu’au bout${NB}! Je ne pleure pas, c’est la fumée.`,
      `Quelle flamme${NB}! Même moi, je suis impressionné.`,
    ],
    both: [
      `Jiji hoche la tête, Calcifer crépite${NB}: ${d} à deux, quelle belle lumière.`,
      `Ensemble, ${d}. La clairière en est toute dorée.`,
    ],
  } as const;
  return pick(lines[who], seed);
}

export function circleClosingLine(seed: string): { a: string; b: string } {
  return {
    a: pick([`Joli cercle. Je reste assis ici, par pure élégance.`, `C’était parfait. Enfin, presque autant que moi.`], seed),
    b: pick([`Tous ces mercis${NB}! Je crépite de partout${NB}!`, `Bon. J’ai peut-être une braise dans l’œil.`], seed + 'b'),
  };
}
