#!/usr/bin/env node
/**
 * Vérifie un build (V5) : le SDK Firebase ne fait jamais partie de ce que
 * la page charge au démarrage (invité = Firebase jamais chargé).
 *
 *   node scripts/check-firebase-split.mjs [dist] [--emulators] [--no-config]
 *
 * - Sans configuration : aucun fichier du build ne contient Firebase.
 * - Avec configuration : Firebase vit dans un chunk à part, atteint seulement
 *   par un import dynamique ; ni l'entrée de index.html ni ses imports
 *   statiques ne le contiennent.
 * - `--no-config` (build e2e, mode « e2e ») : exige qu'aucun fichier ne
 *   contienne Firebase (`.env.production` non chargé).
 * - La porte de QA (faux jeton Google, `__a2qa`) n'existe que dans le build
 *   émulateurs (`--emulators`) ; jamais ailleurs.
 *
 * Appelé après `vite build` (scripts build, build:emu et build:e2e de apps/web).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Adresses que seul le SDK Firebase contient (Auth et Firestore). */
export const SDK_MARKERS = ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com'];
/** Porte de QA du build émulateurs. */
export const QA_MARKER = '__a2qa';

/** Imports statiques et dynamiques d'un chunk minifié (chemins relatifs « ./x.js »). */
export function chunkImports(code) {
  const statics = [...code.matchAll(/(?:\bfrom|\bimport)\s*"(\.\/[^"]+\.js)"/g)].map((m) => m[1]);
  const dynamics = [...code.matchAll(/\bimport\(\s*"(\.\/[^"]+\.js)"\s*\)/g)].map((m) => m[1]);
  return { statics, dynamics };
}

/** Scripts d'entrée de index.html (chemins sous assets/). */
export function entryScripts(html) {
  return [...html.matchAll(/<script[^>]*\btype="module"[^>]*\bsrc="[^"]*?\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
}

const hasSdk = (code) => SDK_MARKERS.some((marker) => code.includes(marker));

/**
 * Analyse un build donné sous forme { 'chemin relatif': contenu }.
 * Rend la liste des problèmes (vide = conforme).
 */
export function checkBuild(files, { emulators = false, noConfig = false } = {}) {
  const problems = [];
  const html = files['index.html'];
  if (html === undefined) return ['index.html absent'];
  const entries = entryScripts(html);
  if (entries.length === 0) problems.push('aucun script d’entrée dans index.html');

  // Graphe statique depuis l'entrée : ce que la page charge avant tout choix.
  const seen = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const code = files[path];
    if (code === undefined) {
      problems.push(`${path} : importé mais absent`);
      continue;
    }
    if (hasSdk(code)) problems.push(`${path} : Firebase chargé au démarrage`);
    const dir = path.slice(0, path.lastIndexOf('/') + 1);
    for (const spec of chunkImports(code).statics) queue.push(dir + spec.slice(2));
  }

  const withSdk = Object.keys(files).filter((path) => path.endsWith('.js') && hasSdk(files[path]));
  if (emulators && withSdk.length === 0) problems.push('build émulateurs sans chunk Firebase');
  if (noConfig && withSdk.length > 0) problems.push(`Firebase présent dans un build sans configuration : ${withSdk.join(', ')}`);
  const withQa = Object.keys(files).filter((path) => files[path].includes(QA_MARKER));
  if (!emulators && withQa.length > 0) problems.push(`porte de QA hors build émulateurs : ${withQa.join(', ')}`);
  return problems;
}

function readBuild(dir) {
  const files = {};
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(js|mjs|html)$/.test(name)) files[relative(dir, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(dir);
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((arg) => !arg.startsWith('--')) ?? 'dist');
  const emulators = args.includes('--emulators');
  const files = readBuild(dir);
  const problems = checkBuild(files, { emulators, noConfig: args.includes('--no-config') });
  const sdkChunks = Object.keys(files).filter((path) => path.endsWith('.js') && hasSdk(files[path]));
  if (problems.length > 0) {
    console.error(`✗ Firebase / ${relative(process.cwd(), dir) || '.'} :\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(
    sdkChunks.length === 0
      ? '✓ Firebase absent du build (aucune configuration).'
      : `✓ Firebase à part (${sdkChunks.join(', ')}), jamais chargé au démarrage.`,
  );
}
