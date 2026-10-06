# A² Home — mettre en place Firebase (pas à pas pour Arthur)

À faire **une seule fois**, depuis un ordinateur, avec ton compte Google.
Durée : 20 minutes environ. Tout est gratuit (offre **Spark**) et **aucune
carte bancaire** n'est demandée ; si un écran parle de « Blaze », de
facturation ou de mise à niveau, ne clique pas : on n'en a pas besoin.
Conception complète : `docs/SYNC_DESIGN.md`.

Les libellés de la console sont donnés en français, avec l'anglais entre
parenthèses (la console change parfois de mots, jamais de logique).

## 1. Créer le projet

1. Ouvre <https://console.firebase.google.com> et connecte-toi.
2. « Créer un projet » (*Create a project*).
3. Nom du projet : `A2 Home`. Note l'**ID du projet** proposé dessous
   (ex. `a2-home-7f3c1`) : il est définitif.
4. Gemini dans Firebase : désactivé (inutile ici).
5. Google Analytics : **désactivé**. → « Créer le projet ».
6. Vérifie en bas du menu de gauche : « Spark — sans frais » (*Spark plan*).

## 2. Enregistrer l'app web et récupérer la config publique

1. Page d'accueil du projet → icône **`</>`** (« Web »).
2. Pseudo de l'app : `A² Home web`. **Ne coche pas** « Configurer
   également Firebase Hosting ». → « Enregistrer l'application ».
3. Copie l'objet `firebaseConfig` affiché :

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
   app web) : tu peux me les envoyer dans le chat. La protection, ce sont
   les règles (§5). Ignore l'étape « npm install firebase ».
4. On la retrouve plus tard dans ⚙ « Paramètres du projet » → onglet
   « Général » → « Vos applications ».

## 3. Activer la connexion Google

1. Menu « Créer » (*Build*) → **Authentication** → « Commencer ».
2. Onglet « Mode de connexion » (*Sign-in method*) → **Google** →
   interrupteur « Activer ».
3. « Nom public du projet » : `A² Home`. « Adresse e-mail d'assistance » :
   ton adresse. → « Enregistrer ».
4. Onglet « Paramètres » (*Settings*) → « Domaines autorisés »
   (*Authorized domains*) → « Ajouter un domaine » → `phyrise.github.io`.
   (`localhost` et `<id>.firebaseapp.com` y sont déjà : laisse-les.)
5. Si, plus tard, la connexion affiche « Accès bloqué : l'application n'a
   pas terminé la procédure de validation » : <https://console.cloud.google.com>
   → même projet → « Google Auth Platform » → « Audience » → ajoute ton
   adresse et celle d'AC comme utilisateurs de test, ou « Publier
   l'application » (seuls nom, e-mail et photo sont demandés : aucune
   validation Google n'est nécessaire).

## 4. Créer la base Firestore

