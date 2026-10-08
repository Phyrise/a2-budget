/**
 * Vocabulaire des petits sons de la forêt. Aucune dépendance : importable
 * partout, y compris par les tests Node de la détection.
 */

/**
 * Un son, lié à ce que l'on voit :
 * - `done`     tâche faite → la lumière s'allume (carillon cristallin) ;
 * - `chore`    corvée faite (effort 3) → bol doux + carillon ;
 * - `undo`     un fait annulé → note douce descendante ;
 * - `skip`     « pas aujourd'hui » → souffle de vent ;
 * - `creature` nouvelle créature rencontrée → scintillement + note boisée ;
 * - `growth`   la forêt grandit → accord grave (koto) + bruissement ;
 * - `guardian` le gardien apparaît → nappe éthérée (≤ 3 s) ;
 * - `circle`   cercle de la semaine enregistré → deux notes qui se répondent ;
 * - `lantern`  lanterne terminée → floraison lumineuse ;
 *
 * Univers des modules (V3.2) :
 * - `coins`    un montant du budget change (salaire, compléments, dépense)
 *              → pièces d'or qui tintent (Sans-Visage) ;
 * - `konpeito` une dépense ajoutée → petit tintement de kompeitō (Noiraudes) ;
 * - `broom`    un article coché → coup de balai de Kiki (souffle filtré) ;
 * - `shopBell` le panier vidé → clochette de la boulangerie d'Osono ;
 * - `woodNote` un événement ajouté au calendrier → note de bois douce.
 *
 * V4 :
 * - `nom`         le compte monte (virement coché, dépense décochée)
 *                 → des pièces qui tombent dans la bouche du Sans-Visage,
 *                 un « nom » doux ;
 * - `spend`       le compte descend (dépense cochée, virement décoché)
 *                 → des pièces qui s'en vont, un petit « oh… » qui descend ;
 * - `ah`          on touche le Sans-Visage → un « ah… » feutré ;
 * - `balanceBell` le solde recalé sur le compte → petite cloche ;
 * - `lanternLit`  la lanterne de pierre s'allume (minuteur lancé)
 *                 → allumette frottée, puis un souffle chaud ;
 * - `lanternNew`  un nouveau modèle de lanterne débloqué → carillon.
 *
 * Compagnons (V4.3, touchés pour rien, juste pour le plaisir) :
 * - `karakara`    un kodama secoue la tête → cliquetis de bois, ses voisins
 *                 répondent ;
 * - `crackle`     Calcifer touché → la flamme crépite et s'élève ;
 * - `grumble`     Calcifer agacé (touché trop souvent) → grognement de braise ;
 * - `yawn`        Totoro bâille et s'étire → long souffle grave et doux.
 * - `squeak`      on touche une Noiraude → petit cri aigu « kyu ! ».
 * - `purr`        on caresse Jiji (avatar de l'autre, V5.2) → ronron grave.
 */
export type SoundCue =
  | 'done'
  | 'chore'
  | 'undo'
  | 'skip'
  | 'creature'
  | 'growth'
  | 'guardian'
  | 'circle'
  | 'lantern'
  | 'coins'
  | 'konpeito'
  | 'broom'
  | 'shopBell'
  | 'woodNote'
  | 'nom'
  | 'spend'
  | 'ah'
  | 'balanceBell'
  | 'lanternLit'
  | 'lanternNew'
  | 'karakara'
  | 'crackle'
  | 'grumble'
  | 'yawn'
  | 'squeak'
  | 'purr';

/** Couleur du carillon : AL plus aérien, AC plus chaud, ensemble les deux. */
export type SoundVoice = 'a' | 'b' | 'both' | 'none';

/** Un événement sonore détecté dans une transition d'état. */
export interface SoundEvent {
  cue: SoundCue;
  who?: SoundVoice;
}

/** Un son planifié : décalage (ms) à partir de maintenant. */
export interface PlannedSound extends SoundEvent {
  delayMs: number;
}

export const ALL_CUES: readonly SoundCue[] = [
  'done',
  'chore',
  'undo',
  'skip',
  'creature',
  'growth',
  'guardian',
  'circle',
  'lantern',
  'coins',
  'konpeito',
  'broom',
  'shopBell',
  'woodNote',
  'nom',
  'spend',
  'ah',
  'balanceBell',
  'lanternLit',
  'lanternNew',
  'karakara',
  'crackle',
  'grumble',
  'yawn',
  'squeak',
  'purr',
];
