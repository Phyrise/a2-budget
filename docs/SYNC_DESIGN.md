# A² Home — synchronisation à deux (conception V5)

**Document de conception (V4) ; implémentation V5 : §14 à §16.** Il remplace la piste «
Fastify + SQLite » de `FUTURE_SYNC.md` (serveur maison, tunnel) par une solution gratuite,
sans serveur et sans carte bancaire : Firebase (Auth Google + Cloud Firestore, offre Spark).
Pas à pas console : `docs/FIREBASE_SETUP.md`. Règles : `firestore.rules` (racine du dépôt),
testées sur l'émulateur par `pnpm test:rules`.

**Décisions d'Arthur pour la V5 (elles priment sur la suite du document)** :

- À l'arrivée, un écran d'accueil doux : « Se connecter avec Google » ou « Continuer en
  invité ». Choix mémorisé sur le téléphone, modifiable dans Réglages.
- **Invité** = l'app d'aujourd'hui, exactement : le SDK Firebase n'est jamais chargé, aucune
  requête vers Google/Firebase, les données locales ne sont jamais perdues.
- **Connexion** : liste blanche de deux comptes Google (rôle déduit de l'e-mail), un seul
  foyer `a2home`, pas d'invitation par code (§5.1). Un autre compte : « Ce compte n'est pas
  invité », déconnexion, retour à l'accueil.
- Sans configuration Firebase (`VITE_FIREBASE_*` absentes) : ni accueil ni Firebase.

Principes conservés (V3 §1) : hors ligne d'abord, cocher reste instantané, rien ne punit,
rien ne compare. Ajouté : chacun voit ce que l'autre fait, en douceur, et personne n'annule
les gestes de l'autre (sauf mode développeur).

## 1. Architecture

```
Téléphone AL (PWA, phyrise.github.io/a2-budget/)    Téléphone AC (idem)
  React + store (AppState, inchangé pour l'UI)        …
  └─ SyncBridge (nouveau, apps/web/src/sync/)
       ├─ Firebase Auth : connexion Google
       ├─ Firestore SDK web + cache persistant IndexedDB
       │    (persistentLocalCache + persistentMultipleTabManager)
       └─ file d'écritures hors ligne (gérée par le SDK)
                    │  HTTPS / WebChannel (temps réel)
                    ▼
   Cloud Firestore (offre Spark, base « (default) »)
     households/{hid}/…  — règles : seuls les 2 UID membres
                    ▲
   (option) Cloudflare Worker gratuit « a2-push » : Web Push VAPID (§8)
```

- **Hébergement** : GitHub Pages, inchangé (`base: '/a2-budget/'`). Aucun Firebase Hosting,
  aucune Cloud Function (elles exigent l'offre Blaze, donc une carte). Aucun Cloud Storage
  (même raison depuis fin 2024).
- **Configuration web publique** (`apiKey`, `authDomain`, `projectId`, `appId`…) : ce ne
  sont **pas** des secrets ; la sécurité vient des règles. Elle est fournie au build par
  `apps/web/.env.production` (variables `VITE_FIREBASE_*`, versionnées).
- **Drapeau** : sans `VITE_FIREBASE_PROJECT_ID`, l'app reste **100 % locale** et le SDK
  Firebase n'est jamais chargé (import dynamique, chunk à part). Avec la config : écran
  d'accueil (Google ou invité) ; en invité, même chose que sans config.
- **SDK** : `firebase` v12+ modulaire (`firebase/app`, `firebase/auth`, `firebase/firestore`
  ; jamais `firestore/lite`, qui n'a pas de hors ligne). ≈ 120–150 Ko gzip, chargés
  seulement en mode synchronisé, puis précachés par le service worker.
- **Foyer** : un seul, `a2home`, exactement 2 membres, chacun avec un rôle `a` (AL, Jiji) ou
  `b` (AC, Calcifer), **déduit de l'e-mail** (liste blanche, §5.1). Le rôle relie le compte
  Google aux `'a' | 'b'` déjà utilisés partout dans `@a2/core` (assignee, doneBy, addedBy…).

### 1.1 Connexion Google : le point délicat

`signInWithRedirect` casse quand `authDomain` (`<projet>.firebaseapp.com`) diffère du
domaine de l'app et que le navigateur bloque le stockage tiers (Safari 16.1+, Chrome 115+,
Firefox 109+). `signInWithPopup` marche dans un onglet, mais **pas dans une PWA installée
sur iPhone** (la fenêtre ne partage pas le stockage de l'app : la promesse ne se résout
jamais).

Stratégie retenue :

1. Navigateur classique, Android (même installé) : `signInWithPopup`.
2. PWA installée sur iPhone : **auto-hébergement du « helper »** Firebase (option 4 de la
   doc *redirect best practices*) : les fichiers `__/auth/handler`, `handler.js`,
   `experiments.js`, `iframe`, `iframe.js`, `links`, `links.js` et `__/firebase/init.json`
   sont servis à la **racine** de `phyrise.github.io` (dépôt de site utilisateur
   `phyrise.github.io`, avec `.nojekyll`, sinon GitHub ignore les dossiers commençant par
   `_`) ; `authDomain` devient `phyrise.github.io` ; `signInWithRedirect` redevient même
   origine. GitHub Pages sert `handler.html` pour `/__/auth/handler` (fichiers sans
   extension renommés en `.html`) — **à confirmer à l'étape 0** (§11). Les fichiers sont
   préparés par `apps/web/scripts/firebase-auth-helper.mjs <projectId>` (dossier
   `phyrise.github.io/` prêt à pousser, plus une copie brute à part : un fichier sans
   extension y serait servi comme un téléchargement). Les pages du helper chargent leurs
   scripts en relatif (`src="handler.js"`) : elles doivent rester dans `/__/auth/`.
3. Plan B si l'étape 0 échoue sur iPhone : **connexion anonyme Firebase + code
   d'invitation** (aucune fenêtre, aucun Google). Incompatible tel quel avec la liste
   blanche (un compte anonyme n'a pas d'e-mail) : il faudrait alors revenir à l'invitation
   (§5.1, « plus tard »). À rouvrir seulement si l'étape 0 échoue.

La session Firebase est persistée (`browserLocalPersistence`) : on se connecte une fois par
téléphone.

## 2. Modèle de données Firestore

Tout vit sous `households/{hid}`, avec `hid` = `a2home` (foyer unique ; la liste des
membres n'est pas dans la base mais dans les règles, §5.1). Les ids des documents sont **les
ids déjà générés par l'app** (`newId()`, UUID) : aucune traduction d'identifiant. Tout autre
chemin est refusé.

| Chemin | Nature | Contenu |
|---|---|---|
| `households/{hid}` | foyer | `names: { a, b }`, `schema`, `minApp` |
| `…/tasks/{id}` | objet | `HouseholdTask` |
| `…/completions/{id}` | **fait** | `ChoreCompletion` + `localDay`, `creditKey` |
| `…/skips/{id}` | **fait** | `ChoreSkip` |
| `…/forestEvents/{id}` | **fait** | `{ kind: 'pause'\|'resume', localDay, at }` |
| `…/focusSessions/{id}` | **fait** | `FocusSession` |
| `…/groceries/{id}` | objet | `GroceryItem` |
| `…/groceryHistory/{id}` | **fait** | `GroceryPurchase` (200 gardés) |
| `…/events/{id}` | objet | `CalendarEvent` |
| `…/months/{YYYY-MM}` | objet | `MonthRecord` (dépenses et paiements en **maps**, §2.3) |
| `…/balanceCorrections/{YYYY-MM}` | objet | `BalanceCorrection` (une par mois) |
| `…/circles/{id}` | objet | `Circle` ; V5.2 : une part par personne et par semaine, id `circle-<lundi>-<rôle>` (§18) |
| `…/settings/budget` | objet | `Settings` (dépenses récurrentes en map) |
| `…/settings/focus` | objet | `{ selectedLantern }` |
| `…/settings/groceryMemory` | objet | `{ memory: { clé: rayon } }` |
| `…/activity/{id}` | **fait** | fil des nouvelles (§7) |
| `…/checkpoints/{YYYY-MM-DD}` | dérivé | `ForestState` figé à ce jour (§3.3) |
| `…/meta/forestMilestones` | monotone | plus hauts stade / soins / déblocages vus |
| `…/memberState/{role}` | par personne (`a`\|`b`) | `{ activitySeenAt }` ; V5.2 : `circleSeen` (§18) |
| `…/push/{role}` | par personne | abonnement Web Push (option, §8) |

Unités inchangées : montants en **centimes** entiers (l'affichage à l'euro reste un rendu,
V4), dates « YYYY-MM-DD » locales, horodatages ISO. `selectedMonth` et toutes les
préférences d'interface restent **par téléphone** (jamais synchronisées).

### 2.1 Métadonnées communes

- Tous : `syncedAt` = `serverTimestamp()` à **chaque** écriture (curseur de synchronisation,
  §4.2), `updatedBy` = UID de l'auteur de l'écriture.
- Objets : `updatedAt` (ISO, horloge du téléphone, informatif) ; suppression **douce**
  `deletedAt` (heure serveur), purge définitive après 30 jours.
- Faits : `createdBy` (UID), `role` (`a`|`b`) ; annulation douce `undoneAt` (ISO),
  `undoneDay` (« YYYY-MM-DD »), `undoneBy` (rôle), `devOverride?: true` (§9). Un fait
  n'est **jamais** supprimé ni réécrit.

### 2.2 Faits en ajout seulement → forêt recalculable

Aujourd'hui, décocher **retire** la complétion et tombstone le crédit ; la forêt est un état
accumulé. En mode synchronisé, la forêt devient une **fonction pure des faits** :

```
forêt = replayForest(dernierCheckpoint, faits postérieurs, aujourd'hui)
```

Événements rejoués, triés par `(jour, horodatage, id)` :

- complétion → `grantCredit(creditKey, localDay)`, puis `updateStreak`,
  `evaluateRareEvents`, `evaluateUnlocks` (exactement `toggleTaskToday`) ;
- annulation (`undoneAt`, au jour `undoneDay`) → `tombstoneCredit` ;
- pause / reprise → `pauseForest` / `resumeForest` ;
- chaque jour franchi → `advanceDay` (décroissance douce, idempotent).

Les deux téléphones ayant les mêmes faits obtiennent **la même forêt**, quel que soit
l'ordre d'arrivée. Le plafond de 3 crédits/jour reste déterministe : AL et AC cochent chacun
2 tâches hors ligne le même jour → après fusion, 3 crédits, attribués dans l'ordre
`(localDay, completedAt, id)`. `localDay` est figé par l'auteur (pas recalculé dans le
fuseau du lecteur). Une recomplétion après annulation crée un **nouveau** fait (nouvel id) :
la clé de crédit est déjà tombstonée → aucun crédit (inchangé).

**La croissance ne diminue jamais**, même après fusion : le seul cas où un rejeu donne moins
que ce qu'un téléphone a affiché est une pause posée par l'un pendant que l'autre cochait
hors ligne. `meta/forestMilestones` garde le maximum vu (stade, `lifetimeCare`, ids
débloqués, plus long streak) ; chaque téléphone y écrit `max(local, distant)` (règle :
jamais en baisse) ; l'affichage prend `max(rejeu, jalons)`. La vitalité (court terme) peut,
elle, s'ajuster doucement : c'est voulu.

### 2.3 Objets : « dernier qui écrit gagne », champ par champ

Écritures par `updateDoc` avec **seulement les champs modifiés** : deux modifications de
champs différents se combinent (AL change le titre, AC l'effort → les deux restent). Même
champ : la dernière écriture **arrivée au serveur** gagne (une modification hors ligne
arrive à la reconnexion).

Les tableaux sont remplacés en bloc par Firestore ; on les transforme donc en maps quand
deux personnes peuvent toucher des éléments différents :

- `months/{m}.expenses` → `{ [expenseId]: { label, amountCents, order } }` ;
- `months/{m}.paid` → `{ transferA, transferB, expenses: { [id]: true } }` ;
- `settings/budget.recurringExpenses` → map, même forme ;
- `settings/groceryMemory.memory` → map ; les clés (libellés normalisés, accents, espaces)
  passent par `new FieldPath('memory', clé)`, jamais par une chaîne pointée.

Suppression contre modification : la suppression douce gagne (un `deletedAt` n'est retiré
que par « Annuler » explicite, ex. `restoreGrocery`, `restoreCalendarEvent`).

## 3. Lien avec le store existant

### 3.1 SyncBridge par différence (aucune action réécrite)

Les ~30 actions de `useApp()` restent **inchangées** (transitions pures sur `AppState`). Le
pont observe chaque transition **locale** `prev → next` et la traduit en écritures Firestore
par une fonction pure et testée `diffToOps(prev, next, ctx)` :

| Différence | Écriture |
|---|---|
| tâche / article / événement / cercle ajouté ou champs changés | `set` ou `update` des champs |
| objet retiré | `deletedAt` |
| complétion ou « pas aujourd'hui » ajouté | création du fait |
| complétion ou « pas aujourd'hui » retiré | `undoneAt` sur le fait |
| article passé du panier à l'historique | `deletedAt` + fait `groceryHistory` (même lot) |
| `forest.paused` basculé | fait `forestEvents` |
| autres champs de `forest` | rien (dérivés) |

Les changements **distants** arrivent par les écouteurs, sont projetés en `AppState`
(`projectState(docs, today)`, pure) et appliqués au store avec l'origine `remote` : ils ne
repassent jamais par `diffToOps` (pas d'écho). En mode synchronisé, après toute transition,
`forest` est recalculée par `replayForest` (même résultat que la transition locale quand
rien d'autre n'a changé) ; animations et lucioles partent du résultat local immédiat.

### 3.2 Domaine (`@a2/core`, nouveaux modules purs)

`replayForest`, `creditKeyFor` exporté, `projectState`, `diffToOps`, conversions
`MonthRecord ⇄ doc` (maps), validation des docs entrants (réutilise `validateAppState` sur
la projection : un doc invalide est ignoré et signalé, jamais propagé).

### 3.3 Points de reprise de la forêt

Rejouer des années de faits à chaque ouverture serait lent. Le premier jour de chaque mois,
si le jour J = dernier jour d'il y a deux mois n'a pas de point de reprise, un téléphone
écrit `checkpoints/{J}` = forêt rejouée jusqu'à J (déterministe : si les deux l'écrivent, le
contenu est identique). Chaque point porte `day` = son id ; la genèse (§6) porte en plus
`genesis: true` et n'est jamais supprimée. Un fait arrivé après coup avec `localDay ≤ J`
(téléphone hors ligne plus de 30 jours) reste dans l'historique et la répartition mais
n'affecte plus la forêt. On garde la genèse et les 3 derniers.

## 4. Hors ligne, temps réel et quotas

### 4.1 Persistance

`initializeFirestore(app, { localCache: persistentLocalCache({ tabManager:
persistentMultipleTabManager() }) })` : lectures hors ligne, écritures mises en file et
**conservées au rechargement**, plusieurs onglets cohérents. Le store garde en plus sa copie
`localStorage` (premier affichage instantané) sous une **clé distincte** `a2-budget:sync:v1`
: la clé locale `a2-budget:state:v1` n'est jamais écrasée par la synchro.

### 4.2 Écouteurs « delta » (indispensable pour les quotas)

Un écouteur Firestore rouvert après plus de 30 minutes est facturé comme une nouvelle
requête : **chaque document** du résultat est relu. Écouter toutes les complétions (≈ 3 500
par an) à chaque ouverture coûterait plus de 100 000 lectures par jour en un an — au-delà du
quota gratuit.

Donc :

1. Au démarrage : projection depuis le cache local (`getDocsFromCache`, gratuit) et la copie
   `localStorage`.
2. Un écouteur par collection : `where('syncedAt', '>', curseur − 2 min)`. Seuls les
   documents écrits depuis le dernier passage sont lus. Le curseur = plus grand `syncedAt`
   reçu du serveur (jamais d'une écriture en attente), gardé dans `a2-budget:sync:v1`. Le
   chevauchement de 2 minutes est sans risque (application idempotente).
3. Resynchronisation complète si : curseur absent, plus vieux que 25 jours (les suppressions
   douces sont purgées à 30), cache IndexedDB vidé (le doc `households/{hid}` n'est plus en
   cache), ou `schema` du foyer changé.

Les suppressions sont toujours douces, donc visibles par ces écouteurs.

### 4.3 Estimation par jour (2 téléphones, usage soutenu)

Hypothèses : 15 ouvertures par jour et par personne espacées de plus de 30 min ; 120 actions
par jour pour le foyer (20 tâches, 40 gestes de courses, 5 budget, 3 calendrier, 30
nouvelles, 20 divers).

| Poste | Lectures | Écritures |
|---|---|---|
| 30 ouvertures × 16 écouteurs (1 lecture minimum par requête) | 480 | — |
| chaque écriture relue par les 2 téléphones | 240 | 120 |
| `get()` des règles (aucun : la liste blanche est dans les règles) | 0 | — |
| fil des nouvelles, curseurs, jalons | 60 | 40 |
| **Total** | **≈ 780 (1,6 % de 50 000)** | **≈ 160 (0,8 % de 20 000)** |

Stockage : ≈ 400 o par fait → ≈ 2 Mo par an (quota : 1 Gio). Sortie réseau : quelques Mo par
mois (quota : 10 Gio). Migration initiale (§6) : une seule fois, ≈ 1 000 à 3 000 écritures.
Une resynchronisation complète (rare) relit tout : ≈ 5 000 lectures la première année. Marge
confortable ; un compteur discret du mode développeur affiche les lectures de la session.

Limites Spark à respecter : 50 000 lectures, 20 000 écritures et 20 000 suppressions par
jour, 1 Gio stocké, 10 Gio/mois sortants, une seule base gratuite par projet, ni TTL, ni
sauvegardes, ni PITR (payants). Dépassement : les requêtes échouent jusqu'à minuit (heure du
Pacifique), **sans facture**.

## 5. Sécurité

Règles complètes : `firestore.rules` (à coller dans la console, `FIREBASE_SETUP.md` §4),
testées par `pnpm test:rules` (`tests/rules`). En résumé :

- Membre = compte connecté dont l'e-mail (en minuscules) est dans la liste blanche **et**
  `email_verified == true` ; seul le foyer `a2home` existe. Aucun `get()` (lectures
  épargnées). Tout autre chemin (`users/`, `invites/`…) est refusé.
- Chaque écriture doit porter `updatedBy == request.auth.uid` et `syncedAt == request.time`
  (curseur fiable, auteur vérifié).
- Faits : création seulement, signée (`createdBy` = son UID, `role` = son rôle d'après
  l'e-mail), jamais déjà annulée ; une seule mise à jour possible, l'annulation (`undoneAt`
  texte, `undoneDay` « YYYY-MM-DD », `undoneBy` = soi, `devOverride`) ; annuler le fait de
  l'autre exige `devOverride: true` (la trace du mode développeur, §9) ; jamais supprimés
  (sauf `groceryHistory` et `activity`, élagués).
- Objets : jamais créés supprimés ; `deletedAt` = heure du serveur ; purge définitive
  seulement 30 jours après `deletedAt`.
- `checkpoints/{jour}` : `day` = id ; le drapeau `genesis` ne change pas ; la genèse ne se
  supprime pas. `meta/forestMilestones` : forme complète, aucune valeur ne peut baisser.
- `memberState/{role}`, `push/{role}` : écrits seulement par la personne de ce rôle.

### 5.1 Qui entre : la liste blanche (V5)

Deux comptes Google, écrits en dur à deux endroits qui disent la même chose (un test le
vérifie) : le bloc « liste blanche » en tête de `firestore.rules` (la vraie protection) et
`apps/web/src/sync/allowlist.ts` (le client refuse gentiment avant la base).

| E-mail | Rôle |
|---|---|
| `arthur.longuefosse@gmail.com` | `a` (AL) |
| `alexia.chaval@free.fr` | `b` (AC) |

N'importe quel compte Google peut se connecter au projet (Firebase Auth ne filtre pas) ; un
autre compte voit « Ce compte n'est pas invité », il est déconnecté, et la base lui refuse
tout. Le premier membre connecté crée `households/a2home` ; il n'y a rien à rejoindre.

**Plus tard, « par paire »** (plusieurs foyers) : seuls ce bloc des règles et `allowlist.ts`
changent — par exemple l'invitation à usage unique (code de 8 caractères, valable 48 h,
`invites/{code}` consommé dans le même lot que l'ajout au foyer, vérifié par `exists` /
`existsAfter`), avec `memberUids` dans le foyer et un `get()` par requête.

## 6. Migration depuis le localStorage

1. **Sauvegarde d'abord** : sur chaque téléphone, export JSON automatique (format actuel,
   `exportImport.ts`) proposé au téléchargement, plus copie `a2-budget:backup-pre-sync` dans
   `localStorage`.
2. **Téléphone de référence** (celui dont les données sont les plus complètes ; l'écran
   montre les deux résumés `ImportSummary` pour choisir) : crée le foyer et envoie son état,
   par lots de 450 écritures au plus (limite d'un lot : 500), avec reprise si coupure (ids
   stables → relancer est idempotent ; un doc `meta/migration` note l'avancement).
   - complétions et « pas aujourd'hui » existants → faits marqués `imported: true` ;
   - forêt actuelle → `checkpoints/{jour de migration}` (`genesis: true`) = `ForestState`
     tel quel (les crédits déjà tombstonés n'ont plus de fait : on part de l'état, on ne le
     reconstruit pas) ; les faits importés sont antérieurs au point de reprise, donc jamais
     rejoués ;
   - `meta/forestMilestones` initialisé depuis cette forêt.
3. **Second téléphone** : se connecte (liste blanche) ; ses données locales ne sont **pas
   fusionnées** (deux historiques indépendants créeraient des doublons de tâches et
   fausseraient la forêt). Elles restent intactes sous `a2-budget:state:v1` et dans l'export
   ; un écran propose d'ajouter à la liste commune ses articles de courses non cochés (seul
   ajout utile).
4. **Se déconnecter** : retour au mode local avec, au choix, la dernière copie synchronisée
   ou les anciennes données locales.

## 7. Notifications gratuites dans l'app (recommandé)

Collection `activity` : un fait écrit **dans le même lot** que l'action, seulement pour les
gestes qui intéressent l'autre :

| `kind` | Exemple affiché |
|---|---|
| `circle` | « AC a écrit dans le cercle » |
| `thanks` | « AL te dit merci » |
| `task-done` | « AC a arrosé les plantes » (tâches assignées à l'autre ou à deux) |
| `grocery-added` | « AL a ajouté 3 articles aux courses » (groupés par 10 min) |
| `event` | « AC a ajouté Dîner chez Léa, samedi » |
| `lantern` | « AL a allumé la lanterne 15 min » |
| `budget` | « AC a recalé le solde » / « virement d'AL fait » |
| `join` | « AC a rejoint le foyer » |

- Temps réel (écouteur delta) : petit toast doux, au plus un par type toutes les 10 minutes,
  jamais pendant une animation ; aucun son.
- Badge : pastille discrète sur l'onglet concerné + feuille « Nouvelles » (depuis l'en-tête)
  ; « vu » = `memberState/{role}.activitySeenAt`.
- Une complétion distante fait arriver une luciole dans la forêt.
- Jamais de nouvelle négative (« AC n'a pas fait… »), jamais de compteur comparatif (V3 §1).
- Conservation : 90 jours, élagués par n'importe quel téléphone.

## 8. Option Web Push (Cloudflare Worker, gratuit, sans carte)

Pour être prévenu **app fermée**. Faisabilité :

- **iPhone** : Web Push seulement pour une PWA **ajoutée à l'écran d'accueil** (iOS/iPadOS
  16.4+), permission demandée après un geste explicite ; pas de push silencieux (chaque push
  doit afficher une notification) ; abonnements parfois révoqués par iOS (réabonnement à
  l'ouverture). iOS 18.4+ accepte aussi le *Declarative Web Push*.
- **Android / ordinateur** : Chrome, Firefox, Edge ; fonctionne aussi dans un onglet.
- **Gratuit sans carte** : Cloud Functions et l'envoi FCM côté serveur supposent Blaze ou
  une clé de compte de service (pouvoir d'administration sur le projet) — écartés. Un
  **Cloudflare Worker** (plan Free : 100 000 requêtes/jour, 10 ms de CPU par requête,
  inscription sans carte) envoie directement en Web Push signé VAPID (ECDH, HKDF, AES-GCM,
  ES256 : WebCrypto natif, quelques ms).

Fonctionnement, **sans aucun stockage côté Worker** : chaque téléphone enregistre son
`PushSubscription` dans `households/{hid}/push/{role}`. Après une écriture d'`activity`, le
client appelle `POST /notify { hid, activityId }` avec son jeton d'identité Firebase. Le
Worker vérifie le jeton (RS256, `aud` = projet, `iss` = securetoken), relit **avec ce même
jeton** via l'API REST Firestore le foyer, l'activité et l'abonnement de l'autre (les règles
prouvent l'appartenance au foyer : le Worker n'a aucun droit propre), compose le texte
lui-même et envoie. Seul secret : la clé privée VAPID (`wrangler secret put`). Hors ligne :
l'appel part à la reconnexion.

**Recommandation** : V5 avec les nouvelles dans l'app seulement ; Web Push en V5.1, si
l'envie est là après quelques semaines, en commençant par « cercle » et « merci ».

## 9. Historique et mode développeur

| Donnée | Conservation |
|---|---|
| complétions, « pas aujourd'hui », pauses, lanternes, cercles, mois, corrections de solde, événements | indéfiniment (faits ; la projection garde les plafonds actuels de `@a2/core`, ex. 500 sessions, déjà sans effet sur les déblocages) |
| historique des courses | 200 achats (`GROCERY_HISTORY_MAX`) ; au-delà, élagués |
| mémoire des rayons | 500 entrées (`GROCERY_MEMORY_MAX`) |
| nouvelles (`activity`) | 90 jours |
| objets supprimés | 30 jours, puis purgés |
| points de reprise | genèse + 3 derniers |

Pas de sauvegarde serveur sur Spark : chaque téléphone détient une copie complète (cache),
et un rappel mensuel doux propose l'export JSON.

**Annuler une action de l'autre** : impossible dans l'usage normal (on ne décoche que ses
propres complétions ; l'élément de l'autre affiche « fait par AC »). En **mode développeur**
(préférence existante), la feuille « Nouvelles » montre « Annuler » sur les gestes de
l'autre : l'annulation pose `undoneAt` avec `devOverride: true` et crée une nouvelle « AL
(mode développeur) a annulé… », visible des deux. Les règles autorisent techniquement les
deux membres (confiance mutuelle, règles simples) : la retenue est dans l'interface, la
trace dans les données.

## 10. Conflits, horloges, versions

- **Horloges** : l'ordre de synchronisation utilise l'heure du serveur (`syncedAt`) ; le
  jour d'une action reste celui de l'auteur (`localDay`). Une horloge fausse ne change que
  l'ordre intra-journée, identique sur les deux téléphones (même tri, même départage par
  id).
- **Deux cochent la même tâche hors ligne** : deux faits pour la même occurrence ; la
  projection garde le premier (`completedAt`, puis id) comme complétion, l'autre devient «
  fait ensemble » (`doneBy: 'both'`) dans la répartition ; un seul crédit (même clé).
- **Même article coché par les deux** : même valeur, aucun conflit.
- **Nouveau mois créé sur les deux téléphones** (ouverture le 1er) : les dépenses copiées
  gardent les ids des dépenses récurrentes, donc mêmes clés. La création passe par une
  transaction « créer si absent » ; hors ligne, le mois reste local jusqu'à la reconnexion,
  puis seules les modifications faites à la main (différence avec les valeurs par défaut)
  sont envoyées si l'autre l'a déjà créé — jamais d'écrasement par les valeurs par défaut.
- **Deux recalages du solde le même mois** : même doc `{YYYY-MM}`, le dernier arrivé gagne
  (c'est le plus récent regard sur le compte).
- **Versions d'app différentes** : `households.schema` et `minApp` ; un téléphone trop
  ancien passe en lecture seule et propose la mise à jour du service worker. Les `updateDoc`
  partiels préservent les champs inconnus d'une version plus récente.

## 11. Tests (sans compte Firebase)

- **Domaine** (Vitest, `pnpm test`) : `replayForest` — toutes les permutations d'arrivée des
  faits donnent la même forêt ; plafond, pause, annulation, recomplétion, jalons jamais en
  baisse ; `diffToOps` / `projectState` aller-retour ; maps des mois.
- **Règles** (fait, branche `v5/prep`) : `firebase-tools` et `@firebase/rules-unit-testing`
  en devDependencies de la racine (`npx firebase`), `firebase.json` + `.firebaserc`, projet
  `demo-a2home` (préfixe `demo-` : aucun compte, aucune ressource réelle). Java **21+**
  requis par l'émulateur : `scripts/install-java.sh` pose un JRE Temurin dans
  `~/.cache/a2home/java-21` (ni sudo, ni Homebrew : sur Mac Intel, Homebrew recompilerait
  une trentaine de dépendances) ; `scripts/with-java.sh` le trouve. `pnpm test:rules` =
  `firebase emulators:exec --only firestore … "vitest run -c vitest.rules.config.ts"`, hors
  de `pnpm test` ; `pnpm emulators` = Auth + Firestore pour le développement (ports dans
  `firebase.json` : Firestore 8180, Auth 9180, interface 4180). Cas : inconnu, non vérifié,
  anonyme, autre foyer refusés ; membres et minuscules acceptés ; rôle usurpé, fait réécrit,
  `syncedAt` falsifié, jalons en baisse, genèse supprimée refusés (chaque condition des
  règles est couverte : la retirer fait échouer un test).
- **Liste blanche** (`pnpm test`) : `allowlist.test.ts` compare le client à
  `firestore.rules`.
- **QA bout en bout** (`apps/web/scripts/qa-sync.mjs`) : Playwright, deux contextes = deux
  téléphones, émulateurs, connexion par faux jeton Google de l'émulateur Auth,
  `context.setOffline(true)` pour les scénarios hors ligne (cocher des deux côtés, fusion,
  forêt identique). Fait : voir §17.

## 12. Plan V5 par étapes

0. **Essai de connexion sur le vrai téléphone** (une soirée) : page minimale déployée,
   Google via popup puis via helper auto-hébergé, PWA installée. Décide du chemin (§1.1).
   Rien d'autre ne commence avant.
1. **Domaine** : `replayForest`, faits annulables, maps, jalons + tests.
2. **Pont** : `diffToOps`, `projectState`, clés `a2-budget:sync:v1`, mode local intact
   (tests sans Firebase).
3. **Firebase** : init paresseuse, écran d'accueil (Google ou invité), Auth, liste blanche ;
   règles + `test:rules` (faits en avance : `v5/prep`).
4. **Migration** : sauvegardes, envoi par lots avec reprise, écran de choix.
5. **Temps réel** : écouteurs delta, resynchronisation, indicateur discret (« à jour », «
   hors ligne — tout est gardé »).
6. **Nouvelles** : `activity`, toasts, badges, annulation mode dev.
7. **QA deux téléphones**, déploiement, configuration d'Arthur (`FIREBASE_SETUP.md`).
8. (V5.1, option) **Web Push** via Cloudflare Worker.

## 13. Risques

| Risque | Parade |
|---|---|
| Connexion Google dans la PWA iPhone | étape 0 ; helper auto-hébergé (`firebase-auth-helper.mjs`) ; plan B à rouvrir (§1.1) |
| Quotas de lecture | écouteurs delta, pas d'écouteur sur collection entière, compteur dev |
| Cache IndexedDB effacé | détection → resynchronisation complète ; copie `localStorage` |
| Données perdues (pas de sauvegarde Spark) | 2 copies complètes, export JSON, faits jamais supprimés |
| Règles trop permissives / bloquantes | tests émulateur obligatoires avant publication |
| Forêt différente sur les deux téléphones | rejeu déterministe testé par permutations, jalons monotones |
| Ancien build en cache | `minApp`, lecture seule, invite de mise à jour |
| Dépôt public GitHub Pages | aucune donnée dans le dépôt ; config web publique par nature |

## 14. Implémentation — étapes 1 et 2 (domaine et pont, sans Firebase)

Domaine : `packages/core/src/sync/` (`DOMAIN_CONTRACTS.md` §15). Pont :
`apps/web/src/sync/`, jamais importé par l'app en mode local (invité).

- **Documents** (`docs.ts`, `entities.ts`) : une collection par liste de
  l'état, ids existants, rang `order` sur chaque document de liste (tri
  `(order, id)`, aller-retour exact). Documents uniques `settings/budget`
  (+ `balanceTracked` : le solde existe même sans correction),
  `settings/focus`, `settings/groceryMemory` (`memory: { clé: { category,
  order } }` : l'ordre de récence survit au tri des clés de Firestore),
  `settings/anniversaries`. Une liste facultative vide vaut « absente ».
- **Écritures** (`WriteOp`) : `create` (créer si absent : nouveaux objets,
  mois du 1er), `set` (restauration après suppression douce, recalage du
  solde : le dernier gagne), `update` (champs feuille par feuille, chemins en
  segments, `DELETE_FIELD`), `merge` (documents uniques), `raise` (jalons).
  Le transport Firestore devra traduire `create` par une transaction « créer
  si absent » (en ligne) et `raise` par une transaction max.
- **Faits** : `undoneBy` porte le rôle (`'a'|'b'`) ; l'UID de l'auteur est
  posé par le transport (`updatedBy`). Une annulation se pose une fois, par
  l'auteur du fait (§16).
- **Projection** (`project.ts`) : un cercle par semaine (le plus récent),
  plafonds de `@a2/core`, validation complète ; en cas d'échec chaque
  document est éprouvé seul, l'invalide est ignoré et signalé.
- **Tests** : aller-retour (y compris clés triées comme Firestore),
  `diffToOps` minimal et « projection = état local » pour chaque geste,
  deux téléphones sur un faux serveur (`MemoryServer` / `MemoryTransport`,
  règles essentielles, hors ligne, deux ordres de reconnexion).
- Copie locale du mode synchronisé : `a2-budget:sync:v1` (`syncCache.ts`),
  jamais `a2-budget:state:v1`.

## 15. Implémentation — étape 3 (connexion)

Branche `v5/sync`. Sans configuration, rien ne change (ni accueil, ni chunk
Firebase) ; le store n'est pas encore branché sur `SyncEngine`.

- **Chargement** (`apps/web/src/sync/firebase/`) : `config.ts` lit les
  `VITE_FIREBASE_*` (apiKey, authDomain, projectId, appId obligatoires) ;
  `FIREBASE_ENABLED` est une constante du build. `loader.ts` est le seul
  `import()` vers `sdk/`, seul dossier qui importe `firebase/*` :
  `client.ts` (Auth `browserLocalPersistence` + résolveur popup/redirection,
  Firestore `persistentLocalCache` + `persistentMultipleTabManager`,
  émulateurs), `session.ts`, `household.ts`. Gardes :
  `firebaseImports.test.ts` (sources) et `scripts/check-firebase-split.mjs`
  après chaque build (sans config : aucun Firebase ; avec config : Firebase
  seulement derrière un import dynamique ; porte de QA seulement dans le
  build émulateurs).
- **Compte** (`apps/web/src/account/`) : machine d'état pure
  (`accountModel.ts`), choix mémorisé `a2-budget:account:v1` =
  `{"entry":"guest"|"google"}` (`accountChoice.ts`, jamais synchronisé),
  fournisseur (`AccountContext.tsx`, valeur locale fixe sans config), porte
  (`AccountGate.tsx` : l'accueil tant qu'aucun choix, l'app n'est pas montée
  derrière), `Welcome.tsx`, Réglages › Compte (`AccountPanel.tsx`).
- **Connexion** : fenêtre partout ; redirection dans l'app installée sur
  iPhone/iPad, seulement si `authDomain` est l'hôte de la page (helper
  auto-hébergé), sinon le mot « bientôt ». Le SDK se charge au toucher du
  bouton ; s'il est déjà là, la fenêtre s'ouvre dans le geste même.
- **Liste blanche** : `accountVerdict` ; un autre compte (ou une adresse non
  vérifiée) est déconnecté aussitôt, l'accueil revient avec son mot, rien
  n'est mémorisé ni écrit.
- **Foyer** : transaction « créer si absent » au premier passage d'un
  membre : `households/a2home` (`names`, `schema`, `minApp`, `createdAt`,
  `createdByRole`) et `memberState/{rôle}` (`uid`, `joinedAt`), avec
  `updatedBy`/`syncedAt`. Réessayée au retour du réseau.
- **QA** : `pnpm --filter @a2/web build:emu` (mode `emulators`,
  `.env.emulators`, `dist-emu/`) ; `window.__a2qa.signInAs(email,
  vérifié)` = faux jeton Google de l'émulateur Auth (build émulateurs et
  page locale seulement) ; `pnpm --filter @a2/web e2e:sync`
  (`playwright.sync.config.ts`, `e2e-sync/`, émulateurs lancés s'il le faut).
- **Invité** : aucune requête vers Google/Firebase (vérifié en e2e). Le
  service worker précache le chunk `session-*.js` comme le reste du build
  (même origine, jamais exécuté en invité) pour que la connexion marche
  hors ligne une fois membre.

**Écarts entre `firestore.rules` (v5/prep) et le pont (v5/domaine)** :
réglés à l'étape synchro (§16).

## 16. Implémentation — étapes 4 et 5 (migration, temps réel)

Branche `v5/sync`. Le store est branché ; sans configuration ou en invité,
rien ne change (aucun code de synchronisation exécuté, aucun chunk chargé).

- **Écarts réglés** (règles, `tests/rules`, pont) : (1) `undoneBy` = le
  **rôle** (`a`|`b`), comme `role` ; l'UID reste dans `updatedBy`. (2)
  Une annulation se pose une fois : le plan d'envoi n'annule pas un fait déjà
  annulé dans la vue et met chaque annulation dans son propre lot (un refus
  n'emporte rien d'autre). (3) **On ne décoche que ses propres gestes** :
  `diffToOps` n'annule que les faits de son rôle ; « fait ensemble »
  redevient « fait par l'autre » ; l'app ne décoche pas le geste de l'autre
  (« C'est AC qui l'a cochée. ») ; le rejeu ne tombstone la clé qu'avec le
  dernier fait vivant. Annuler le geste de l'autre reste le mode développeur
  (`devOverride`, §9, étape 6).
- **Créer si absent sans transaction** (marche hors ligne) : un objet créé
  porte un jeton `creationId` ; les règles (`keepsCreation`) refusent de le
  recréer par-dessus (mois ouvert le 1er sur les deux téléphones) ; la
  création d'un mois part seule, ses modifications ensuite s'appliquent
  champ par champ sur le mois de l'autre. Restauration : le jeton est gardé ;
  recalage du solde : pas de jeton (le dernier gagne).
- **Plan d'envoi** (`sync/writePlan.ts`, pur, utilisé aussi par le faux
  transport) : document connu → pas de recréation ; à part : annulations,
  création d'un mois, jalons (maximum avec la vue), mise à jour d'un
  inconnu ; le reste par lots de 450 au plus, dans l'ordre.
- **Transport** (`sync/firebase/sdk/transport.ts`) : vue = cache du SDK
  (`getDocsFromCache`, gratuit) ou tout relire (`needsFullResync` : jamais
  relu, cache vidé — `households/a2home` absent du cache —, 25 jours, modèle
  changé) ; écouteurs delta, un par collection,
  `orderBy('syncedAt') + startAfter(curseur − 2 min)` : une **borne** et non
  un filtre `where`, pour que les écritures en attente (heure du serveur
  inconnue, rangée en dernier par le SDK) restent dans le résultat hors
  ligne. Curseurs par collection, avancés seulement par des documents
  confirmés (`fromCache` faux, sans écriture en attente). Un document sorti
  du résultat (lot refusé) est relu dans le cache. Écouteurs relancés après
  25 minutes d'absence. Vue locale (`sync/localView.ts`) = reçu + lots en
  attente, visibles tout de suite (le geste suivant voit le précédent).
- **Runtime** (`sdk/runtime.ts`) : transport + `SyncCore` (moteur, plusieurs
  écouteurs, `canUndo`) ; copie `a2-budget:sync:v1` (état projeté, curseurs,
  `syncedAt`, `schema`) enregistrée 400 ms après chaque changement et en
  quittant la page ; statut `synced` / `syncing` / `offline` / `error`.
- **Store** : `AppProvider sync={SyncLink}` (`sync/syncLink.ts`, bundle
  principal). Chaque transition locale est calculée une fois et confiée au
  lien (`prev → next`) ; l'état projeté qui revient remplace celui du store.
  Premier affichage depuis la copie locale ; les gestes faits avant que la
  synchronisation soit prête partent en une fois au branchement. Jour qui
  change : la forêt est rejouée par le moteur. Import et « Tout effacer »
  absents en copie commune. `me` = rôle connecté (null en invité).
- **Qui a fait quoi** : le rôle connecté signe les gestes sans réponse —
  tâche « libre » cochée (`doneBy`), article ajouté (`addedBy`), « pas
  aujourd'hui » (`by`) ; la lanterne présélectionne la personne (le choix
  reste). Une tâche confiée à quelqu'un garde « comme prévu » ; le menu ⋯
  garde le choix manuel.
- **Première connexion** (`account/SyncSetup.tsx`, `sdk/setup.ts`) : copie
  `a2-budget:backup-pre-sync` d'abord (+ « Garder une copie de mes données
  », export JSON). `meta/migration` (`running` / `done`, rôle, heure) :
  vide → « Y mettre mes données » (réclamé par transaction, ce qui est déjà
  sur le serveur est relu et sauté, lots de 450 avec progression) ; envoi de
  ce rôle interrompu → « Reprendre l'envoi » ; sinon → « La rejoindre »
  (rien n'est fusionné, les données du téléphone restent à part). Puis tout
  est relu du serveur une fois, la copie commune s'affiche.
- **Mode** (`account/syncMode.ts`, `SyncContext.tsx`) : `local` (invité,
  sans config), `setup`, `sync` (copie présente). Le store est remonté quand
  le mode change.
- **Déconnexion** : « Garder sur ce téléphone : la copie commune / mes
  données d'avant » (`state/localCopies.ts`) ; la copie commune remplace
  `a2-budget:state:v1` seulement après avoir mis l'ancienne de côté
  (`a2-budget:backup-before-switch`, sauf si déjà dans `backup-pre-sync`).
  La copie `a2-budget:sync:v1` reste : se reconnecter rouvre directement la
  maison commune.
- **Indicateur** (`app/SyncIndicator.tsx`) : un petit nuage dans l'en-tête ;
  le mot (« À jour », « Hors ligne — tout est gardé ») en bulle un instant ;
  seuls hors ligne et la pause sont annoncés au lecteur d'écran.
- **Tests** : unitaires (plan d'envoi, vue locale, curseurs, lien store,
  migration par lots et reprise, mode, copies locales, rejeu « fait
  ensemble ») ; règles (30) ; e2e émulateurs (`e2e-sync/sync.spec.ts`) :
  première connexion avec sauvegarde, écouteurs delta vérifiés sur le
  réseau, deux téléphones en temps réel et après rechargement, hors ligne
  (geste gardé au rechargement puis envoyé), qui a fait quoi, déconnexion
  au choix.

Reste : nouvelles (`activity`, étape 6), points de reprise mensuels (§3.3 :
seule la genèse est écrite), purge des objets supprimés, lecture seule si
`minApp` dépasse le build, offre d'ajouter ses articles de courses au
second téléphone (§6.3).

## 17. QA « deux téléphones »

`node apps/web/scripts/qa-sync.mjs [port] [--all] [--no-build]` : build
émulateurs puis `e2e-sync/qa-two-phones.spec.ts` (aides : `e2e-sync/phones.ts`).

- Temps réel dans les deux sens : tâche (créée, cochée), article de courses,
  événement, virements (chacun le sien sur le même mois) ; les deux copies
  `a2-budget:sync:v1` identiques, forêt comprise.
- Les deux hors ligne : chacun coche une tâche, ajoute un article, coche son
  virement et change le même salaire ; AL revient, puis AC → tout est là des
  deux côtés, le salaire d'AC (arrivée en dernier) gagne, même forêt (deux
  tâches comptées).
- Invité sur un 3e téléphone pendant que le foyer vit : aucune requête vers
  Google, Firebase ou les émulateurs, chunk du SDK jamais chargé par la page ;
  compte hors liste : « Ce compte n'est pas invité. ».
- Session gardée : rechargement, onglet fermé puis rouvert (comme l'icône
  PWA), ouverture sans réseau ; le geste fait hors ligne part au retour.

**Bug trouvé et corrigé** : `diffFields` écrivait en bloc une map qui
apparaît (`paid` absent du mois → `paid = { transferB: true }`) ; hors ligne,
le virement coché par l'un effaçait celui de l'autre. Une map nouvelle
s'écrit désormais feuille par feuille (`paid.transferB`), comme une map
existante (test unitaire dans `diff.test.ts`).

## 18. V5.1 — quêtes communes (collection `quests`)

- Domaine : `packages/core/src/home/quests.ts` (calendrier déterministe ≈ 1 à 2 par semaine, `questOfDay` : jamais plus d'une, `helpQuest`, validation). AppState : `quests?: { items }`, optionnel.
- Document `households/a2home/quests/{jour-type}` (ou `{jour-type-dXXXX}` pour le mode développeur) : `{ id, kind, day, tab, spot, createdBy (rôle), helpers: { a?, b? }, doneAt? }` + métadonnées. Pont : `apps/web/src/sync/quests.ts` — création SEULE (sans aide), puis l'aide en mise à jour de champ `helpers.<rôle>` ; jamais de suppression.
- Règles (bloc « Quêtes communes » de firestore.rules, tests/rules/quests.test.ts) : création par un membre (`createdBy` = son rôle, au plus sa propre aide, sans `doneAt`) ; ensuite chacun n'écrit que `helpers.<son rôle>`, une fois ; `doneAt` seulement avec les deux aides ; pas de suppression.
- Une quête n'est écrite qu'au premier toucher (sinon : 0 lecture/écriture de plus) ; récompense +3 kompeitō dans le bocal LOCAL de chacun, une fois par quête (`a2-budget:quests:v1`).
- QA : `e2e-sync/qa-quests.spec.ts` (lancé par `qa-sync.mjs`).
- V5.3 : `spot` (0..2) choisit un emplacement DANS la scène de l'onglet (`features/quests/questPlacement.ts` : perchoirs près du bocal, entre deux rayons, à côté de Totoro…), calculé sur chaque téléphone ; jamais sur un bouton, un champ, un montant ou du texte ; repli sur le bord de la feuille. Données et règles inchangées.

## 19. V5.1 — Présence, coucous, bocal partagé (connecté seulement)

- **Présence** : `memberState/{rôle}` reçoit `{ tab, visible, at }` (heure
  serveur, fusion) à chaque changement d'onglet, `visible: false` à la mise
  en arrière-plan, battement 60 s si visible. L'autre est « là » si
  `visible` et `at` < 2,5 min. Écoute de la fiche de l'autre seulement
  quand l'app est visible (`presence/LiveContext.tsx`, `sdk/live.ts`).
- **Coucou** : `pokeAt` (heure serveur) dans sa propre fiche, anti-rafale
  5 s ; joué une fois chez l'autre s'il a moins de 20 s.
- **Bocal** : `play/{rôle}` `{ given, spent, caught, golden, migrated }`,
  écrit en `increment` par ses propres gestes ; bocal = 20 + Σ given − Σ
  spent. Migration unique (transaction, marque `migrated`). Règles : écrit
  par son rôle, entiers ≥ 0, jamais en baisse, marque jamais effacée.
- **Coût** (`dayCost`, testé) : grosse journée à deux (3 h visibles chacun,
  30 ouvertures, 120 onglets, 20 coucous, 40 gestes) = 840 écritures + 1 100
  lectures < 2 000 ; journée ordinaire < 700.
- **QA** : `e2e-sync/presence.spec.ts` (dans `qa-sync.mjs`).

## 20. V5.2 — Avatar de l'autre (local seulement)

- **Serveur** : rien de nouveau. Seule la présence du §19 (« l'autre est sur
  le même onglet ») décide de l'arrivée et du départ. Aucune position, aucun
  état d'animation n'est transmis ; zéro lecture ou écriture en plus.
- **Sur le téléphone** (`presence/avatar/`) : petit automate pur et
  déterministe (`avatarModel.ts`, testé avec graine) — entrée par un bord
  (Jiji trottine, Calcifer flotte), errance sur le haut de la barre du bas,
  poses (assis, regarde ton doigt ou ton compagnon, bâille), sommeil après
  75 s sans geste, sortie par le bord le plus proche. Boucle
  `requestAnimationFrame` seulement pendant les déplacements ; sinon minuteur
  jusqu'à la pose suivante, et rien pendant le sommeil.
- **Gestes** : toucher → saut + ♡ et le coucou existant (anti-rafale 5 s,
  1 écriture) ; caresser → ronron (Jiji) ou crépitement (Calcifer), local (V5.3 :
  plus d'offrande de kompeitō, réservés aux Noiraudes). Coucou reçu
  pendant qu'il est là : il fait coucou.
- L'en-tête ne montre plus le compagnon de l'autre (une seule présence
  visible) ; il garde le saut + ♡ de ton compagnon au coucou reçu.
- **Calme** (« Immobile », mouvement réduit) : apparaît assis, disparaît
  d'un coup, poses seulement. Masqué sur ordinateur.
- **DEV** : « Faire venir Jiji / Calcifer », « Il me fait coucou », « Le
  faire repartir » (présence simulée en local, invité compris, rien écrit).
## 21. V5.2 — lettres du cercle

Chacun écrit **sa part** du cercle de la semaine, quand il veut, de son téléphone (son merci
à l'autre, ce qui lui pèse, une intention, un petit mot) ; l'autre la reçoit comme une
lettre.

- **Sans perte** : une part est un `Circle` avec `author` (`a`|`b`) et un id déterministe
  `circle-<lundi>-<rôle>` (core : `saveCirclePart`). Seul son auteur l'écrit ; deux
  appareils du même rôle : le dernier gagne (`replaceOnAdd` : `set`, sans `creationId`).
  Le cercle tenu à deux sur un téléphone (ancien format, invité) reste un `Circle` sans
  `author`. La projection garde par semaine un cercle à deux + une part par personne ; la
  vue d'une semaine fusionne (`mergeWeek` : les mots d'une personne viennent de sa part si
  elle existe, sinon du cercle à deux). Validation : unicité par (semaine, auteur) ; champs
  `author` et `notes` optionnels (rétrocompatible).
- **Non lu** déduit des données : la part de l'autre la plus récente (semaine en cours ou
  précédente) dont `heldAt` dépasse ma marque `memberState/{mon rôle}.circleSeen`
  (= `heldAt` de la dernière lettre lue ; écrite en fusion, règles inchangées : seul ce
  rôle écrit sa fiche). Marque locale (cet appareil) en attendant la fiche.
- **Réception** (`features/rituals/letters/`) : enveloppe cachetée sur la carte du cercle,
  pastille sur l'onglet Maison, toast « ✉ » sans son quand une lettre arrive app ouverte ;
  toucher → la lettre s'ouvre ; ouvrir = lu sur tous mes appareils. Invité : rien.
- **Coût** : une écoute de ma fiche, app visible seulement ; une écriture par lettre lue.
- **App fermée** : rien sans Web Push (§8) ; le déclencheur serait l'écriture d'une part.


## 22. V5.3 — Remise à zéro (mode développeur)

Panneau DEV › « Remise à zéro » (`features/dev/DevReset.tsx`), chaque bouton confirmé par
un second toucher « Sûr ? » (4 s). Pur : `sync/reset.ts` ; serveur : `sdk/reset.ts`.

- **Lettres de la semaine** : les enregistrements du cercle de la semaine (parts des deux,
  cercle à deux) sont retirés de l'état → suppression douce par le pont, chez les deux en
  temps réel. Puis `lettersEpoch + 1` sur le foyer : chaque téléphone ramène sa marque
  `circleSeen` (fiche et marque locale) au début de la semaine du cercle. Réécrite, la
  lettre est reçue de nouveau. Invité : en local.
- **Tout remettre à zéro** (connecté) : le **signal d'abord** sur `households/a2home` :
  `resetEpoch + 1`, `resetAt` (heure du serveur), `resetBy` (UID), `resetting: true` ; puis
  chaque collection (tâches, faits, courses, événements, mois, cercles, réglages,
  checkpoints, meta, quêtes, activity, play) relue et supprimée par lots de 400 ; enfin
  `resetting: false`. Le foyer, les fiches `memberState` (appartenance) et `push` restent.
- **Chaque téléphone** écoute le document du foyer (1 lecture à l'ouverture, 1 par
  changement). Compteur changé (vu du serveur) → `SyncContext` arrête la synchronisation,
  efface les mémoires locales (`state/localMemories.ts` : quêtes, bocal, « lu »), écrit une
  copie vide (`freshCacheAfterReset`, jamais relue) et remonte le store sur un **nouveau
  lien** : l'ancien état n'est jamais comparé au nouveau, aucune écriture d'avant ne part.
  Le nouveau runtime attend `resetting: false` (3 min au plus), puis relit tout. Les
  compteurs vus sont gardés dans `a2-budget:sync:v1` (absents : adoptés sans rien effacer).
- **Plancher** : le transport ne montre plus aucun document dont `syncedAt` < `resetAt`
  (le cache du SDK peut encore en garder ; les écritures en attente restent). Un document
  « removed » n'est jamais le signal.
- **Bocal** : la migration unique ne recopie plus l'état local si le foyer a déjà été remis à
  zéro (`resetEpoch` présent, lu dans la transaction).
- **Règles** : signal bien formé (+ 1, heure du serveur, son UID) ; `resetting` ne repasse
  qu'à faux ; `lettersEpoch` + 1 seulement ; suppressions permises à l'auteur du signal
  pendant le vidage, 10 min au plus (`inReset` : une lecture du foyer par lot) ; jamais
  `memberState` ni le foyer. Tests : `tests/rules/reset.test.ts`.
- **Invité** : le « Tout effacer » des Réglages + les mémoires locales.
- **Tests** : `sync/reset.test.ts` (signal, plancher, copie vide, aucune écriture d'avant),
  `circleLetters.test.ts`, e2e invité `e2e/dev-reset.spec.ts`, QA deux téléphones
  `e2e-sync/qa-reset.spec.ts`.