1. Menu « Créer » → **Firestore Database** → « Créer une base de données ».
2. Si la console propose une édition : **Standard**. ID de la base :
   `(default)` (ne change rien : c'est la seule base gratuite).
3. Emplacement (définitif) : là où vous vivez — `asia-northeast1 (Tokyo)`
   au Japon, `europe-west9 (Paris)` en France.
4. **Démarrer en mode production** (*Start in production mode*) → « Créer ».
   La base refuse alors tout, en attendant les règles.

## 5. Coller les règles de sécurité

Firestore → onglet « Règles » (*Rules*) → remplace **tout** le contenu par
le bloc ci-dessous → « Publier ». (Ces règles seront aussi versionnées dans
le dépôt, `firestore.rules`, et testées sur l'émulateur avant chaque
changement ; en V5 je te dirai si elles ont bougé.)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- Outils ----------
    function signedIn() { return request.auth != null; }
    function me() { return request.auth.uid; }
    function hhPath(hid) { return /databases/$(database)/documents/households/$(hid); }
    function invitePath(code) { return /databases/$(database)/documents/invites/$(code); }
    function isMember(hid) { return signedIn() && me() in get(hhPath(hid)).data.memberUids; }
    function changedKeys() { return request.resource.data.diff(resource.data).affectedKeys(); }
    // Toute écriture dit qui l'a faite et porte l'heure du serveur.
    function stamped() {
      return request.resource.data.updatedBy == me()
          && request.resource.data.syncedAt == request.time;
    }
    function isOtherRole(role, firstRole) {
      return (firstRole == 'a' && role == 'b') || (firstRole == 'b' && role == 'a');
    }

    // ---------- Où est mon foyer (privé) ----------
    match /users/{uid} {
      allow read, delete: if signedIn() && me() == uid;
      allow create, update: if signedIn() && me() == uid
        && request.resource.data.keys().hasOnly(['hid', 'updatedAt']);
    }

    // ---------- Invitations à usage unique ----------
    match /invites/{code} {
      allow get: if signedIn();          // seulement si l'on connaît le code
      allow list, update: if false;
      allow create: if isMember(request.resource.data.hid)
        && request.resource.data.createdBy == me()
        && request.resource.data.role in ['a', 'b']   // rôle offert à celui qui rejoint
        && request.resource.data.expiresAt > request.time
        && request.resource.data.expiresAt < request.time + duration.value(7, 'd');
      // Annulée par un membre, ou consommée par celui qui rejoint (même lot).
      allow delete: if signedIn()
        && me() in getAfter(hhPath(resource.data.hid)).data.memberUids;
    }

    // ---------- Foyer ----------
    match /households/{hid} {
      allow get: if signedIn() && me() in resource.data.memberUids;
      allow list, delete: if false;

      allow create: if signedIn()
        && request.resource.data.memberUids == [me()]
        && request.resource.data.members.keys().hasOnly([me()])
        && request.resource.data.members[me()] in ['a', 'b']
        && request.resource.data.createdBy == me()
        && stamped();

      // Membres : prénoms, invitation, version — jamais la liste des membres.
      allow update: if signedIn() && me() in resource.data.memberUids
        && !changedKeys().hasAny(['memberUids', 'members', 'createdBy'])
        && stamped();

      // Rejoindre : 2e membre, avec l'invitation du foyer, consommée dans le lot.
      allow update: if signedIn()
        && !(me() in resource.data.memberUids)
        && resource.data.memberUids.size() == 1
        && resource.data.inviteCode is string
        && resource.data.inviteExpiresAt > request.time
        && exists(invitePath(resource.data.inviteCode))
        && !existsAfter(invitePath(resource.data.inviteCode))
        && changedKeys().hasOnly(['memberUids', 'members', 'inviteCode',
                                  'inviteExpiresAt', 'updatedBy', 'syncedAt'])
        && request.resource.data.memberUids == resource.data.memberUids.concat([me()])
        && request.resource.data.members.diff(resource.data.members).affectedKeys().hasOnly([me()])
        && isOtherRole(request.resource.data.members[me()],
                       resource.data.members[resource.data.memberUids[0]])
        && !('inviteCode' in request.resource.data)
        && stamped();

      // ---------- Objets (dernier qui écrit gagne) et faits (ajout seulement) ----------
      match /{coll}/{docId} {
        function isObjectColl() {
          return coll in ['tasks', 'groceries', 'events', 'months',
                          'balanceCorrections', 'circles', 'settings'];
        }
        function isFactColl() {
          return coll in ['completions', 'skips', 'forestEvents', 'focusSessions',
                          'groceryHistory', 'activity'];
        }
        function objectWrite() {
          return isObjectColl()
            && (resource == null
                  ? !('deletedAt' in request.resource.data)
                  : (!changedKeys().hasAny(['deletedAt'])
                     || !('deletedAt' in request.resource.data)
                     || request.resource.data.deletedAt == request.time));
        }
        function factWrite() {
          return isFactColl()
            && (resource == null
                  // Création : signée par son auteur, jamais déjà annulée.
                  ? request.resource.data.createdBy == me()
                    && !('undoneAt' in request.resource.data)
                  // Seule mise à jour possible : l'annulation douce, une fois.
                  : !('undoneAt' in resource.data)
                    && request.resource.data.undoneBy == me()
                    && changedKeys().hasOnly(['undoneAt', 'undoneDay', 'undoneBy',
                                              'devOverride', 'updatedBy', 'syncedAt']));
        }

        allow read: if isMember(hid) && (isObjectColl() || isFactColl());
        allow create, update: if isMember(hid) && stamped() && (objectWrite() || factWrite());
        allow delete: if isMember(hid)
          && ((isObjectColl()   // purge 30 jours après la suppression douce
               && resource.data.deletedAt < request.time - duration.value(30, 'd'))
              || coll in ['groceryHistory', 'activity']);   // élagage
      }

      // ---------- Points de reprise de la forêt (déterministes) ----------
      match /checkpoints/{day} {
        allow read: if isMember(hid);
        allow create, update: if isMember(hid) && stamped()
          && request.resource.data.day == day;
        allow delete: if isMember(hid) && resource.data.get('genesis', false) != true;
      }

      // ---------- Jalons de la forêt : jamais en baisse ----------
      match /meta/{docId} {
        allow read: if isMember(hid);
        allow create: if isMember(hid) && stamped();
        allow update: if isMember(hid) && stamped()
          && (docId != 'forestMilestones'
              || (request.resource.data.growthStage >= resource.data.growthStage
                  && request.resource.data.lifetimeCare >= resource.data.lifetimeCare
                  && request.resource.data.longestStreak >= resource.data.longestStreak
                  && request.resource.data.unlockedCreatureIds.hasAll(resource.data.unlockedCreatureIds)
                  && request.resource.data.unlockedEnvironmentIds.hasAll(resource.data.unlockedEnvironmentIds)));
        allow delete: if false;
      }

      // ---------- Par personne : lu par les deux, écrit par soi ----------
      match /memberState/{uid} {
        allow read: if isMember(hid);
        allow write: if isMember(hid) && me() == uid;
      }
      match /push/{uid} {
        allow read: if isMember(hid);
        allow write: if isMember(hid) && me() == uid;
      }
    }
  }
}
```

Note : chaque requête relit le document du foyer pour vérifier
l'appartenance (une lecture comptée, déjà incluse dans l'estimation de
`SYNC_DESIGN.md` §4.3).

## 6. (Facultatif, conseillé) Restreindre la clé d'API

<https://console.cloud.google.com> → même projet → « API et services » →
« Identifiants » → « Browser key (auto created by Firebase) » →
« Restrictions relatives aux applications » : **Sites Web**, ajoute
`https://phyrise.github.io/*` et `http://localhost/*` → « Enregistrer ».
Sans effet sur la sécurité des données (ce sont les règles) ; évite
seulement qu'un autre site utilise ta clé.

