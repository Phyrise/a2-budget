/**
 * Composition des morceaux JS (docs/PERF.md) : octets du code minifié
 * attribués à leur source (dossier de src/, @a2/core, paquet npm) grâce aux
 * cartes de source, plus les images inlinées en base64.
 *
 *   npx vite build --sourcemap --outDir /tmp/a2-dist-map --emptyOutDir
 *   node scripts/perf-probe.mjs composition /tmp/a2-dist-map
 *
 * (Build à part : le dist/ de production n'a pas de cartes.)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { kb } from './perf-storage.mjs';

// source-map-js vient avec postcss (dépendance de Vite) : pas de dépendance en plus.
function consumer() {
  const fromVite = createRequire(createRequire(import.meta.url).resolve('vite'));
  return createRequire(fromVite.resolve('postcss'))('source-map-js').SourceMapConsumer;
}

const group = (src) =>
  src
    .replace(/^.*node_modules\/\.pnpm\/[^/]+\/node_modules\//, 'npm:')
    .replace(/^(npm:(@[^/]+\/)?[^/]+).*/, '$1')
    .replace(/^.*\/apps\/web\/src\/(features\/[^/]+|[^/]+).*/, 'src/$1')
    .replace(/^.*packages\/core\/src.*/, '@a2/core');

export function composition(dist) {
  const SourceMapConsumer = consumer();
  const out = [];
  for (const file of readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(join(dist, 'assets', file), 'utf8');
    let raw;
    try {
      raw = JSON.parse(readFileSync(join(dist, 'assets', `${file}.map`), 'utf8'));
    } catch {
      continue;
    }
    const lines = code.split('\n');
    const bytes = new Map();
    let prev = null;
    new SourceMapConsumer(raw).eachMapping((m) => {
      if (prev !== null) {
        const n = m.generatedLine === prev.line ? m.generatedColumn - prev.col : lines[prev.line - 1].length - prev.col;
        const k = group(prev.src);
        bytes.set(k, (bytes.get(k) ?? 0) + n);
      }
      prev = { src: m.source ?? '?', line: m.generatedLine, col: m.generatedColumn };
    });
    const inlined = code.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g) ?? [];
    out.push({
      file,
      raw: code.length,
      inlinedImages: { count: inlined.length, bytes: inlined.reduce((s, x) => s + x.length, 0) },
      sources: [...bytes].sort((a, b) => b[1] - a[1]).map(([source, n]) => ({ source, bytes: n })),
    });
  }
  return out.sort((a, b) => b.raw - a.raw);
}

export function printComposition(list) {
  for (const c of list) {
    console.log(`\n== ${c.file} : ${kb(c.raw)} (images en base64 : ${c.inlinedImages.count}, ${kb(c.inlinedImages.bytes)}) ==`);
    for (const s of c.sources.slice(0, 20)) console.log(`  ${s.source.padEnd(32)} ${kb(s.bytes).padStart(11)}`);
  }
}
