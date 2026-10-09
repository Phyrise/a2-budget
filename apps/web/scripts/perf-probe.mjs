#!/usr/bin/env node
/**
 * Sonde de charge (V5.4, docs/PERF.md) — mesure, ne change rien à l'app.
 *
 *   node scripts/perf-probe.mjs bundle [dist]        poids du build (JS/CSS brut + gzip,
 *                                                     images, polices, précache du SW)
 *   node scripts/perf-probe.mjs runtime [options]    exécution, téléphone émulé (voir perf-runtime.mjs)
 *   node scripts/perf-probe.mjs household [mois]     foyer réaliste (JSON sur la sortie)
 *
 * Prérequis : `pnpm --filter @a2/web build` (dist/). Sortie : texte lisible
 * puis une ligne `JSON:` (résultat complet, pour comparer deux versions).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { kb, mb } from './perf-storage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');


function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Dimensions d'une image WebP ou PNG (en-tête seulement). */
export function imageSize(buf) {
  if (buf.toString('ascii', 1, 4) === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

/** Famille d'une image (nom sans empreinte ni numéro). */
const FAMILIES = [
  ['peintures forêt (saison en cours)', /^stage-\d/],
  ['peintures forêt (autres saisons, à la demande)', /^season-(spring|autumn|winter)-stage/],
  ['LUT nuit / ambiances forêt', /^(season-.*-lut-night|night|quiet|peaceful|lively|lut)/],
  ['bandeaux Budget/Courses (saison en cours)', /^banner-(landscape|portrait)/],
  ['bandeaux de saison (à la demande)', /^season-(budget|courses)-/],
  ['compagnon Jiji', /^jiji-/],
  ['compagnon Calcifer', /^calcifer-/],
  ['Kiki (Courses)', /^kiki-/],
  ['Noiraudes (Budget)', /^susuwatari-|^soot/],
  ['Totoro (Calendrier, Maison)', /totoro/],
  ['Chat-bus (Calendrier)', /^catbus/],
  ['Sans-Visage', /^noface-/],
  ['kodamas et créatures', /^(kodama|silhouette-|moss-ling|seed-spirit|leaf-sprite|ember-wisp|mushroom-pip|water-drip)/],
  ['lanternes de pierre', /^lantern-/],
  ['effets forêt (brume, rayons, lucioles…)', /^(fog|rays|motes|halos|sparkles|needles|masks|grain|glow)/],
  ['pièces d’or / Chihiro (Budget)', /^(gold-coin|chihiro|bathhouse|haku|yubaba)/],
  ['scènes non affichées', /^(scene-bridge|courses-)/],
  ['icônes PWA', /^(icon|apple-touch|favicon)/],
];

function family(file) {
  const base = file.replace(/^.*\//, '');
  for (const [label, re] of FAMILIES) if (re.test(base)) return label;
  return 'autres images';
}

/** Liste du précache lue dans dist/sw.js (injectManifest). */
function precacheList(dist) {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  return new Set([...sw.matchAll(/"?url"?\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
}

export function bundle(dist = join(webRoot, 'dist')) {
  const files = walk(dist).map((abs) => ({ abs, rel: relative(dist, abs).split('\\').join('/'), size: statSync(abs).size }));
  const precached = precacheList(dist);
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const entryJs = [...html.matchAll(/src="\/a2-budget\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const entryCss = [...html.matchAll(/href="\/a2-budget\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]);
  const role = (rel) => {
    if (entryJs.includes(rel) || entryCss.includes(rel)) return 'démarrage (toujours)';
    if (/session-/.test(rel)) return 'Firebase (connecté seulement)';
    if (/NoiraudesLab/.test(rel)) return 'labo DEV (mode développeur)';
    if (/workbox-window/.test(rel)) return 'mise à jour du SW';
    if (/^sw\.js$/.test(rel)) return 'service worker';
    const src = readFileSync(join(dist, rel), 'utf8');
    if (/ogl|WebGL|gl_FragColor|precision mediump/.test(src)) return 'moteur forêt WebGL (Maison/fond)';
    return 'morceau différé';
  };

  const code = files
    .filter((f) => /\.(js|css)$/.test(f.rel))
    .map((f) => {
      const buf = readFileSync(f.abs);
      return { file: f.rel, raw: f.size, gzip: gzipSync(buf, { level: 9 }).length, brotli: brotliCompressSync(buf).length, role: role(f.rel), precached: precached.has(f.rel) };
    })
    .sort((a, b) => b.raw - a.raw);

  const images = files
    .filter((f) => /\.(webp|png|jpg|avif|svg)$/.test(f.rel))
    .map((f) => {
      const dim = /\.(webp|png)$/.test(f.rel) ? imageSize(readFileSync(f.abs)) : null;
      // Mémoire décodée (RGBA 8 bits) ; ×4/3 si la texture WebGL a ses mipmaps.
      return { file: f.rel, size: f.size, w: dim?.w ?? 0, h: dim?.h ?? 0, decoded: dim ? dim.w * dim.h * 4 : 0, family: family(f.rel), precached: precached.has(f.rel) };
    });
  const fams = new Map();
  for (const img of images) {
    const g = fams.get(img.family) ?? { family: img.family, count: 0, size: 0, decoded: 0, precachedSize: 0, maxW: 0, maxH: 0 };
    g.count += 1;
    g.size += img.size;
    g.decoded += img.decoded;
    if (img.precached) g.precachedSize += img.size;
    if (img.w * img.h > g.maxW * g.maxH) [g.maxW, g.maxH] = [img.w, img.h];
    fams.set(img.family, g);
  }
  const fonts = files.filter((f) => /\.woff2$/.test(f.rel));
  const sounds = files.filter((f) => /\.(mp3|ogg|wav|m4a|opus)$/.test(f.rel));
  const sizeOf = (rel) => files.find((f) => f.rel === rel)?.size ?? 0;
  const precacheBytes = [...precached].reduce((s, rel) => s + sizeOf(rel), 0);
  const startCode = code.filter((c) => c.role.startsWith('démarrage'));
  return {
    dist: relative(webRoot, dist),
    total: files.reduce((s, f) => s + f.size, 0),
    fileCount: files.length,
    code,
    start: { raw: startCode.reduce((s, c) => s + c.raw, 0), gzip: startCode.reduce((s, c) => s + c.gzip, 0), brotli: startCode.reduce((s, c) => s + c.brotli, 0) },
    imageFamilies: [...fams.values()].sort((a, b) => b.size - a.size),
    images: images.sort((a, b) => b.size - a.size),
    fonts: { count: fonts.length, size: fonts.reduce((s, f) => s + f.size, 0), files: fonts.map((f) => ({ file: f.rel, size: f.size })) },
    sounds: { count: sounds.length, size: sounds.reduce((s, f) => s + f.size, 0) },
    precache: { entries: precached.size, bytes: precacheBytes },
  };
}

function printBundle(r) {
  console.log(`\n== Poids du build (${r.dist}) : ${r.fileCount} fichiers, ${mb(r.total)} ==`);
  console.log('\nJS / CSS                                   brut        gzip      brotli   rôle');
  for (const c of r.code) {
    console.log(`  ${c.file.padEnd(40)} ${kb(c.raw).padStart(11)} ${kb(c.gzip).padStart(11)} ${kb(c.brotli).padStart(11)}   ${c.role}`);
  }
  console.log(`  démarrage (JS+CSS) : ${kb(r.start.raw)} brut, ${kb(r.start.gzip)} gzip, ${kb(r.start.brotli)} brotli`);
  console.log('\nImages par famille            nb      fichiers   dont précache   décodé RGBA   plus grande');
  for (const g of r.imageFamilies) {
    console.log(`  ${g.family.padEnd(48).slice(0, 48)} ${String(g.count).padStart(3)} ${mb(g.size).padStart(11)} ${mb(g.precachedSize).padStart(11)} ${mb(g.decoded).padStart(11)}   ${g.maxW}×${g.maxH}`);
  }
  console.log(`\nPolices : ${r.fonts.count} woff2, ${kb(r.fonts.size)} — sons (fichiers) : ${r.sounds.count} (${kb(r.sounds.size)})`);
  console.log(`Précache du service worker : ${r.precache.entries} entrées, ${mb(r.precache.bytes)} (téléchargés à l'installation)`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'bundle') {
  const r = bundle(args[0] ? join(process.cwd(), args[0]) : undefined);
  printBundle(r);
  console.log(`JSON:${JSON.stringify({ ...r, images: undefined })}`);
} else if (cmd === 'runtime') {
  const { runtime } = await import('./perf-runtime.mjs');
  await runtime(args);
} else if (cmd === 'household') {
  const { householdState } = await import('./perf-household.mjs');
  process.stdout.write(JSON.stringify(await householdState(Number(args[0] ?? 6))));
} else if (cmd !== undefined) {
  console.error(`Commande inconnue : ${cmd} (bundle | runtime | household)`);
  process.exit(1);
}
