# A² Home — conventions agents

Monorepo pnpm. **Lire `docs/V2_BRIEF.md` avant d'écrire du code** (vision,
mise en page, propriété des fichiers, contrats). Le domaine budget est décrit
dans `docs/CONTRACTS.md`, le domaine Maison/Forêt dans `docs/DOMAIN_CONTRACTS.md`.

## Règles

- Montants : **centimes entiers**. Taux : **points de base entiers** (40 % = 4000).
- L'UI n'implémente jamais de calcul financier : API publique de `@a2/core` uniquement.
- Les composants ne touchent jamais `localStorage` pour les données : passer par
  le store (`apps/web/src/state/store.tsx`, hook `useApp`). Préférences d'interface :
  clé `a2-budget:ui:v1` uniquement. Jamais `localStorage.clear()`.
- Ne modifier que les fichiers de son périmètre (tableau du brief, §5).
- Avant de finir : `pnpm typecheck`, `pnpm test`, `pnpm build` doivent passer.
- Compte rendu bref : modifications, vérifications exécutées, limites restantes.
