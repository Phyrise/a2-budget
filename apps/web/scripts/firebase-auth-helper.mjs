#!/usr/bin/env node
/**
 * Prépare le « helper » de connexion Firebase auto-hébergé (SYNC_DESIGN §1.1 :
 * connexion Google dans la PWA installée sur iPhone) pour le dépôt GitHub
 * Pages utilisateur « phyrise.github.io ».
 *
 *   node apps/web/scripts/firebase-auth-helper.mjs <projectId> [--out <dossier>] [--dry-run]
 *
 * Télécharge depuis https://<projectId>.firebaseapp.com les fichiers du helper
 * (__/auth/handler, handler.js, experiments.js, iframe, iframe.js, links,
 * links.js et __/firebase/init.json), vérifie chacun, puis écrit DEUX formes :
 *
 *   <out>/phyrise.github.io/  à copier tel quel à la racine du dépôt, avec
 *     .nojekyll (sinon GitHub ignore les dossiers « _ »). Les pages sans
 *     extension y deviennent handler.html, iframe.html, links.html : GitHub
 *     Pages sert handler.html pour /__/auth/handler, alors qu'un fichier sans
 *     extension partirait en téléchargement. Les noms bruts n'y sont donc pas.
 *   <out>/brut/  copie exacte, noms d'origine (autre hébergeur, comparaison).
 *
 * Rien n'est écrit si un seul fichier manque. --dry-run : affiche le plan,
 * sans réseau ni écriture. Sortie par défaut : apps/web/dist-auth-helper
 * (gitignorée : ces fichiers vont dans l'autre dépôt, pas dans celui-ci).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Fichiers servis par Firebase ; `page` = HTML sans extension. */
export const HELPER_FILES = [
  { path: '__/auth/handler', page: true },
  { path: '__/auth/handler.js' },
  { path: '__/auth/experiments.js' },
  { path: '__/auth/iframe', page: true },
  { path: '__/auth/iframe.js' },
  { path: '__/auth/links', page: true },
  { path: '__/auth/links.js' },
  { path: '__/firebase/init.json' },
];

export const PAGES_DIR = 'phyrise.github.io';
export const RAW_DIR = 'brut';

/** ID de projet Firebase : 6 à 30 caractères, minuscules, chiffres, tirets. */
export function isProjectId(id) {
  return typeof id === 'string' && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id);
}

/** Pour chaque fichier : URL source et chemins des deux formes. */
export function planHelper(projectId, outDir) {
  if (!isProjectId(projectId)) throw new Error(`ID de projet invalide : « ${projectId} »`);
  return HELPER_FILES.map(({ path, page = false }) => ({
    path,
    page,
    url: `https://${projectId}.firebaseapp.com/${path}`,
    raw: join(outDir, RAW_DIR, path),
    pages: join(outDir, PAGES_DIR, page ? `${path}.html` : path),
  }));
}

/** Contrôle minimal : une page contient un script, init.json est le bon projet. */
function checkBody(item, body, projectId) {
  if (body.length === 0) throw new Error(`${item.url} : fichier vide`);
  const text = body.toString('utf8');
  if (item.page && !/<script/i.test(text)) throw new Error(`${item.url} : pas une page du helper`);
  if (item.path.endsWith('init.json')) {
    let config;
    try {
      config = JSON.parse(text);
    } catch {
      throw new Error(`${item.url} : JSON illisible`);
    }
    if (config.projectId !== projectId) {
      throw new Error(`${item.url} : projet « ${config.projectId} », attendu « ${projectId} »`);
    }
  }
}

/** Télécharge tout, vérifie, puis écrit les deux formes (rien si une erreur). */
export async function downloadHelper({ projectId, outDir, fetchImpl = fetch }) {
  const plan = planHelper(projectId, outDir);
  const bodies = [];
  for (const item of plan) {
    const res = await fetchImpl(item.url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${item.url} : HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    checkBody(item, body, projectId);
    bodies.push(body);
  }
  for (const dir of [PAGES_DIR, RAW_DIR]) rmSync(join(outDir, dir), { recursive: true, force: true });
  plan.forEach((item, i) => {
    for (const file of [item.raw, item.pages]) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bodies[i]);
    }
  });
  writeFileSync(join(outDir, PAGES_DIR, '.nojekyll'), '');
  return plan;
}

function parseArgs(argv) {
  const args = { projectId: undefined, outDir: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--out') args.outDir = argv[++i];
    else if (!args.projectId) args.projectId = a;
    else throw new Error(`Argument inattendu : ${a}`);
  }
  return args;
}

async function main() {
  const { projectId, outDir: out, dryRun } = parseArgs(process.argv.slice(2));
  if (!projectId) {
    console.error('Usage : node apps/web/scripts/firebase-auth-helper.mjs <projectId> [--out <dossier>] [--dry-run]');
    process.exit(2);
  }
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = resolve(out ?? join(webRoot, 'dist-auth-helper'));
  const plan = planHelper(projectId, outDir);
  for (const item of plan) console.log(`${item.url}\n  → ${item.pages}\n  → ${item.raw}`);
  console.log(`  → ${join(outDir, PAGES_DIR, '.nojekyll')}`);
  if (dryRun) {
    console.log('\n(à sec : rien téléchargé, rien écrit)');
    return;
  }
  await downloadHelper({ projectId, outDir });
  console.log(`\nOK. Copie le CONTENU de ${join(outDir, PAGES_DIR)} (avec .nojekyll) à la racine`);
  console.log('du dépôt phyrise.github.io, puis vérifie https://phyrise.github.io/__/auth/handler');
  console.log('(une page vide, sans téléchargement) — suite : docs/FIREBASE_SETUP.md §7.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
