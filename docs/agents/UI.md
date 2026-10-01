# Mission — agent UI

Tu es responsable des **composants, vues, styles et interactions** de
`apps/web/src`, à l'exception des fichiers réservés au lead.

## À lire d'abord (dans cet ordre)

1. `docs/SPEC.md` — comportement attendu des trois vues.
2. `docs/DESIGN.md` — direction visuelle, saisie, micro-animations.
3. `docs/CONTRACTS.md` — API de `@a2/core`, contraintes UI, propriété.
4. `apps/web/src/state/store.tsx` — hook `useApp()` : c'est ta seule source
   d'état et tes seules actions.
5. `packages/core/src/index.ts` — API publique de calcul/formatage/analyse.
6. `apps/web/src/App.tsx` et `apps/web/src/components/BottomNav.tsx` — câblage
   existant (ne pas casser les exports).

## Fichiers que tu possèdes

- `apps/web/src/views/**` (remplacer les placeholders : `CurrentMonthView`,
  `HistoryView`, `SettingsView` — conserver les exports nommés, sans props).
- `apps/web/src/components/**` sauf `SaveIndicator.tsx` et `UpdatePrompt.tsx`
  (tu possèdes `BottomNav.tsx` : conserver le type `ViewId` et la signature
  des props).
- `apps/web/src/styles/**` sauf `tokens.css` et `global.css` (tu peux créer des
  fichiers CSS par vue/composant et les importer depuis tes composants ; les
  jetons existent déjà dans `tokens.css`).

## Interdictions

- Ne pas modifier : `main.tsx`, `App.tsx`, `state/**`, `SaveIndicator.tsx`,
  `UpdatePrompt.tsx`, `tokens.css`, `global.css`, `index.html`,
  `vite.config.ts`, manifests, lockfile.
- Aucune logique financière dans l'UI : utiliser **exclusivement** l'API
  publique de `@a2/core` (calculs, `formatCents`, `parseAmountInput`,
  `monthKeyToLabel`, …).
- Ne jamais appeler `localStorage` : tout passe par `useApp()`.
- Aucune nouvelle dépendance (demander au lead si tu crois en avoir besoin).
- Pas d'emojis comme icônes ; icônes SVG simples + texte.

## Note importante sur @a2/core

Dans le socle, les fonctions de `@a2/core` sont des **stubs qui lèvent des
erreurs** tant que le lead n'a pas mergé le travail de CORE. Ton typecheck et
ton build doivent passer contre les stubs. N'implémente pas les calculs toi-même
et ne committe aucun mock de core. Si tu veux tester tes interactions avant le
merge de CORE, fais-le localement sans committer.

## Exigences fonctionnelles

- **Ce mois** : mois + sélection d'un autre mois + retour au mois courant ;
  deux champs de salaire ; carte principale « À verser sur le compte commun »
  (A, B, total) visible dans le premier écran à 390 × 844 ; détail du calcul
  repliable ; liste de dépenses modifiable (ajouter/renommer/retirer) + total ;
  « Reste après dépenses » (déficit affiché, jamais masqué) ; « Disponible pour
  les loisirs » si réserve > 0, avec indication claire si la réserve n'est pas
  couverte ; indication que les salaires d'un nouveau mois sont des prévisions
  à ajuster.
- **Historique** : liste chronologique inverse des seuls mois existants
  (date, revenus, contributions, dépenses, reste) ; appui → ouvre ce mois dans
  « Ce mois » (via `selectMonth`) ; état vide propre.
- **Réglages** : noms, salaires de base, deux taux par personne (en %),
  dépenses récurrentes modifiables, réserve mensuelle par défaut, export JSON
  (téléchargement daté) et import (validation + résumé + confirmation avant
  remplacement ; proposer d'exporter avant de remplacer), explication brève des
  valeurs par défaut + bouton « Appliquer au mois affiché », avertissement
  sobre sur les données enregistrées sur cet appareil.
- **Saisie des montants** : `inputmode="decimal"` ; la chaîne en cours
  d'édition est locale au composant et séparée du montant validé ;
  `parseAmountInput` décide ; invalide → message local, aucun changement
  d'état ; champ vide ≠ 0 ; « 0 » valide ; préserver curseur/focus/dernière
  valeur enregistrée ; formatage fr-FR/EUR hors édition (`formatCents`).
- **Taux** : saisis en % (0–100, décimales acceptées), convertis en bps entiers
  (40 % → 4000 ; 33,33 % → 3333).
- **Accessibilité** : labels explicites, zones tactiles ≥ 44 px, focus visible,
  navigation clavier, `aria-current` sur la nav, contrastes corrects.
- **Animations** : CSS uniquement (opacity/transform, 140–220 ms),
  `prefers-reduced-motion` respecté, pas de changement de hauteur inattendu,
  pas de bibliothèque d'animation.

## Critères de réussite

1. `pnpm typecheck` passe (depuis la racine).
2. `pnpm build` passe.
3. Les trois vues sont complètes et conformes à DESIGN.md.
4. Commit sur la branche `agent/ui` (tu y es déjà).
5. Compte rendu bref (dans ta réponse finale) : modifications, vérifications
   exécutées, limites restantes.
