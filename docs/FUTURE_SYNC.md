# A² Budget — synchronisation future (V2)

Document de cadrage uniquement : **rien de ce qui suit n'est implémenté en V1**.
La V1 est 100 % locale (localStorage) et l'export/import JSON est une
sauvegarde / un transfert manuel, pas une synchronisation.

## Chaîne cible

```
PWA (GitHub Pages)
      │
      ▼
Tunnel HTTPS (Tailscale Fun / Cloudflare Tunnel / reverse proxy local)
      │
      ▼
Authentification (compte unique par couple, session locale)
      │
      ▼
API Fastify (TypeScript, serveur local)
      │
      ▼
SQLite (fichier local, sauvegardé)
```

- **Fastify** : petite API TypeScript légère, adaptée à un usage domestique.
- **SQLite** : un seul fichier, facile à sauvegarder et à migrer.
- Le frontend ne change presque pas : `StorageAdapter` est déjà l'abstraction
  ; une `ApiStorageAdapter` implémentera la même interface
  (`load()` / `save(state)`) à la place de `LocalStorageAdapter`.

## Travaux futurs à prévoir (hors V1)

1. **Migration des données** : importer l'état localStorage
   (`a2-budget:state:v1`) dans SQLite au premier appariement d'un appareil ;
   conserver la version du schéma (`schemaVersion`) des deux côtés.
2. **Résolution de conflits** : deux appareils modifiant le même mois —
   stratégie à définir (horodatage + champ par champ, ou « dernier gagnant »
   par entité) ; l'export/import manuel reste le filet de sécurité.
3. **Authentification** : compte unique par couple, pas de multi-tenancy ;
   secrets côté serveur uniquement, jamais dans le frontend.
4. **Sécurité** : HTTPS obligatoire (le tunnel le fournit), pas de données
   financières dans les URLs ni les logs.

## Ce que la V1 prépare déjà

- `StorageAdapter` asynchrone minimal (`apps/web/src/state/storage.ts`).
- État versionné et validé à l'exécution (`validatePersistedState` dans
  `@a2/core`).
- Export JSON versionné avec enveloppe `{ app, schemaVersion, exportedAt, state }`.
