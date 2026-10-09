/**
 * Répliques des compagnons (bulles éphémères). Présentation uniquement.
 *
 * - Jiji (défaut d'AL) : pince-sans-rire, élégant, un brin moqueur mais tendre.
 * - Calcifer (défaut d'AC) : grognon, dramatique, se plaint pour la forme, attachant.
 * - Teto : petit animal sauvage, méfiant puis confiant, humour sec, phrases
 *   courtes, quelques « Kss. » discrets.
 * - Hin : vieux chien flegmatique, paresseux, pince-sans-rire ; des « Hin. »
 *   ponctuent, fatigue théâtrale, tendresse dessous.
 *
 * Chacun garde sa voix, quelle que soit la personne qui l'a choisi (V5.6).
 *
 * Règles d'écriture : courtes (≤ 90 caractères), en français, sans emoji,
 * jamais culpabilisantes ni compétitives (aucune pique sur les habitudes
 * d'un humain, rien à « rendre » ni de merci réclamé : le compagnon se moque
 * de lui-même), et **sans accord de genre** pour
 * les humains (on ne sait pas qui est qui). Variables : `{humain}` = l'humain
 * du compagnon qui parle, `{autre}` = l'autre personne. La typographie
 * (espaces insécables) est appliquée au moment de l'affichage (fr()).
 */
import { defaultCompanion, type CompanionId } from '@a2/core';
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

const TETO: Lines = {
  check: [
    'Kss. Fait. Je renifle : ça sent le travail propre.',
    'Une lumière de plus. Ma queue s’agite toute seule.',
    'Fait. Je m’approche d’un pas. Pas deux.',
    'Coché. Je fais semblant de regarder ailleurs.',
    'Net. Rapide. Presque sauvage. J’aime.',
    'Fait. Je grimpe sur ton épaule, en guise de bravo.',
    'Kss. Bien vu. Je garde l’œil ouvert pour la suite.',
    'Une chose de moins. La forêt bruisse un peu.',
    'Fait. Mes oreilles approuvent. Le reste suit.',
    'Bien, {humain}. Je te fais confiance. Un peu plus qu’hier.',
  ],
  chore: [
    'Une corvée entière. Je sors du terrier pour voir ça.',
    'Kss ! Tombée. Je n’en reviens pas. Je reste quand même.',
    'Le gros morceau. Je te mordillerais de fierté.',
    'Corvée finie. Je hérisse le poil : c’est de l’admiration.',
    'Ça, c’était une bête sauvage. Tu l’as eue, {humain}.',
    'J’aurais filé dans les herbes. Toi, tu as tenu bon.',
    'Corvée vaincue. Je me roule dans la mousse pour fêter ça.',
    'C’était lourd. Moi, je pèse trois noisettes. Respect.',
    'Même le vent du désert se tait. Bravo.',
    'Kss. Je ne fais pas confiance à grand monde. À toi, si.',
  ],
  allDone: [
    'Tout est fait. Je me roule en boule dans ta capuche.',
    'Plus rien. Le calme. Mes oreilles se reposent enfin.',
    'La liste est vide. Je flaire un après-midi tranquille.',
    'Tout est en ordre. Je ne grogne plus. Promis.',
    'Fini. Je me pose sur la fenêtre, la queue au soleil.',
    'Rien ne reste. Même mes moustaches sont détendues.',
    'Bravo à vous deux. Je m’approche. Tout près.',
    'Journée bouclée. Je baisse la garde. C’est rare.',
    'Kss. Tout est fait. Je fais ma toilette, satisfait.',
  ],
  morning: [
    'Debout si tôt ? Mes oreilles ont tout capté.',
    'Kss. Première lumière. Je sors le museau.',
    'Le jour se lève, toi aussi. Moi, à moitié.',
    'Une tâche à l’aube. Comme les bêtes sauvages. J’approuve.',
    'Bonjour. Je renifle le matin. Il sent bon.',
    'Premier geste du jour. Je bâille, mais je regarde.',
    'La rosée n’a pas séché, et c’est déjà fait.',
    'Bien commencé. Je te suis. À distance raisonnable.',
    'Matin rapide. Tu cours presque plus vite que moi.',
  ],
  pause: [
    'Une pause. Je me cache dans ta poche. Réveille-moi après.',
    'On souffle. Je garde l’oreille dressée, pour toi.',
    'Rien ne presse. Les terriers ne s’effondrent pas.',
    'Pause. Je fais le guet. Les yeux mi-clos.',
    'Repose-toi. Je surveille les ombres.',
    'La forêt dort. Je fais semblant aussi.',
    'Kss. Pas un bruit. Juste nous et le vent.',
    'Prends ton temps. Moi, je prends le soleil.',
    'Je me roule en boule. Je te le conseille.',
  ],
  claim: [
    '{autre} s’en charge. Je m’approche, l’air de rien.',
    'Merci, {autre}. Je te tends la patte. C’est rare.',
    'Pris en charge. Ma queue s’agite, je n’y peux rien.',
    '{autre} prend ça. Je baisse les oreilles : respect.',
    'Kss. Merci, {autre}. Je ne mords personne, aujourd’hui.',
    'Quelqu’un se lance. Je flaire du bon.',
    'Merci, {autre}. Je range ça avec mes noisettes.',
    'Pris sans qu’on demande. Ça, j’aime bien.',
    '{autre} s’y colle. Je fais un pas de plus vers toi.',
  ],
  skip: [
    'Pas aujourd’hui. Même les renards se terrent, parfois.',
    'Demain, la piste sera encore là.',
    'Laisse. On ne chasse pas tous les jours.',
    'Personne ne compte. Moi, je compte les noisettes.',
    'Kss. Bonne idée. Viens te poser au soleil.',
    'On recule d’un pas. C’est comme ça qu’on tient longtemps.',
    'Reporté. Rien ne bouge. Tout va bien.',
    'Une tâche laissée, une sieste trouvée.',
    'Pas de honte. Je file dans un trou tous les jours.',
    'Ce n’est pas fuir, c’est garder ses forces.',
  ],
  help: [
    'Merci, {autre}. Je l’ai flairé tout de suite.',
    '{autre} l’a fait en douce. Discret comme un renard.',
    'Un cadeau de {autre}. Ma queue s’agite toute seule.',
    'Kss. {autre} a pris le relais. Bonne meute.',
    'C’était pour toi, et {autre} l’a fait. Je note.',
    'Fait par {autre}, sans bruit. J’approuve, oreilles dressées.',
    'Une aide en douce. C’est comme ça qu’on tient, ici.',
    'Merci, {autre}. Mon humain est touché. Moi, je m’approche.',
    '{autre} a fait ça pour la maison. Je viens me frotter.',
  ],
};

