# A² Budget — Spécification produit (V1, révisée V4)

Application de budget commun pour un couple. Objectif : comprendre en quelques
secondes combien chacun doit verser sur le compte commun et **où en est le
solde du compte commun** (V4 : le « reste » disparaît au profit du solde
estimé, voir « Solde du compte commun »).

- Interface en **français** ; code et identifiants en **anglais**.
- V1 100 % locale : PWA React/TypeScript/Vite servie sur GitHub Pages
  (`https://phyrise.github.io/a2-budget/`), persistance `localStorage`.
- Pas de backend, pas de compte, pas d'authentification, pas de synchronisation,
  pas de connexion bancaire, pas d'analytics, aucun service externe.
- Aucune donnée financière n'est envoyée sur le réseau, placée dans une URL,
  journalisée ou committée. Assets et polices servis localement (police système).
- Deux appareils = deux jeux de données indépendants. L'export/import est une
  sauvegarde et un transfert manuel, pas une synchronisation.
- L'interface de stockage (`StorageAdapter`) prépare une future API (V2) sans
  l'implémenter.

## Vues (exactement trois)

Navigation par état React, sans routeur. Navigation inférieure fixe :
**Ce mois** · **Historique** · **Réglages**.

### 1. Ce mois

- Mois affiché + sélection d'un autre mois + retour simple au mois courant.
- Par personne : un **salaire** facile à ajuster et des **compléments**
  facultatifs (heures sup, astreintes, gardes — souvent payés le mois
  suivant). V4 : **euros entiers** uniquement ; salaire par curseur 0–5 000 €
  (pas de 10 €) avec −/+ de 1 € (appui long qui accélère) et toucher sur le
  montant pour saisir ; compléments par curseur 0–3 000 € de la même façon ;
  dépenses avec −/+ (et saisie au toucher), sans curseur.
- Carte principale « À verser sur le compte commun » : contribution A,
  contribution B, total. Ces informations essentielles doivent apparaître dans
  le premier écran à 390 × 844 px.
- Sous la carte : détail du calcul repliable (ex. « B : 40 % × 3 000 € de
  salaire + 20 % × 675 € de compléments »), liste compacte des dépenses modifiables (ajouter, renommer,
  retirer), total des dépenses, puis le **solde du compte commun** (en ce
  moment, fin de mois prévue) à la place de « Reste après dépenses ».
- V4 — **Cases à cocher des paiements du mois** : virement d'AL fait,
  virement d'AC fait, chaque dépense payée (loyer, électricité…). Remises à
  zéro chaque mois. Cocher fait réagir le Sans-Visage, qui « mange »
  l'argent (il mâche les pépites, s'arrondit un peu) — toujours doux, jamais
  effrayant.
- Le salaire d'un nouveau mois est prérempli avec le salaire habituel de
  chacun, les compléments à 0. Ce sont des prévisions, jamais présentées
  comme des transactions bancaires constatées.

### 2. Historique

- Liste chronologique inverse des **seuls mois existants** : revenus,
  contributions, dépenses, report du mois (versements − dépenses).
- Appuyer sur un mois ouvre ce mois dans la vue « Ce mois », avec sa date
  clairement visible.
- Aucun historique fictif, aucun graphique en V1. Un état vide propre suffit.

### 3. Réglages

- Noms, salaire habituel de chacun (préremplit les nouveaux mois), et **deux
  taux communs au couple** (taux de base pour les salaires, taux au-delà pour
  les compléments).
- Dépenses récurrentes (ajouter, renommer, modifier, retirer).
- Réserve mensuelle par défaut.
- Export / import JSON (sauvegarde et transfert manuel).
- Explication brève : les valeurs par défaut s'appliquent aux **nouveaux** mois.
  Action explicite « Appliquer au mois affiché » pour les appliquer au mois
  courant.
- Dans l'app, parler simplement de « données enregistrées sur cet appareil ».
  Les informations techniques restent dans la documentation.

## Règles métier

- Montants en **centimes entiers** ; taux en **points de base entiers**
  (40 % = 4000). Interdits : NaN, Infinity, valeurs négatives, entiers hors
  plage sûre. Taux entre 0 et 10000.
- Chaque mois conserve sa propre copie des règles : modifier les réglages ne
  doit **jamais** recalculer silencieusement les mois existants. Les dépenses
  modifiées dans un mois n'altèrent pas les dépenses récurrentes.
