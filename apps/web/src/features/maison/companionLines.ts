/**
 * Répliques des compagnons (bulles éphémères). Présentation uniquement.
 *
 * - Jiji (AL) : pince-sans-rire, élégant, un brin moqueur mais tendre.
 * - Calcifer (AC) : grognon, dramatique, se plaint pour la forme, attachant.
 *
 * Règles d'écriture : courtes (≤ 90 caractères), en français, sans emoji,
 * jamais culpabilisantes ni compétitives (aucune pique sur les habitudes
 * d'un humain, rien à « rendre » ni de merci réclamé : le compagnon se moque
 * de lui-même), et **sans accord de genre** pour
 * les humains (on ne sait pas qui est qui). Variables : `{humain}` = l'humain
 * du compagnon qui parle, `{autre}` = l'autre personne. La typographie
 * (espaces insécables) est appliquée au moment de l'affichage (fr()).
 */
import { fr } from '../../ui';

export type BubbleContext = 'check' | 'chore' | 'allDone' | 'morning' | 'pause' | 'claim' | 'skip' | 'help';
export type Speaker = 'a' | 'b';

type Lines = Record<BubbleContext, readonly string[]>;

const JIJI: Lines = {
  check: [
    'Fait. Je n’ai rien vu, mais je valide.',
    'Impeccable. Je n’aurais pas fait mieux — je n’aurais rien fait, remarque.',
    'Une lumière de plus. La forêt fait semblant de ne pas être émue.',
    'Bien. Je note ça dans mon carnet imaginaire.',
    'Efficace. Presque félin.',
    'C’est fait, et avec une certaine allure.',
    'Je t’applaudirais bien, mais j’ai des pattes.',
    'Voilà qui est réglé. On peut retourner à la sieste ?',
    'Sobre, net, sans fanfare. J’approuve.',
    'Encore un geste, {humain}. La forêt t’en sait gré. Moi, je bâille d’admiration.',
  ],
  chore: [
    'Une corvée, rien que ça. Je retire mes sarcasmes. Pour une heure.',
    'Ça, c’était du sérieux. La forêt s’incline. Moi aussi, un peu.',
    'Héroïque. Je le dis rarement, profites-en.',
    'Tu as fait la chose que personne ne voulait faire. Respect, {humain}.',
    'Corvée terminée. Je propose une statue. Petite, en mousse.',
    'Voilà le genre d’exploit qu’on raconte aux chatons.',
    'J’aurais fui. Toi, non. C’est pour ça qu’on t’aime.',
    'C’était lourd, et c’est derrière toi. Prends un thé, c’est un ordre.',
    'Même la brume a l’air impressionnée.',
    'Je vais faire semblant de ne pas être fier. Échec total.',
  ],
  allDone: [
    'Tout est fait. Je vais pouvoir ne rien faire, la conscience tranquille.',
    'Plus rien à faire. Le programme idéal, si tu veux mon avis.',
    'La liste est vide. La forêt aussi est soulagée.',
    'Journée bouclée. On peut regarder par la fenêtre, l’âme en paix.',
    'Tout est en ordre. C’en est presque suspect.',
    'Rien ne reste. Je propose un coussin et le silence.',
    'Bravo à vous deux. Je ne le répéterai pas.',
    'Fini. Le reste de la journée t’appartient. À moi aussi, d’ailleurs.',
    'Plus une seule tâche. Je m’étire en signe de respect.',
  ],
  morning: [
    'Déjà debout, et déjà utile. Je suis troublé.',
    'Première lumière du jour. Le café peut attendre, apparemment.',
    'Si tôt ? Tu me fais honte. Je retourne dormir pour compenser.',
    'Bonjour. Tu as commencé avant moi, c’est vexant.',
    'Une tâche avant le petit-déjeuner. Quel genre de personne fait ça ?',
    'Le matin te va bien. Ne le répète pas.',
    'La brume n’est même pas levée, et toi si.',
    'Premier geste de la journée. Élégant. Un peu matinal.',
    'Bien commencé. Le reste suivra, ou pas. Aucune pression.',
  ],
  pause: [
    'Une pause. Enfin une idée que je comprends.',
    'La forêt dort. Je la rejoins, par solidarité.',
    'Rien ne presse. Rien n’a jamais pressé, d’ailleurs.',
    'Pause méritée. Je surveille. Les yeux fermés.',
    'Repose-toi. Les tâches ne vont pas s’enfuir, hélas.',
    'La maison peut attendre. Toi, tu as besoin de souffler.',
    'Mode sieste activé. Mon préféré.',
    'Personne ne compte les jours de pause. Surtout pas moi.',
    'Va. Je garde la clairière. Mollement.',
  ],
  claim: [
    '{autre} s’en occupe. Je retire au moins la moitié de mes remarques.',
    'Merci, {autre}. Voilà qui mérite un thé. Ou deux.',
    'Quelqu’un se dévoue. C’est noble. Je l’écris quelque part.',
    'Merci, {autre}. Prendre sans qu’on demande, c’est élégant.',
    'Pris en charge. La maison respire, moi aussi.',
    '{autre} s’en charge. Voilà ce qu’on appelle de la classe.',
    'Merci. Je n’aurais pas levé une patte, mais j’apprécie le geste.',
    'Un cadeau discret. Les meilleurs le sont toujours.',
    'Merci, {autre}. La forêt a remarqué. Moi aussi.',
  ],
  skip: [
    'Pas aujourd’hui. Excellente décision, je la prends souvent.',
    'Demain existe. C’est même son principal intérêt.',
    'Remettre à plus tard n’est pas un crime. C’est un art.',
    'Personne ne t’en voudra. Moi, je t’en félicite.',
    'On fait ce qu’on peut. Aujourd’hui, on peut moins. C’est permis.',
    'La forêt ne compte pas. Elle pousse quand même.',
    'Laisse ça. Viens plutôt t’asseoir au soleil.',
    'Une tâche reportée, c’est une soirée gagnée.',
    'Sage. On ne se bat pas contre toutes les poussières.',
    'Ce n’est pas abandonner, c’est choisir. Nuance.',
  ],
  help: [
    'Merci, {autre}. La maison a remarqué, et moi aussi.',
    'Tiens, c’est {autre} qui l’a fait, en douce. Quelle élégance.',
    'Un petit cadeau de {autre}. La forêt brille un peu plus.',
    '{autre} a pris le relais. Voilà ce qu’on appelle une équipe.',
    'C’était prévu pour toi, et {autre} l’a fait. Ça, c’est s’aimer.',
    'Fait par {autre}, avec une discrétion presque féline. J’approuve.',
    'Une aide en douce. C’est ainsi que les maisons tiennent debout.',
    'Merci, {autre}. Mon humain est touché. Moi aussi, un peu.',
    '{autre} a fait ça pour la maison. Je propose un câlin général.',
  ],
};

