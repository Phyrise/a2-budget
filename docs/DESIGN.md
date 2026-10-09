# A² Budget — Direction visuelle (V1)

Une petite application calme, chaleureuse, précise et agréable à rouvrir.
Esthétique éditoriale sobre, hiérarchie forte, peu de bruit visuel.

## Palette

| Rôle | Valeur | Usage |
|---|---|---|
| Fond | `#F7F5EF` (crème) | fond de l'app |
| Surfaces | `#FFFFFF` | cartes, champs |
| Texte | `#21362D` | texte principal |
| Vert profond | `#254B3D` | carte principale, boutons primaires, navigation active |
| Accent sable | `#DCC9A3` | accents discrets, séparateurs, surbrillance douce |

Les teintes secondaires (texte atténué, bordures, danger) sont dérivées dans
`tokens.css` et doivent garantir le contraste (≥ 4.5:1 pour le texte courant).
Déficit : rouge terreux lisible, jamais criard.

Repères visuels discrets pour les deux personnes, portés par leurs **noms**
(ex. pastille ou initiale neutre) — aucun code genré.

## Typographie

- Police système soignée, **aucun téléchargement de police**.
- Montants en chiffres tabulaires (`font-variant-numeric: tabular-nums`),
  alignements nets ; symbole € secondaire mais lisible.
- Texte courant 16 px ; labels lisibles ; montants principaux 32–44 px selon
  la largeur.

## Espaces et formes

- Espacements cohérents : 8 / 12 / 16 / 24 / 32 px.
- Cartes arrondies ~20 px ; bordures fines ; ombres très légères.
- Éviter : cartes imbriquées, badges, dégradés, illustrations décoratives,
  couleurs concurrentes.
- Icônes SVG simples et cohérentes, toujours accompagnées de texte.
  **Pas d'emojis servant d'icônes d'interface.**

## Mise en page

- Mobile d'abord, 360–430 px, **sans débordement horizontal**.
- Sur ordinateur : contenu centré, largeur maîtrisée (~560 px), disposition
  plus aérée quand utile.
- Zones tactiles ≥ 44 px ; focus visible ; contraste accessible ; navigation
  clavier ; labels explicites.
- Navigation inférieure fixe, trois destinations,
  `padding-bottom: env(safe-area-inset-bottom)` ; le contenu laisse la place à
  la navigation et au clavier (aucun champ caché).

## Écran « Ce mois »

Ordre vertical :

1. Mois affiché + sélection d'un autre mois (+ retour au mois courant).
2. Deux champs de salaire faciles à ajuster (nom de la personne + montant).
3. Carte principale « À verser sur le compte commun » (vert profond) :
   contribution A, contribution B, total. **Ces informations doivent tenir dans
   le premier écran à 390 × 844 px.**
4. Détail du calcul repliable (ex. « B : 40 % × 3 000 € + 20 % × 675 € »).
5. Liste compacte des dépenses modifiables (ajouter, renommer, retirer) +
   total des dépenses.
6. « Reste après dépenses » (déficit affiché en rouge terreux si négatif).
7. « Disponible pour les loisirs » si une réserve est configurée ; si la
   réserve n'est pas couverte, l'indiquer clairement (part non couverte).

## Écran « Historique »

- Liste chronologique inverse des seuls mois existants : date, revenus,
  contributions, dépenses, reste.
- Appui → ouvre ce mois dans « Ce mois », date clairement visible.
- État vide propre (aucun historique fictif, aucun graphique).

## Écran « Réglages »

- Personnes : nom, salaire de base, taux de base, taux variable.
- Dépenses récurrentes : liste modifiable.
- Réserve mensuelle par défaut.
- Export / import JSON avec explication simple (« données enregistrées sur cet
  appareil ») et avertissement sobre (données personnelles ; effacer les
  données du navigateur supprime l'historique).
- Explication brève : les valeurs par défaut s'appliquent aux nouveaux mois ;
  bouton « Appliquer au mois affiché ».

## Saisie

- Clavier décimal mobile (`inputmode="decimal"`), formatage fr-FR/EUR hors
  édition.
- Virgule ou point décimal acceptés ; espaces français au collage.
- Conversion déterministe en centimes ; entrée ambiguë ou > 2 décimales
  **rejetée** (message local), jamais tronquée silencieusement.
- Chaîne d'édition séparée du montant valide ; champ vide ≠ 0 ; « 0 » valide ;
  préserver curseur, focus, dernière valeur enregistrée.

## Micro-animations

- CSS uniquement, opacity/transform, ~140–220 ms : transition légère entre
  vues, pression douce sur un bouton, indication brève d'enregistrement,
  accent discret lorsqu'un résultat change.
- État correct et montant final disponibles immédiatement.
- Interdit : compteur qui défile, confettis, animation permanente, parallax,
  délai artificiel, bibliothèque d'animation.
- `prefers-reduced-motion` : supprimer les mouvements.
- Pas d'animation de mise en page à chaque frappe ; pas de changement de
  hauteur inattendu.

## Compagnons au choix (V5.6)

- Quatre compagnons : Jiji (chat noir de Kiki), Calcifer (flamme du Château
  ambulant), Teto (renard-écureuil de Nausicaä), Hin (vieux chien du Château
  ambulant). Par défaut, AL a Jiji et AC Calcifer.
- **Choix** : Réglages → carte de la personne → toucher son compagnon (à côté
  du prénom) : une rangée de quatre (sprite + prénom), le choix actuel cerclé,
  celui de l'autre grisé et désactivé ; choisir referme la rangée. Connecté,
  seule sa propre carte propose le choix (rôle de la session) ; en invité,
  les deux cartes. Ailleurs, la carte garde le compagnon touchable.
- **Données** : `settings.personA.companion` / `personB.companion`
  (`CompanionId` de @a2/core), réglages globaux seulement (pas de copie par
  mois), synchronisés avec la collection `settings` (aucune règle Firestore
  nouvelle). Lecture tolérante : absent ou inconnu → défaut du rôle.
- **Anti-doublon** : jamais le même compagnon pour les deux. Si deux choix
  simultanés se croisent, `companionsOf` garde celui de A et donne à B son
  défaut s'il est libre, sinon le premier libre (résolu à la lecture, rien
  n'est réécrit).
- **Registre** : `apps/web/src/ui/companions.ts`, seule source des
  différences (prénom, libellé du toucher, poses des réactions, sons,
  démarche de l'avatar) ; hooks `useCompanionId(who)` / `useCompanionIds()`.
  Sprites : `manifest.companions[id][pose]` (planches 12, 13, 15, 16 ;
  art/pipeline/05_sprites.py). Les couleurs de personne restent liées au
  rôle ; les décors des Courses (Jiji de Kiki) ne changent pas.
