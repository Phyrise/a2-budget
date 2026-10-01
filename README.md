# A² Budget

Petite application de budget commun pour un couple : combien chacun verse sur
le compte commun, et combien il reste après les dépenses prévues.

V1 : PWA 100 % locale (React + TypeScript + Vite), servie sur GitHub Pages,
persistance `localStorage`. Pas de compte, pas de backend, pas de
synchronisation, aucune donnée financière envoyée sur le réseau.

- URL cible : <https://phyrise.github.io/a2-budget/>
- Docs : [SPEC](docs/SPEC.md) · [CONTRACTS](docs/CONTRACTS.md) ·
  [DESIGN](docs/DESIGN.md) · [FUTURE_SYNC](docs/FUTURE_SYNC.md)

## Démarrage

Prérequis : Node.js ≥ 22.12 (LTS) et pnpm (la version est fixée dans
`package.json` via `packageManager` ; `corepack enable` suffit).

```sh
pnpm install --frozen-lockfile
pnpm dev            # http://localhost:5173/a2-budget/
```

Le serveur dev écoute sur `0.0.0.0` : depuis un téléphone sur le même Wi-Fi,
ouvrir `http://<ip-du-serveur>:5173/a2-budget/` (autoriser le port 5173 dans le
firewall si besoin).

## Scripts

| Script | Rôle |
|---|---|
| `pnpm dev` | serveur de développement (Vite, host 0.0.0.0, port 5173) |
| `pnpm typecheck` | `tsc --noEmit` sur `packages/core` et `apps/web` (dont le service worker) |
| `pnpm test` | tests Vitest de `packages/core` |
| `pnpm build` | typecheck + build de production (`apps/web/dist`) |
| `pnpm preview` | sert le build de production (port 4173) — à utiliser pour tester la PWA |

## PWA et hors ligne

Le service worker (stratégie `injectManifest`, `apps/web/src/sw.ts`) précache
l'interface et les assets locaux. Les caches sont préfixés `a2-budget` pour ne
jamais collider avec les autres projets de la même origine.

- Le serveur de développement **ne sert pas** le service worker : tester la
  PWA avec `pnpm build && pnpm preview` (localhost ou HTTPS).
- L'HTTP sur une IP LAN permet de tester l'interface, mais pas d'activer
  complètement la PWA (contexte non sécurisé) : utiliser `localhost` ou HTTPS.
- Mise à jour : proposition discrète « Mise à jour disponible », jamais de
  rechargement automatique pendant une saisie.

### Installation

- **Android (Chrome)** : menu ⋮ → « Installer l'application » (ou
  « Ajouter à l'écran d'accueil »).
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- L'installation dépend du navigateur ; l'app fonctionne aussi sans
  installation.

## Sauvegarde et transfert

- **Export** (Réglages) : fichier JSON versionné daté
  (`a2-budget-AAAA-MM-JJ.json`). Il contient vos données personnelles : ne le
  partagez qu'avec votre moitié.
- **Import** : validation + résumé avant confirmation de remplacement ; vous
  pouvez exporter les données courantes avant de remplacer. Un fichier invalide
  ne modifie rien.
- Effacer les données du navigateur supprime l'historique : exportez avant.
- Deux appareils = deux jeux de données indépendants (pas de synchronisation
  en V1, voir [FUTURE_SYNC](docs/FUTURE_SYNC.md)).

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/ci.yml` :

- sur toute PR : installation lockfile figé, typecheck, tests, build (sans
  publication) ;
- sur `main` : idem, puis déploiement de `apps/web/dist` sur GitHub Pages
  (actions officielles `actions/deploy-pages`).

Prérequis côté dépôt : Pages activée avec la source **GitHub Actions**
(Paramètres → Pages). L'application est servie sous le sous-chemin
`/a2-budget/` (`base` de Vite + manifest + service worker alignés).

## Architecture

```
a2-budget/
├── apps/web/          PWA React + Vite (vue, styles, état, PWA)
│   └── src/
│       ├── state/     StorageAdapter + store React (lead)
│       ├── views/     les 3 vues (agent UI)
│       ├── components/
│       └── sw.ts      service worker (caches préfixés)
├── packages/core/     types + calculs purs + validation (agent CORE)
├── docs/              SPEC, CONTRACTS, DESIGN, FUTURE_SYNC, briefs agents
└── scripts/           génération des icônes
```

- Montants en centimes entiers, taux en points de base entiers ; arrondi
  demi-centime vers le haut par tranche (voir CONTRACTS).
- Chaque mois conserve sa copie des règles : changer les réglages ne
  recalcule jamais les mois existants.
- `@a2/core` est consommé à la source (alias Vite + `paths` TypeScript) :
  pas d'étape de build intermédiaire.