## 7. Seulement si AL ou AC a un iPhone (connexion dans l'app installée)

À faire **après l'étape 0** de `SYNC_DESIGN.md` §12, si la connexion par
fenêtre ne revient pas dans l'app installée. Je préparerai les fichiers ; il
te restera :

1. Sur GitHub, créer (s'il n'existe pas) le dépôt public
   **`phyrise.github.io`** (site utilisateur) ; Settings → Pages → Source :
   « Deploy from a branch », `main`, `/ (root)`.
2. Y pousser le dossier `__/` que je fournirai (copie des fichiers du
   helper `https://<id>.firebaseapp.com/__/auth/…`) et un fichier vide
   `.nojekyll`.
3. <https://console.cloud.google.com> → « API et services » →
   « Identifiants » → « ID clients OAuth 2.0 » → « Web client (auto created
   by Google Service) » → « URI de redirection autorisés » → ajouter
   `https://phyrise.github.io/__/auth/handler` → « Enregistrer ».
4. Me dire que c'est fait : `authDomain` passera à `phyrise.github.io`.

## 8. Ce que tu m'envoies, et ce que tu ne m'envoies jamais

À m'envoyer dans le chat :

- l'objet `firebaseConfig` (§2) ;
- l'emplacement choisi pour Firestore ;
- iPhone ou Android pour chacun de vous deux ;
- « règles publiées » une fois le §5 fait.

À ne **jamais** m'envoyer ni committer : ton mot de passe Google, un fichier
JSON de « compte de service » ou de « clé privée » (on n'en crée aucun), un
code de validation reçu par SMS.

Je placerai la config dans `apps/web/.env.production` (variables
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`) ; sans ce
fichier, l'app reste entièrement locale.

## 9. Ensuite, sur les téléphones (après la V5)

1. AL : Réglages → « Synchroniser nos deux téléphones » → « Se connecter
   avec Google » → « Créer notre foyer » (l'app propose d'abord d'exporter
   une sauvegarde : accepte) → les données partent.
2. AL : « Inviter AC » → montre le QR code ou envoie le lien (valable 48 h,
   une seule utilisation).
3. AC : ouvre le lien dans l'app installée (ou tape le code dans Réglages)
   → « Se connecter avec Google » → « Rejoindre ». Ses anciennes données
   restent sauvegardées sur son téléphone.

## 10. Surveiller (rarement)

Firestore → onglet « Utilisation » (*Usage*) : lectures, écritures et
stockage du jour. Repères gratuits : 50 000 lectures, 20 000 écritures,
20 000 suppressions par jour, 1 Gio stocké. Attendu : moins de 1 000
lectures et 200 écritures par jour. En cas de dépassement, rien n'est
facturé : la synchronisation reprend après minuit (heure du Pacifique) et
l'app continue hors ligne entre-temps.