const HIN: Lines = {
  check: [
    'Hin. Fait. Je te regardais faire. C’était épuisant.',
    'Hin hin. Une lumière de plus. Je lève une paupière.',
    'Coché. Je remue la queue. Une fois. Ça suffit.',
    'Hin. Bien. Je me rendors, fier de toi.',
    'Fait ? Bon. Je n’ai pas bougé, mais j’étais avec toi.',
    'Hin. C’est fait. Je souffle pour deux.',
    'Une chose de moins. Mes vieux os approuvent.',
    'Hin hin. Efficace. Moi, je suis efficace autrement.',
    'Fait. Je te donnerais la patte, mais elle dort.',
    'Bien, {humain}. Hin. C’est tout. C’est beaucoup.',
  ],
  chore: [
    'Hin. Une corvée. Rien que d’y penser, j’ai sommeil.',
    'Hin hin. Tombée. Je me lève. Non. Je me rassois.',
    'La grosse corvée. Je te salue d’un long soupir.',
    'Bravo, {humain}. Hin. J’ai eu chaud pour toi.',
    'Corvée finie. Je vais m’allonger. Par solidarité.',
    'Ça, c’était lourd. Comme moi après le dîner.',
    'Hin. J’en ai vu, des choses. Celle-là compte.',
    'Tu l’as faite. Je remue la queue. Deux fois. Exceptionnel.',
    'Héroïque. Hin. Je le dis couché, mais je le pense.',
    'Ouf. Je soupire de soulagement. Et par habitude.',
  ],
  allDone: [
    'Tout est fait. Hin. On peut enfin ne rien faire.',
    'Plus rien. Je me couche. Je l’étais déjà, remarque.',
    'La liste est vide. Mon programme préféré.',
    'Hin hin. Fini. La maison respire, moi je ronfle.',
    'Tout est en ordre. Je ferme un œil. Puis l’autre.',
    'Bravo à vous deux. Hin. J’en ai le souffle court.',
    'Fini. Un tapis, du soleil. La vie est simple.',
    'Rien ne reste. Je m’étale de tout mon long.',
    'Journée bouclée. Hin. On a bien travaillé. Vous, surtout.',
  ],
  morning: [
    'Hin. Déjà ? Le soleil dort encore, lui.',
    'Une tâche à l’aube. Je n’ouvre qu’un œil. Bravo.',
    'Bonjour. Hin hin. Laisse-moi le temps d’exister.',
    'Si tôt… Je te regarde depuis mon coussin.',
    'Premier geste du jour. Moi, mon premier soupir.',
    'Le matin te réussit. Moi, il me fatigue.',
    'Hin. Debout avant moi. Ça arrive. Tous les jours.',
    'Bien commencé. Je te rejoins. Plus tard. Bien plus tard.',
    'La brume traîne encore. Toi, non.',
  ],
  pause: [
    'Une pause. Hin. Ça, c’est mon domaine.',
    'Repose-toi. Je montre l’exemple depuis ce matin.',
    'Rien ne presse. À mon âge, rien n’a jamais pressé.',
    'Pause. Je garde la maison. Couché, mais je la garde.',
    'Hin hin. Souffle. Moi, je siffle. On s’entend.',
    'La maison peut attendre. Elle a l’habitude, avec moi.',
    'Mode sieste. Je l’ai inventé.',
    'Hin. Personne ne compte les pauses. Moi, je les savoure.',
    'Va. Je veille. D’un œil. Fermé.',
  ],
  claim: [
    '{autre} s’en charge. Hin. Je lève la tête, c’est dire.',
    'Merci, {autre}. Je remue la queue. Lentement, mais sincèrement.',
    'Pris en charge. Je peux continuer à ne rien faire. Parfait.',
    'Hin hin. {autre} s’y colle. Je pose ma tête sur tes pieds.',
    'Merci, {autre}. Je n’ai pas bougé, mais j’ai tout vu.',
    'Quelqu’un se dévoue. Je soupire d’aise.',
    '{autre} prend ça. Hin. La maison tient bon.',
    'Pris sans qu’on demande. Ça, c’est de la classe.',
    'Merci, {autre}. Hin. Ça me touche. Je reste couché.',
  ],
  skip: [
    'Pas aujourd’hui. Hin. Je soutiens cette décision.',
    'Demain existe. Je l’attends allongé.',
    'Laisse. Les tâches, c’est comme moi : ça attend.',
    'Personne ne t’en voudra. Moi, je t’admire.',
    'Hin hin. Remettre à plus tard. Ma spécialité.',
    'On fait moins, aujourd’hui. C’est permis. Je suis la preuve.',
    'Viens plutôt t’asseoir. Il reste de la place sur le tapis.',
    'Reporté. La maison ne s’écroule pas. J’ai vérifié, couché.',
    'Hin. On ne court pas après toutes les poussières.',
    'Ce n’est pas renoncer. C’est souffler. Je connais.',
  ],
  help: [
    'Merci, {autre}. Hin. La maison a remarqué. Moi aussi.',
    '{autre} l’a fait en douce. Je n’ai rien dit. Je dormais.',
    'Un cadeau de {autre}. Hin hin. Je remue la queue.',
    '{autre} a pris le relais. Voilà une meute qui tient.',
    'C’était pour toi, et {autre} l’a fait. Ça, c’est s’aimer.',
    'Fait par {autre}, sans bruit. Comme moi, mais debout.',
    'Une aide en douce. Hin. Les vieilles maisons tiennent ainsi.',
    'Merci, {autre}. Mon humain est touché. Moi, j’ai soupiré.',
    '{autre} a fait ça. Je propose une sieste générale.',
  ],
};