- Mois courant déterminé dans le **fuseau local** de l'utilisateur (jamais UTC).
- Contribution individuelle (V3.1 ; chaque tranche arrondie séparément au
  centime, demi-centime vers le haut, puis addition) :

  ```
  baseContributionCents     = roundHalfUp(salaryCents × baseRateBps / 10000)
  variableContributionCents = roundHalfUp(bonusCents × variableRateBps / 10000)
  contributionCents         = baseContributionCents + variableContributionCents
  ```

  `salaryCents` = salaire du mois (entièrement au taux de base) ;
  `bonusCents` = compléments du mois (heures sup, astreintes, gardes). Les
  taux sont communs au couple. Le salaire habituel ne sert qu'à préremplir.

- Données d'avant V3.1 (modèle à seuil `min/max(salaire, salaire de base)`) :
  normalisées au chargement et à l'import en `salaire = min(salaire, base)`,
  `compléments = max(0, salaire − base)` — contributions strictement
  identiques, aucune valeur affichée ne change.

  Pour des entiers non négatifs sûrs : `floor((incomeCents × rateBps + 5000) / 10000)`.

- Agrégats :

  ```
  householdContributionCents = contributionA + contributionB
  expensesTotalCents         = somme des dépenses
  remainingCents             = householdContributionCents − expensesTotalCents
  leisureCents               = max(0, remainingCents − reserveTargetCents)
  ```

- Ne **jamais** masquer un net négatif : un mois déficitaire fait baisser le
  solde, affiché tel quel.
- La réserve (V1) est une somme que l'on souhaite mettre de côté **ce mois**,
  pas un solde bancaire existant. Elle reste dans les données mais n'est plus
  affichée.

## Solde du compte commun (V4, remplace le « reste »)

- **Report automatique** : chaque mois, le net (versements − dépenses,
  `remainingCents`) s'ajoute au solde estimé du compte commun.
- **« Recaler sur le compte »** : quand on regarde le vrai solde, on le
  saisit ; c'est une correction (solde au début du mois) qui **remplace le
  report à partir de ce mois**, sans réécrire les mois passés. Une correction
  par mois (la dernière remplace). Le montant peut être négatif.

  ```
  ouverture(K)   = dernière correction ≤ K, puis + net des mois connus jusqu'à K exclu
                   (sans correction : 0 au premier mois connu)
  en ce moment   = ouverture(K) + virements cochés − dépenses cochées
  fin de mois    = ouverture(K) + tous les versements − toutes les dépenses
  ```

- Un mois jamais ouvert compte pour 0. « Effacer l'historique » pose une
  correction sur le mois conservé pour garder le solde reporté.
- Détail : `docs/CONTRACTS.md` §2ter.

## Valeurs initiales

- Personne A : salaire habituel 2200 €. Personne B : salaire habituel
  3000 €. Taux communs 40 % / 20 %. Noms modifiables.
- Dépenses récurrentes : loyer + charges 1300 €, électricité 100 €, courses
  400 €, internet 30 €, assurance 15 €, autres 0 €. Total : 1845 €.
- Réserve initiale : 0 €.

## Résultats attendus (réserve nulle, dépenses 1845 €)

| Salaire A | Salaire B | Compl. B | Contrib. A | Contrib. B | Total commun | Net du mois |
|---|---|---|---|---|---|---|
| 2200 € | 3000 € | 0 € | 880 € | 1200 € | 2080 € | 235 € |
| 2200 € | 3000 € | 500 € | 880 € | 1300 € | 2180 € | 335 € |
| 2200 € | 3000 € | 675 € | 880 € | 1335 € | 2215 € | 370 € |
| 2200 € | 3000 € | 1000 € | 880 € | 1400 € | 2280 € | 435 € |

- Cas 3 avec réserve 500 € : loisirs = 0 €, réserve non couverte de 130 €.
- A à 1800 € (sous la base) : contribution A = 720 €.

## Saisie des montants

- **V4 : euros entiers.** Plus aucun centime ni en saisie ni à l'affichage
  (`formatEuros`, `parseEurosInput`). Les calculs internes restent exacts au
  centime ; l'affichage arrondit à l'euro (demi-euro vers le haut) avec des
  totaux cohérents (`roundEurosConsistent` : A + B affichés = total affiché).
  Les règles ci-dessous (V1, décimales) ne s'appliquent plus qu'à
  `parseAmountInput`, conservée pour compatibilité.
- Clavier décimal mobile ; formatage fr-FR/EUR hors édition.
- Accepter virgule ou point décimal, espaces français usuels lors d'un collage.
- Conversion déterministe en centimes ; **rejeter** une entrée ambiguë ou plus
  de deux décimales plutôt que de tronquer silencieusement.
- La chaîne en cours d'édition est séparée du montant valide. Vider un champ
  temporairement ne vaut pas zéro. Préserver curseur, focus et dernière valeur
  enregistrée. Une saisie invalide affiche un message local et ne change pas
  les calculs enregistrés. Zéro saisi explicitement reste valide.

