# A² Home — intégration du 2 octobre 2026

Base : Budget V1 `9a37d63` + lot Qwen `agent/home` `94db3e0`.

## Livré

- Coquille compacte Budget / Maison / Courses ; historique contextualisé et réglages en panneaux temporaires. Navigation segmentée retenue après comparaison réelle à 390 px : le menu cache les modules pour un gain de 59 px seulement.
- Budget : revenus et contributions fusionnés, total/dépenses/reste dans le premier écran mobile ; dépenses éditables, ajout via + ; réserve masquée mais conservée dans les données.
- Maison : création rapide, affectation, récurrences, complétion/annulation, historique, répartition factuelle, pause. Les tâches terminées sont repliées. Courses reste un échafaudage explicite.
- État V2 partagé et sauvegardé via StorageAdapter existant ; migration V1, import V1/V2, export V2. `useApp().state` reste une projection V1 pour les vues Budget ; `appState` contient le V2 persisté. Aucun calcul financier dans React.
- Réactions de complétion 1,6 s, visite du gardien 6 s, aucun replay au rechargement ; contrôles tactiles de 44 px, mouvement réduit, focus confiné et rendu au bouton initiateur.

## Corrections de la revue Qwen

- `advanceDay` traite les jours terminés, préserve la série avant l'action du jour et rattrape les jours écoulés. Deux jours d'inactivité terminés sont tolérés avant décroissance. Le watermark ne recule jamais.
- Les jours de pause sont exclus. La croissance permanente et le premier souvenir du gardien restent conservés.
- Les occurrences refusées par le cap ou pendant la pause sont mémorisées `uncredited` : elles ne gagnent pas un crédit par annulation/recomplétion ultérieure et ne consomment pas le cap.
- Validation V2 renforcée : IDs, pauses, relation budget/foyer, cohérence des crédits et de la croissance. Migration détachée de l'entrée.
- Feedback masqué après délai ; gardien temporaire ; tâches futures non cochables ; noms personnalisés utilisés par leur place dans le foyer.

## Vérifié

- 195 tests réussis, dont les 73 Budget inchangés et 4 tests du vrai import/export applicatif.
- Typecheck core/web/worker et build de production/PWA réussis.
- Parcours navigateur réel : budget conservé après migration/rechargement ; création AL/hebdomadaire ; complétion, annulation/recomplétion, compteur et reload ; pause/reprise et reload ; historique Maison ; export JSON V2 réel téléchargé et réimporté ; version inconnue refusée.
- Tests E2E adaptés au nouveau shell et au schéma V2. L'exécution complète E2E/PWA sur appareils réels n'est pas prétendue par cette revue.

## Limites

- Une récurrence hebdomadaire manquée n'apparaît plus le lendemain et revient à sa prochaine échéance ; aucun backlog automatique.
- Le dessin de forêt reste un prototype SVG original, plus géométrique que le fond peint. La croissance et la vitalité sont distinctes dans le domaine ; l'art peut être enrichi ensuite.
- Stockage local uniquement, sans synchronisation entre appareils.
