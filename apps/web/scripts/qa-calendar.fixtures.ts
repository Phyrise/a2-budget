/**
 * Fixtures de la QA Calendrier (servies par Vite, construites par @a2/core) :
 * une semaine bien remplie autour d'aujourd'hui (apéro ce soir, livraison
 * demain, ciné, dîner du samedi avec trois autres moments le même jour),
 * l'anniversaire de Calcifer (année connue → âge), celui de Léa (année
 * inconnue → pas d'âge), un rendez-vous, un week-end, un annuel « Notre
 * rencontre » et un concert le mois prochain. Vérifiées par validateAppState.
 */
import { addDays, addEvent, emptyAppState, localDateKey, validateAppState, type AppState, type CalendarEvent, type CalendarEventDraft } from '@a2/core';

let seq = 0;

function build(): AppState {
  const now = new Date();
  const day = (delta: number) => localDateKey(addDays(now, delta));
  const withYear = (delta: number, year: number) => `${year}${day(delta).slice(4)}`;
  const createdAt = now.toISOString();
  const drafts: CalendarEventDraft[] = [
    { title: 'Apéro avec Inès', date: day(0), time: '19:30', kind: 'repas', who: 'both', place: 'Le Perchoir' },
    { title: 'Livraison du canapé', date: day(1), kind: 'maison', who: 'a', note: 'Entre 8 h et 13 h' },
    { title: 'Ciné : Le Château ambulant', date: day(2), time: '21:00', endTime: '23:10', kind: 'sortie', who: 'both', place: 'Le Grand Rex' },
    { title: 'Calcifer', date: withYear(3, 1994), kind: 'anniversaire', who: 'both' },
    { title: 'Dîner chez Léa', date: day(5), time: '20:00', endTime: '00:30', kind: 'repas', who: 'both', place: 'Montreuil' },
    { title: 'Marché bio', date: day(5), time: '10:00', kind: 'maison', who: 'a' },
    { title: 'Balade en forêt', date: day(5), time: '14:30', kind: 'sortie', who: 'b' },
    { title: 'Appeler mamie', date: day(5), time: '18:00', kind: 'autre', who: 'b' },
    { title: 'Dentiste', date: day(9), time: '09:15', kind: 'rdv', who: 'b', place: 'Cabinet du Dr Martin' },
    { title: 'Léa', date: day(12), kind: 'anniversaire', who: 'both' },
    { title: 'Week-end à Étretat', date: day(16), kind: 'voyage', who: 'both' },
    { title: 'Notre rencontre', date: withYear(20, 2019), kind: 'autre', who: 'both', yearly: true },
    { title: 'Concert de Joe Hisaishi', date: day(34), time: '20:30', kind: 'sortie', who: 'both', place: 'Philharmonie' },
  ];
  let events: CalendarEvent[] = [];
  for (const draft of drafts) {
    const r = addEvent(events, { ...draft, id: `evt-${++seq}`, createdAt });
    if (!r.ok) throw new Error(`événement « ${draft.title} » refusé : ${r.reason}`);
    events = r.events;
  }
  return { ...emptyAppState(), calendar: { events } };
}

const check = (name: string, s: AppState) => {
  const r = validateAppState(JSON.parse(JSON.stringify(s)));
  if (!r.ok) throw new Error(`fixture ${name} invalide : ${r.reason}`);
  return JSON.stringify(s);
};

(window as unknown as { __fixtures: Record<string, string> }).__fixtures = {
  empty: check('empty', emptyAppState()),
  busy: check('busy', build()),
};
