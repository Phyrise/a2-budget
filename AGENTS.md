# A² Budget — conventions agents

Monorepo pnpm. **Lire `docs/CONTRACTS.md` avant d'écrire du code** : il définit la
propriété des fichiers, les types partagés et l'API publique de `@a2/core`.

## Propriété (V1)

| Chemin | Propriétaire |
|---|---|
| `packages/core/**` | agent CORE |
| `apps/web/src/views/**` | agent UI |
| `apps/web/src/components/**` (sauf `SaveIndicator.tsx`, `UpdatePrompt.tsx`) | agent UI |
| `apps/web/src/styles/**` (sauf `tokens.css`, `global.css`) | agent UI |
| manifests, lockfile, `vite.config.ts`, `index.html`, PWA, `apps/web/src/state/**`, `main.tsx`, `App.tsx`, CI, docs | lead |

## Règles

- Montants : **centimes entiers**. Taux : **points de base entiers** (40 % = 4000).
- L'UI n'implémente jamais de calcul financier : API publique de `@a2/core` uniquement.
- Les composants ne touchent jamais `localStorage` : passer par le store
  (`apps/web/src/state/store.tsx`, hook `useApp`).
- Aucune nouvelle dépendance sans accord du lead (les manifests sont au lead).
- Committer sur sa propre branche uniquement. Ne jamais pousser. Ne jamais modifier
  les fichiers d'un autre agent.
- Avant de finir : `pnpm typecheck` (et `pnpm test` pour CORE) doivent passer.
- Compte rendu bref demandé : modifications, tests exécutés, limites restantes.