/** V5.6 — répliques indexées par compagnon (et non plus par rôle). */
export const COMPANION_LINES: Record<CompanionId, Lines> = { jiji: JIJI, calcifer: CALCIFER, teto: TETO, hin: HIN };

/** Répliques du compagnon choisi (à défaut, celui du rôle de `speaker`). */
export function linesFor(id: CompanionId | undefined, speaker: Speaker): Lines {
  return COMPANION_LINES[id ?? defaultCompanion(speaker)];
}

const lastPicked = new Map<string, number>();

/**
 * Tire une réplique au hasard, jamais la même deux fois de suite pour un
 * même compagnon et un même contexte. `random` injectable (tests).
 * `companion` : le compagnon choisi par `speaker` (sinon celui du rôle).
 */
export function pickLine(
  speaker: Speaker,
  context: BubbleContext,
  vars: { humain: string; autre: string },
  random: () => number = Math.random,
  companion?: CompanionId,
): string {
  const lines = linesFor(companion, speaker)[context];
  const key = `${speaker}:${companion ?? ''}:${context}`;
  const last = lastPicked.get(key);
  let index = Math.floor(random() * lines.length) % lines.length;
  if (lines.length > 1 && index === last) index = (index + 1 + Math.floor(random() * (lines.length - 1))) % lines.length;
  lastPicked.set(key, index);
  const raw = lines[index] ?? '';
  return fr(raw.replace(/\{humain\}/g, vars.humain).replace(/\{autre\}/g, vars.autre));
}