## Micro-animations

- CSS uniquement, opacity/transform, ~140–220 ms : transition légère entre
  vues, pression douce sur un bouton, indication brève d'enregistrement,
  accent discret lorsqu'un résultat change.
- L'état correct et le montant final sont disponibles immédiatement.
- Pas de compteur qui défile, confettis, animation permanente, parallax, délai
  artificiel ni bibliothèque d'animation. Respecter `prefers-reduced-motion`.
- Ne pas animer la mise en page à chaque frappe ni provoquer de changement de
  hauteur inattendu.

## Stockage et protection des données

- `StorageAdapter` asynchrone minimal : `load(): Promise<PersistedState | null>`,
  `save(state): Promise<void>`. V1 : `LocalStorageAdapter` uniquement.
  Les composants n'appellent jamais `localStorage` directement.
- Clé dédiée : `a2-budget:state:v1`. Chargement avant toute sauvegarde ; un
  état initial vide ne doit jamais écraser les données au démarrage
  (notamment React StrictMode). Écritures sérialisées. Sauvegarde de chaque
  modification valide sans debounce fragile.
- Validation à l'exécution des données chargées/importées : version, types,
  plages, mois, identifiants, relations. JSON corrompu, version inconnue ou
  refus de stockage : pas de remise à zéro automatique ; préserver les données
  récupérables et proposer une action explicite.
- « Enregistré » uniquement après succès ; en cas d'erreur, indiquer que les
  modifications ne sont pas sauvegardées.
- Export JSON versionné, nom de fichier daté. Import validé et résumé avant
  confirmation de remplacement ; possibilité d'exporter les données courantes
  avant remplacement. Un fichier invalide ne modifie rien.
- Prévenir sobrement : effacer les données du navigateur peut supprimer
  l'historique ; le fichier exporté contient des données personnelles.
- **Ne jamais appeler `localStorage.clear()`** : ne supprimer que les clés de
  cette application.

## PWA et GitHub Pages

- `base: '/a2-budget/'` dans Vite. Manifest : name « A² Budget », short_name
  « Budget », start_url et scope `/a2-budget/`, display `standalone`, couleurs
  cohérentes. Toutes les ressources et l'enregistrement du service worker
  respectent ce sous-chemin.
- `vite-plugin-pwa` (mode `injectManifest`, SW custom `src/sw.ts`) : précache
  de l'interface et des assets locaux. Vraies icônes locales 192/512 + maskable
  + apple-touch-icon (pas de placeholders). `injectManifest.globPatterns`
  inclut `jpg`/`png` (forêt, avatars) pour le mode hors ligne ; le bloc
  `workbox.globPatterns` seul ne configure pas le manifest en mode
  `injectManifest`.
- Service worker limité à `/a2-budget/` ; caches préfixés `a2-budget` ; ne
  jamais effacer les caches des autres projets. Une mise à jour de l'application
  ne doit pas toucher au stockage financier.
- **Mise à jour volontaire** : le nouveau worker reste en attente (pas de
  `skipWaiting` automatique). Le bouton « Actualiser » envoie le message
  `SKIP_WAITING` (workbox-window `messageSkipWaiting`) ; le SW l'active alors
  (`skipWaiting()` du handler `message`). Sans ce handler, le bouton ne ferait
  rien.
- Proposition discrète « Mise à jour disponible » avec bouton d'application ;
  pas de rechargement automatique pendant une saisie. Disponibilité hors ligne
  annoncée seulement après préparation effective du cache.
- Vérifier le hors ligne sur le **build de production** (après premier
  chargement et activation du service worker). Le serveur de développement ne
  suffit pas. HTTP sur IP LAN = test d'interface seulement ; localhost ou HTTPS
  pour valider la PWA.
- CI GitHub Actions : installation lockfile figé, typecheck, tests, build ;
  déploiement Pages sur `main` uniquement si les vérifications réussissent ;
  une PR vérifie sans publier. Publication de `apps/web/dist`.

## Critère de réussite

Ouvrir l'app sur mobile, saisir A = 2200 € de salaire, B = 3000 € de
salaire + 675 € de compléments, lire
A = 880 €, B = 1335 €, total = 2215 €, dépenses = 1845 €, fin de mois prévue
= solde d'ouverture + 370 €, cocher un virement et voir le solde « en ce
moment » bouger,
modifier une dépense, fermer/rouvrir sans perte, puis utiliser l'application
hors ligne une fois son cache prêt. Les sauvegardes JSON et l'historique
fonctionnent aussi.
