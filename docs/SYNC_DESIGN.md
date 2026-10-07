# A² Home — synchronisation à deux (conception V5)

**Document de conception uniquement : rien n'est implémenté en V4.** Il remplace la piste «
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
| `…/circles/{id}` | objet | `Circle` |
| `…/settings/budget` | objet | `Settings` (dépenses récurrentes en map) |
| `…/settings/focus` | objet | `{ selectedLantern }` |
| `…/settings/groceryMemory` | objet | `{ memory: { clé: rayon } }` |
| `…/activity/{id}` | **fait** | fil des nouvelles (§7) |
| `…/checkpoints/{YYYY-MM-DD}` | dérivé | `ForestState` figé à ce jour (§3.3) |
| `…/meta/forestMilestones` | monotone | plus hauts stade / soins / déblocages vus |
| `…/memberState/{role}` | par personne (`a`\|`b`) | `{ activitySeenAt }` |
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
  `undoneDay` (« YYYY-MM-DD »), `undoneBy` (UID), `devOverride?: true` (§9). Un fait n'est
  **jamais** supprimé ni réécrit.

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
  forêt identique).

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
  posé par le transport (`updatedBy`). Les règles permettent de réécrire
  l'annulation (un lot n'échoue pas si l'autre a déjà annulé).
- **Projection** (`project.ts`) : un cercle par semaine (le plus récent),
  plafonds de `@a2/core`, validation complète ; en cas d'échec chaque
  document est éprouvé seul, l'invalide est ignoré et signalé.
- **Tests** : aller-retour (y compris clés triées comme Firestore),
  `diffToOps` minimal et « projection = état local » pour chaque geste,
  deux téléphones sur un faux serveur (`MemoryServer` / `MemoryTransport`,
  règles essentielles, hors ligne, deux ordres de reconnexion).
- Copie locale du mode synchronisé : `a2-budget:sync:v1` (`syncCache.ts`),
  jamais `a2-budget:state:v1`.
