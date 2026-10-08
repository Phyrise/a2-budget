/**
 * QA « deux téléphones » de la synchronisation V5 (docs/SYNC_DESIGN.md §11),
 * sans compte Firebase : build émulateurs (`dist-emu/`, projet demo-a2home),
 * émulateurs Auth + Firestore (Java 21+ : scripts/install-java.sh), puis
 * Playwright avec deux contextes = AL et AC connectés par faux jeton Google
 * (e2e-sync/qa-two-phones.spec.ts) : temps réel dans les deux sens, hors
 * ligne des deux côtés puis fusion (forêt identique), même objet modifié
 * des deux côtés, invité sur un 3e téléphone (aucune requête serveur),
 * compte non invité refusé, session gardée (rechargement, réouverture,
 * ouverture hors ligne) ; V5.1 : quêtes communes (e2e-sync/qa-quests.spec.ts :
 * AL fait apparaître, les deux aident, récompense des deux côtés).
 *
 * Usage (depuis la racine du worktree) :
 *   node apps/web/scripts/qa-sync.mjs [port] [--all] [--no-build]
 *   --all : toute la suite émulateurs (compte, synchro, QA).
 * Ne pas lancer en même temps que `pnpm test:rules` (mêmes ports).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const port = args.find((a) => /^\d+$/.test(a)) ?? '4214';
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, commandArgs, env = {}) {
  const result = spawnSync(command, commandArgs, { cwd: webRoot, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!args.includes('--no-build')) run('pnpm', ['build:emu']);
const specs = args.includes('--all') ? [] : ['qa-two-phones', 'qa-quests'];
run('npx', ['playwright', 'test', '-c', 'playwright.sync.config.ts', ...specs], { E2E_PORT: port });
console.log('✓ QA deux téléphones : tout est passé.');
