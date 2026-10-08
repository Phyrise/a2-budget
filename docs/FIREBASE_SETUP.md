# A² Home — mettre en place Firebase (pas à pas pour Arthur)

À faire **une seule fois**, depuis un ordinateur, avec ton compte Google
`arthur.longuefosse@gmail.com`. Durée : 15 minutes environ. Tout est gratuit
(offre **Spark**) et **aucune carte bancaire** n'est demandée ; si un écran
parle de « Blaze », de facturation ou de mise à niveau, ne clique pas : on
n'en a pas besoin. Conception : `docs/SYNC_DESIGN.md`.

**Qui peut entrer** : seulement deux comptes Google, écrits en dur dans
l'app **et** dans les règles de la base (la vraie protection) :

| Compte | Rôle |
|---|---|
| `arthur.longuefosse@gmail.com` | AL (`a`, Jiji) |
| `alexia.chaval@free.fr` | AC (`b`, Calcifer) |

Pas d'invitation, pas de code : un autre compte Google peut ouvrir la
fenêtre de connexion, mais l'app lui dit « Ce compte n'est pas invité » et
la base lui refuse tout. Un seul foyer, `a2home`.

Les libellés de la console sont donnés en français, avec l'anglais entre
parenthèses (la console change parfois de mots, jamais de logique).

## 1. Créer le projet

1. Ouvre <https://console.firebase.google.com> et connecte-toi.
2. « Créer un projet » (*Create a project*).
3. Nom du projet : `A2 Home`. Note l'**ID du projet** proposé dessous
   (ex. `a2-home-7f3c1`) : il est définitif.
4. Gemini dans Firebase : désactivé. Google Analytics : **désactivé**.
   → « Créer le projet ».
5. Vérifie en bas du menu de gauche : « Spark — sans frais » (*Spark plan*).

## 2. Activer la connexion Google

1. Menu « Créer » (*Build*) → **Authentication** → « Commencer ».
2. Onglet « Mode de connexion » (*Sign-in method*) → **Google** →
   interrupteur « Activer ». « Nom public du projet » : `A² Home`.
   « Adresse e-mail d'assistance » : ton adresse. → « Enregistrer ».
   (N'active **aucun** autre mode : ni e-mail, ni anonyme.)
3. Onglet « Paramètres » (*Settings*) → « Domaines autorisés »
   (*Authorized domains*) → « Ajouter un domaine » → `phyrise.github.io`.
   (`localhost` et `<id>.firebaseapp.com` y sont déjà : laisse-les.)

## 3. Créer la base Firestore

1. Menu « Créer » → **Firestore Database** → « Créer une base de données ».
2. Édition : **Standard**. ID de la base : `(default)` (c'est la seule
   base gratuite).
3. Emplacement (définitif) : **`asia-northeast1` (Tokyo)**.
4. **Démarrer en mode production** (*Start in production mode*) → « Créer ».
   La base refuse alors tout, en attendant les règles.

## 4. Coller les règles de sécurité

1. Ouvre le fichier **`firestore.rules`** à la racine du dépôt (sur GitHub :
   le fichier → bouton « Copy raw file » ; ou demande-le-moi dans le chat).
2. Firestore → onglet « Règles » (*Rules*) → remplace **tout** le contenu
   par ce fichier → « Publier ».

Ce sont exactement les règles testées sur l'émulateur (`pnpm test:rules`).
Elles laissent entrer les deux comptes de la liste, **avec un e-mail vérifié
par Google**, et personne d'autre. Si le fichier change un jour, je te le
dirai : il suffira de recoller.

## 5. Enregistrer l'app web et m'envoyer la config publique

1. ⚙ « Paramètres du projet » → « Général » → « Vos applications » →
   icône **`</>`** (« Web »).
2. Pseudo de l'app : `A² Home web`. **Ne coche pas** « Configurer
   également Firebase Hosting ». → « Enregistrer l'application ».
3. Copie l'objet `firebaseConfig` affiché (ignore « npm install ») :

   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "a2-home-7f3c1.firebaseapp.com",
     projectId: "a2-home-7f3c1",
     storageBucket: "a2-home-7f3c1.firebasestorage.app",
     messagingSenderId: "…",
     appId: "1:…:web:…"
   };
   ```

   Ces valeurs sont **publiques** (elles finissent dans le code de toute
   app web) : envoie-les-moi dans le chat. Je les place dans
   `apps/web/.env.production` (versionné). Sans ce fichier, l'app reste
   exactement comme aujourd'hui, 100 % locale.

   Fait : `apps/web/.env.production` contient la configuration du projet
   `a2-home` (`authDomain` = `phyrise.github.io`). Il n'est lu qu'en mode
   production (`pnpm build`, CI et déploiement Pages). Les e2e principaux
   tournent sur un build sans configuration : `pnpm --filter @a2/web
   build:e2e` (mode `e2e`, dossier `dist-e2e/`, servi par le `webServer`
   de `playwright.config.ts`), ou `pnpm --filter @a2/web e2e`.

## 6. Seulement pour un iPhone (connexion dans l'app installée)

Sur iPhone, la fenêtre Google ne revient pas toujours dans l'app installée
sur l'écran d'accueil. La parade : servir la page de connexion depuis
`phyrise.github.io` lui-même. Je prépare les fichiers
(`apps/web/scripts/firebase-auth-helper.mjs <ID du projet>`, qui produit un
dossier `phyrise.github.io/` prêt à pousser). Il te restera :

1. Sur GitHub, créer (s'il n'existe pas) le dépôt public
   **`phyrise.github.io`** ; Settings → Pages → Source : « Deploy from a
   branch », `main`, `/ (root)`.
2. Y pousser **le contenu** du dossier que je te donne (dossier `__/` et
   fichier `.nojekyll` compris), à la racine.
3. Vérifier que <https://phyrise.github.io/__/auth/handler> affiche une page
   blanche (pas de téléchargement, pas de 404).
4. <https://console.cloud.google.com> → même projet → « API et services » →
   « Identifiants » → « ID clients OAuth 2.0 » → « Web client (auto created
   by Google Service) » → « URI de redirection autorisés » → ajouter
   `https://phyrise.github.io/__/auth/handler` → « Enregistrer ».
