/**
 * V5.10 — textes du toast « Fait par toi » (correction de qui l'a fait).
 * « toi » = le compte connecté ; en invité, les prénoms. Les choix sont les
 * AUTRES personnes : soi d'abord, puis l'autre, puis « Ensemble ». Pur.
 */
import type { ChoreDoer } from '@a2/core';

export type Names = { a: string; b: string };
export type DoneSubject = 'task' | 'groceries';

export interface DoneChoice {
  who: ChoreDoer;
  label: string;
  ariaLabel: string;
}

/** « Fait par toi », « Fait par AC », « Fait ensemble » ; « Courses faites … ». */
export function doneMessage(who: ChoreDoer, me: 'a' | 'b' | null, names: Names, subject: DoneSubject = 'task'): string {
  const head = subject === 'groceries' ? 'Courses faites' : 'Fait';
  if (who === 'both') return `${head} ensemble`;
  return `${head} par ${who === me ? 'toi' : names[who]}`;
}

/** Les corrections possibles : « C’était moi », « C’était AC », « Ensemble ». */
export function otherChoices(who: ChoreDoer, me: 'a' | 'b' | null, names: Names): DoneChoice[] {
  const people: ChoreDoer[] = me === 'b' ? ['b', 'a', 'both'] : ['a', 'b', 'both'];
  return people
    .filter((x) => x !== who)
    .map((x) => {
      if (x === 'both') return { who: x, label: 'Ensemble', ariaLabel: 'C’était ensemble' };
      if (x === me) return { who: x, label: 'C’était moi', ariaLabel: 'C’est moi qui l’ai fait' };
      return { who: x, label: `C’était ${names[x]}`, ariaLabel: `C’est ${names[x]} qui l’a fait` };
    });
}
