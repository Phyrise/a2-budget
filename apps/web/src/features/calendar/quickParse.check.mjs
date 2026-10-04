/**
 * Test unitaire de la saisie rapide du Calendrier (logique pure).
 * Usage : node apps/web/src/features/calendar/quickParse.check.mjs   (Node ≥ 22.6, types effacés)
 */
import assert from 'node:assert/strict';
import { quickParse } from './quickParse.ts';

// Lundi 5 octobre 2026, 10 h.
const NOW = new Date(2026, 9, 5, 10, 0);
let count = 0;

function check(input, expected, now = NOW) {
  const got = quickParse(input, now);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(got[key], value, `« ${input} » → ${key} : attendu ${JSON.stringify(value)}, obtenu ${JSON.stringify(got[key])}`);
  }
  count += 1;
}

// L'exemple du brief.
check('dîner chez Léa samedi 20h', { title: 'Dîner chez Léa', date: '2026-10-10', time: '20:00', endTime: undefined, kind: 'repas' });
check('Dîner chez Léa samedi à 20 h 30', { title: 'Dîner chez Léa', date: '2026-10-10', time: '20:30' });
check('diner chez lea SAMEDI 20:00', { title: 'Diner chez lea', date: '2026-10-10', time: '20:00', kind: 'repas' });

// Jours relatifs et jours de la semaine.
check('ciné demain soir', { title: 'Ciné', date: '2026-10-06', kind: 'sortie', time: undefined });
check('apéro ce soir 19h', { title: 'Apéro', date: '2026-10-05', time: '19:00', kind: 'repas' });
check('pique-nique après-demain midi', { title: 'Pique-nique', date: '2026-10-07', time: '12:00', kind: 'repas' });
check("brunch aujourd'hui", { title: 'Brunch', date: '2026-10-05' });
check('déjeuner lundi', { date: '2026-10-05' }); // le jour même
check('déjeuner lundi prochain', { date: '2026-10-12' });
check('concert vendredi prochain 21h', { title: 'Concert', date: '2026-10-09', time: '21:00', kind: 'sortie' });
check('rando dimanche', { title: 'Rando', date: '2026-10-11', kind: 'sortie' });

// Dates explicites.
check('Anniversaire de Calcifer 12 mars', { title: 'Anniversaire de Calcifer', date: '2027-03-12', kind: 'anniversaire' });
check('anniv Jiji le 1er novembre', { title: 'Anniv Jiji', date: '2026-11-01', kind: 'anniversaire' });
check('vacances 24 décembre 2027', { title: 'Vacances', date: '2027-12-24', kind: 'voyage' });
check('dentiste 14/10 à 9h', { title: 'Dentiste', date: '2026-10-14', time: '09:00', kind: 'rdv' });
check('dentiste 3/10', { date: '2027-10-03' }); // passé cette année → l'an prochain
check('notaire 2/1/27', { date: '2027-01-02', kind: 'rdv' });
check('plombier le 20', { title: 'Plombier', date: '2026-10-20', kind: 'maison' });
check('plombier le 2', { date: '2026-11-02' }); // déjà passé ce mois-ci
check('Soirée chez Max samedi 10 octobre 20h', { title: 'Soirée chez Max', date: '2026-10-10', time: '20:00' });
check('voyage 31 février', { date: undefined }); // date impossible : rien n'est deviné

// Plages horaires.
check('réunion de 14h à 16h demain', { title: 'Réunion', date: '2026-10-06', time: '14:00', endTime: '16:00', kind: 'rdv' });
check('fête 22h-2h samedi', { time: '22:00', endTime: '02:00', date: '2026-10-10' });
check('expo entre 10h et 12h30', { time: '10:00', endTime: '12:30' });

// Rien d'ambigu n'est deviné.
check('Appeler maman', { title: 'Appeler maman', date: undefined, time: undefined, kind: undefined });
check('7 wonders avec Léo', { title: '7 wonders avec Léo', date: undefined, time: undefined });
check('dîner 20 heures', { title: 'Dîner', time: '20:00' });
check('   ', { title: '' });
check('25h', { time: undefined });

// Fin d'année : « 3 janvier » en décembre = l'an prochain.
check('soldes 3 janvier', { date: '2027-01-03' }, new Date(2026, 11, 20, 9));

// Jours qui n'existent pas toutes les années, ou jamais.
check('anniv de Léa le 29 février', { title: 'Anniv de Léa', date: '2028-02-29', kind: 'anniversaire' });
check('anniv de Léa 29/02', { title: 'Anniv de Léa', date: '2028-02-29' });
check('anniv de Léa le 29 février', { date: '2028-02-29' }, new Date(2028, 1, 29, 9)); // le jour même
check('anniv de Léa le 29 février', { date: '2032-02-29' }, new Date(2028, 2, 1, 9));
check('fête le 29/02/2027', { title: 'Fête le 29/02/2027', date: undefined });
check('pot le 31 avril', { title: 'Pot le 31 avril', date: undefined });
check('pot le 31 avril samedi', { title: 'Pot le 31 avril samedi', date: undefined }); // rien n'est deviné à la place
check('loyer le 31', { title: 'Loyer', date: '2026-10-31' });
check('loyer le 31', { title: 'Loyer', date: '2026-12-31' }, new Date(2026, 10, 5, 9)); // novembre : 30 jours
check('loyer le 30', { date: '2027-03-30' }, new Date(2027, 1, 5, 9)); // février : pas de 30
check('table 45', { title: 'Table 45', date: undefined });

console.log(`quickParse : ${count} cas vérifiés.`);
