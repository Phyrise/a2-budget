/**
 * Invité = Firebase jamais chargé : seul `sdk/` importe `firebase/*`, et
 * seul `loader.ts` atteint `sdk/`, par un import dynamique (chunk à part).
 * Le build le confirme (scripts/check-firebase-split.mjs).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const files = sources(SRC).map((path) => ({ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }));

/** Spécificateurs importés statiquement (import … from, import '…', export … from). */
function staticImports(text: string): string[] {
  return [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  );
}

describe('Firebase reste dans son chunk', () => {
  it('seul sync/firebase/sdk/ importe le SDK', () => {
    const offenders = files
      .filter((f) => !f.path.startsWith('sync/firebase/sdk/'))
      .filter((f) => staticImports(f.text).some((spec) => spec === 'firebase' || spec.startsWith('firebase/') || spec.startsWith('@firebase/')))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(files.some((f) => f.path.startsWith('sync/firebase/sdk/'))).toBe(true);
  });

  it('personne n’importe sdk/ statiquement ; loader.ts seul, en dynamique', () => {
    const outside = files.filter((f) => !f.path.startsWith('sync/firebase/sdk/'));
    const staticOffenders = outside.filter((f) => staticImports(f.text).some((spec) => /(^|\/)sdk(\/|$)/.test(spec))).map((f) => f.path);
    expect(staticOffenders).toEqual([]);
    const dynamic = outside.filter((f) => /import\(\s*['"][^'"]*sdk\//.test(f.text)).map((f) => f.path);
    expect(dynamic).toEqual(['sync/firebase/loader.ts']);
  });

  it('le reste du compte passe par loader.ts (jamais par le SDK)', () => {
    const account = files.filter((f) => f.path.startsWith('account/'));
    expect(account.length).toBeGreaterThan(0);
    for (const f of account) expect(f.text).not.toMatch(/from ['"]firebase/);
  });
});
