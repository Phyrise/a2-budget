# A² Home V3 — « Prendre soin ensemble »

Objectif : faciliter le quotidien du couple et rendre agréables les tâches
pénibles, sans jamais culpabiliser. Gamification **légère et bienveillante**,
prévention douce des tensions, partage équitable de la charge — y compris la
charge mentale. Ce document sert de base à la discussion avec Arthur.

## 1. Principes (non négociables)

1. **Jamais de punition, jamais de dette visible.** Rien ne meurt, rien ne
   rougit, aucun compteur d'échecs. Une tâche non faite n'existe pas dans la
   forêt ; une tâche passée « pas aujourd'hui » est un choix légitime.
2. **Pas de compétition entre les deux.** Pas de classement, pas de score
   comparé en gros chiffres. L'équilibre se montre de façon qualitative et
   tournée vers l'entraide (« AC a beaucoup porté cette semaine — et si AL
   prenait une corvée ? »).
3. **La corvée mérite plus de douceur, pas plus de points.** Les tâches
   pénibles déclenchent une célébration plus chaleureuse (lumière plus forte,
   compagnon fier, petite phrase), sans changer les règles anti-spam du
   domaine (3 crédits/jour).
4. **Le rituel plutôt que la dispute.** Un court rituel hebdomadaire guidé
   (merci → ce qui pèse → ajuster) désamorce les tensions avant qu'elles
   n'existent ; les outils de répartition (tour à tour, « je m'en occupe »)
   retirent la négociation du quotidien.
5. **Charme > mécanique.** Jiji (pince-sans-rire, élégant) et Calcifer
   (grognon, dramatique, attachant) parlent un peu ; la forêt change avec les
   saisons ; un carnet garde la mémoire de ce qui a été vécu.
6. **Local, privé, rapide.** Toujours hors ligne, rien sur le réseau ; cocher
   une tâche reste instantané ; `prefers-reduced-motion` respecté partout.

## 2. Ce qui est implémenté cette nuit

### Domaine (`packages/core`, rétrocompatible, schemaVersion 2, champs optionnels)
- **Effort** d'une tâche `effort?: 1 | 2 | 3` (petit geste · tâche · corvée).
- **Tour à tour** `rotation?: boolean` : l'assignation alterne entre AL et AC
  à chaque occurrence (`nextAssignee`) — fini « c'est à qui ? ».
- **Qui l'a vraiment fait** `ChoreCompletion.doneBy?` : « je m'en occupe »,
  « c'est AC qui l'a fait » — la répartition suit la réalité, et l'aide
  devient visible (occasion de dire merci).
- **Hebdomadaire souple** `flexible?: true` (récurrence weekly) : à faire
  n'importe quel jour de la semaine, une fois — pas d'échec « le mardi ».
- **« Pas aujourd'hui »** (`chores.skips`) : passer une occurrence sans
  pénalité ni crédit, réversible.
- **Équilibre pondéré** (`weeklyBalance`) : somme des efforts par personne
  (ensemble = moitié chacun), verdict qualitatif (calme, équilibré, l'un a
  beaucoup porté) ; **suggestions de rééquilibrage** (`rebalanceSuggestions`) :
  passer une corvée en tour à tour, confier une tâche à l'autre.
- **Cercle de la semaine** (`rituals.circles`) : merci, ce qui pèse,
  intentions — gardés en mémoire.
- **Lanternes** (`focus.sessions`) : sessions de concentration (« 10 minutes
  de rangement ») mémorisées pour le carnet.

### Interface
- Éditeur de tâche : effort, tour à tour, « jour fixe / dans la semaine ».
- Lignes de tâche : « tour d'AL », badge corvée discret, menu ⋯ : je m'en
  occupe / c'est l'autre qui l'a fait / pas aujourd'hui / modifier.
- Célébration renforcée des corvées ; **bulles des compagnons** contextuelles
  (cocher, corvée, tout fini, pause, matin, merci), éphémères.
- **Équilibre de la semaine** : visuel qualitatif (deux pierres sur une branche),
  phrase bienveillante, suggestions applicables en un geste.
- **Cercle du dimanche** : rituel guidé en 3 étapes (merci avec suggestions
  tirées de la semaine, ce qui pèse, ajuster), clôturé par un moment dans la
  forêt. Proposé du vendredi au lundi, accessible à tout moment.
- **Lanterne** : minuteur doux (5/10/15/25 min) plein écran sur la forêt,
  lanterne qui se remplit de lumière, ambiance sonore procédurale optionnelle
  (pluie, ruisseau), célébration à la fin et proposition de cocher la tâche.
- **Carnet de la forêt** : créatures rencontrées (avec un mot de légende),
  stades du cèdre, souvenirs (plus longue série, gardien, cercles, lanternes).
- **Saisons** dans la forêt selon la date réelle (automne : feuilles qui
  tombent ; hiver : neige ; printemps : pétales ; été : lucioles).

## 3. Pistes pour la suite (à discuter)

- **Synchronisation entre les deux téléphones** — le prérequis de toutes les
  fonctions de couple « à distance » (merci envoyé, échange de tâches,
  demande d'aide). Options : (a) échange manuel chiffré par fichier/QR avec
  fusion déterministe (zéro serveur) ; (b) petit serveur maison
  (`FUTURE_SYNC.md` : Fastify + SQLite via tunnel) ; (c) CRDT (Automerge/Yjs)
  via un relais. Recommandation : (a) puis (b).
- **Rappels** doux (notifications) : nécessitent un serveur push ; alternative
  : export `.ics` des tâches récurrentes vers le calendrier.
- **Jours « off »** par personne (malade, déplacement) : la forêt et la
  répartition en tiennent compte automatiquement.
- **Repas ↔ courses** : planifier 3 repas, générer la liste.
- **Budget bienveillant** : objectifs d'épargne communs visualisés dans la
  forêt (un pont, une lanterne…), sans jugement des dépenses.
- **Saisie rapide** à la voix ou par raccourci iOS ; widget écran d'accueil.
- **Tâches invisibles** (charge mentale) : penser aux anniversaires, prendre
  RDV… comptées comme des tâches à part entière.