5. Me dire que c'est fait : `authDomain` passera à `phyrise.github.io`.

## 7. (Facultatif) Restreindre la clé d'API

<https://console.cloud.google.com> → « API et services » → « Identifiants »
→ « Browser key (auto created by Firebase) » → « Restrictions relatives aux
applications » : **Sites Web**, ajoute `https://phyrise.github.io/*` et
`http://localhost/*` → « Enregistrer ». Sans effet sur la sécurité des
données (ce sont les règles) ; évite qu'un autre site utilise ta clé.

## 8. Ce que tu m'envoies, et ce que tu ne m'envoies jamais

À m'envoyer dans le chat : l'objet `firebaseConfig` (§5), « règles
publiées » (§4), iPhone ou Android pour chacun de vous deux.

À ne **jamais** m'envoyer ni committer : un mot de passe, un fichier JSON de
« compte de service » ou de « clé privée » (on n'en crée aucun), un code
reçu par SMS.

## 9. Ensuite, sur les téléphones

En ouvrant le site : « Se connecter avec Google » ou « Continuer en
invité ». Le choix reste mémorisé sur le téléphone et se change dans
Réglages. En invité, aucune donnée ne quitte le téléphone : c'est l'app
d'aujourd'hui, avec ses données locales. Connectés, Arthur et Alexia
partagent le même foyer. Les données déjà présentes sur un téléphone ne
sont jamais effacées.

## 10. Si quelque chose coince

- **« Ce compte n'est pas invité » avec le bon compte** : Google n'a pas
  vérifié l'adresse (possible pour une adresse non Gmail comme
  `@free.fr`). Sur <https://myaccount.google.com>, faire vérifier l'adresse
  e-mail du compte (Google envoie un code). Sinon, me donner une autre
  adresse (je change la liste dans l'app et dans `firestore.rules`).
- **« Accès bloqué : l'application n'a pas terminé la procédure de
  validation »** : <https://console.cloud.google.com> → même projet →
  « Google Auth Platform » → « Audience » → ajouter les deux adresses comme
  utilisateurs de test, ou « Publier l'application » (aucune validation
  Google nécessaire : seuls nom, e-mail et photo sont demandés).
- **Usage** (rarement) : Firestore → « Utilisation » (*Usage*). Repères
  gratuits : 50 000 lectures, 20 000 écritures par jour, 1 Gio stocké.
  Attendu : moins de 1 000 lectures et 200 écritures par jour. En cas de
  dépassement, rien n'est facturé : la synchronisation reprend après minuit
  (heure du Pacifique) et l'app continue hors ligne entre-temps.

## 11. Pour le développement (aucun compte nécessaire)

Projet de démonstration `demo-a2home` (préfixe `demo-` : rien de réel).
L'émulateur Firestore exige Java 21+ : `scripts/install-java.sh` le pose
dans `~/.cache/a2home/java-21`, sans toucher au système (supprimer le
dossier suffit à le retirer).

- `pnpm test:rules` : règles testées sur l'émulateur (hors de `pnpm test`).
- `pnpm emulators` : Auth + Firestore en local (interface sur
  <http://127.0.0.1:4180>).
- `pnpm --filter @a2/web e2e:sync` : build émulateurs (`dist-emu/`) puis
  tests navigateur du compte et de la synchronisation (accueil, invité sans
  aucune requête serveur, connexion par faux jeton Google, refus, première
  connexion, deux téléphones, hors ligne, déconnexion au choix). Lance les
  émulateurs s'ils ne tournent pas ; pas en même temps que `pnpm test:rules`
  (mêmes ports).
- `node apps/web/scripts/qa-sync.mjs` : QA « deux téléphones » (AL et AC
  en temps réel, hors ligne des deux côtés puis fusion, invité sur un 3e
  téléphone, session gardée) ; `--all` pour toute la suite émulateurs.
- Sur le build émulateurs seulement, `window.__a2qa.signInAs(email)` connecte
  un compte Google factice de l'émulateur Auth (n'existe dans aucun autre build :
  `scripts/check-firebase-split.mjs` le vérifie).

**Règles mises à jour (V5, étape synchro)** : si tu as déjà collé
`firestore.rules` dans la console, recolle-le (§4). Deux changements :
l'annulation d'un geste est signée du rôle (`undoneBy` = `a` ou `b`), et un
objet déjà créé ne peut pas être recréé par-dessus (`creationId`).