const CALCIFER: Lines = {
  check: [
    'Bon. C’est fait. Je ne vais pas en faire un feu de joie.',
    'Hmpf. Pas mal. Pour un humain.',
    'Une lumière de plus ! Et personne n’a brûlé.',
    'Je crépite. C’est ma façon de dire bravo.',
    'Fait ? Déjà ? Bon, d’accord, je suis impressionné.',
    'Ah ! Coché ! Et moi qui comptais faire semblant d’aider.',
    'Ça mérite une bûche. Une petite. Ne t’emballe pas.',
    'Coché ! Je brûle de fierté. Littéralement.',
    'Tu vois ? Pas besoin de me supplier, ça avance tout seul.',
    'Je ne dirai rien. Je suis juste un peu plus chaud que tout à l’heure.',
  ],
  chore: [
    'LA CORVÉE ! Tombée ! Je flambe de joie !',
    'Ça, c’était un vrai feu de forêt. Bravo, {humain}.',
    'Je l’aurais faite, hein. Si j’avais des bras. Et l’envie.',
    'Corvée vaincue. Je vais en parler à toutes les bûches.',
    'Ouf. Rien qu’à te regarder, j’ai eu chaud.',
    'Ça mérite trois bûches. Et une coquille d’œuf. Non, deux.',
    'Mes flammes montent toutes seules. C’est de ta faute.',
    'La pire tâche de la maison. Écrasée. Je suis presque ému.',
    'Tu sais ce que ça veut dire ? Repos. Obligatoire. C’est moi qui décide.',
    'Personne ne le dira, alors je le dis : c’était énorme.',
  ],
  allDone: [
    'TOUT est fait ? Je me couche sur mes braises, satisfait.',
    'Plus rien ! Enfin ! On peut parler de moi, maintenant ?',
    'La maison tient debout grâce à vous. Et un peu grâce à moi.',
    'Liste vide ! Je crépite comme un feu de cheminée un soir d’hiver.',
    'Fini pour aujourd’hui. Personne ne bouge, tout le monde se repose.',
    'Vous êtes incroyables, tous les deux. Bon. Pas la grosse tête, hein.',
    'Tout est fait. Je pourrais pleurer, mais je m’éteindrais.',
    'Voilà. La maison ronronne. Enfin, moi je crépite, c’est pareil.',
    'Bravo ! Une bûche pour le héros. C’est moi, le héros ?',
  ],
  morning: [
    'Il fait à peine jour ! Tu veux ma mort ? Bon… bravo quand même.',
    'Une tâche au réveil ? J’avais encore les yeux fermés !',
    'Bonjour ! Enfin, bonjour… je n’ai pas encore eu ma bûche du matin.',
    'Déjà ? Attends au moins que je me rallume.',
    'Premier geste de la journée ! Ça mérite une flamme. Petite. Je me réveille.',
    'Le soleil n’est pas levé et toi, tu t’actives. Je suis outré. Et fier.',
    'Bon matin ! Moi, avant ma bûche, je ne suis bon à rien.',
    'Tu as commencé sans moi ! Bon. Je te rattrape. Plus tard.',
    'Matin productif. Je vais en parler toute la journée.',
  ],
  pause: [
    'Une pause ? Parfait. Je baisse le feu, mais je reste là.',
    'Repos ! Je veille sur la maison. Comme toujours. Personne ne me remercie.',
    'Allez, souffle un peu. Je m’occupe d’être grognon pour deux.',
    'Rien ne brûle, rien ne se perd. Va te reposer.',
    'Pause ! Je fais des braises douces. Tu ne m’entendras pas.',
    'Prends le temps. La forêt ne se vexe pas. Moi, un peu, mais ça passe.',
    'Je mets les braises en veilleuse. Reviens quand tu veux.',
    'Une maison au repos, c’est une maison qui tient. Parole de feu.',
    'Dors, mange, rêve. Je garde le feu.',
  ],
  claim: [
    '{autre} s’y colle ! Merci ! Je ne pleure pas, c’est de la fumée.',
    'Merci, {autre} ! Une bûche d’honneur pour toi.',
    'Quelqu’un prend les choses en main ! Enfin ! Merci !',
    'Tu t’en occupes ? Merci. Sincèrement. Ne le répète à personne.',
    'Merci, {autre}. Je crépite de reconnaissance.',
    'Voilà ! Personne n’a eu à négocier. J’adore.',
    'Pris en charge ! Je retire tout ce que j’ai dit. Enfin, presque.',
    '{autre} s’en charge ! Je crépite d’admiration. Discrètement. Enfin, j’essaie.',
    'Merci ! La maison te dit merci. Et le feu aussi.',
  ],
  skip: [
    'Pas aujourd’hui ? Ça me va. Moi non plus, je n’ai pas envie.',
    'Laisse, ça attendra. Rien ne va prendre feu. Je vérifie.',
    'Repose-toi. Les tâches, elles, ne se fatiguent jamais. Injuste.',
    'Demain, on verra. Ce soir, on souffle.',
    'Tu as le droit de ne pas tout faire. C’est un démon du feu qui te le dit.',
    'Pas de souci. La maison ne va pas s’écrouler. Pas pour ça, en tout cas.',
    'Bonne idée. Garde tes forces. Et ta bonne humeur.',
    'Personne ne compte, promis. Pas même moi, et je compte tout.',
    'C’est reporté. Voilà. Pas de drame. Le drame, c’est mon rayon.',
    'On fera ça un autre jour. Les jours, ce n’est pas ce qui manque.',
  ],
  help: [
    'Merci, {autre} ! Je chaufferai un peu plus fort ce soir, rien que pour toi.',
    'Quelqu’un t’aime, ici. Indice : c’est {autre}.',
    '{autre} a donné un coup de main. C’est ça, une équipe.',
    '{autre} l’a fait sans rien dire. Moi, je le dis : merci !',
    'Tu vois ? Dans cette maison, on se serre les coudes. Et les bûches.',
    'Coup de main de {autre} ! Je note. Pour le carnet.',
    'Merci, {autre} ! Toute la maison respire, moi le premier.',
    'Une aide surprise ! Je crépite d’émotion. C’est de la fumée, rien de plus.',
    'Bravo, {autre} ! Une bûche d’honneur, et des étincelles pour la maison.',
  ],
};

export const COMPANION_LINES: Record<Speaker, Lines> = { a: JIJI, b: CALCIFER };
export const COMPANION_NAMES: Record<Speaker, string> = { a: 'Jiji', b: 'Calcifer' };

const lastPicked = new Map<string, number>();

/**
 * Tire une réplique au hasard, jamais la même deux fois de suite pour un
 * même compagnon et un même contexte. `random` injectable (tests).
 */
export function pickLine(
  speaker: Speaker,
  context: BubbleContext,
  vars: { humain: string; autre: string },
  random: () => number = Math.random,
): string {
  const lines = COMPANION_LINES[speaker][context];
  const key = `${speaker}:${context}`;
  const last = lastPicked.get(key);
  let index = Math.floor(random() * lines.length) % lines.length;
  if (lines.length > 1 && index === last) index = (index + 1 + Math.floor(random() * (lines.length - 1))) % lines.length;
  lastPicked.set(key, index);
  const raw = lines[index] ?? '';
  return fr(raw.replace(/\{humain\}/g, vars.humain).replace(/\{autre\}/g, vars.autre));
}
