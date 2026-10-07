/** Le helper d'auth testé à sec : faux réseau, dossier temporaire. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HELPER_FILES, PAGES_DIR, RAW_DIR, downloadHelper, isProjectId, planHelper } from './firebase-auth-helper.mjs';

const PROJECT = 'a2-home-7f3c1';
let dirs = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'a2-auth-helper-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

/** Un faux firebaseapp.com : chaque fichier renvoie un contenu reconnaissable. */
function fakeFetch({ projectId = PROJECT, missing } = {}) {
  const seen = [];
  const impl = async (url) => {
    seen.push(url);
    const path = new URL(url).pathname.slice(1);
    if (path === missing) return new Response('nope', { status: 404 });
    if (path.endsWith('init.json')) return Response.json({ projectId, apiKey: 'AIza-test' });
    if (path.endsWith('.js')) return new Response(`/* ${path} */`);
    return new Response(`<!DOCTYPE html><script src="/${path}.js"></script>`);
  };
  return { impl, seen };
}

describe('firebase-auth-helper', () => {
  it('refuse un ID de projet invalide', () => {
    expect(isProjectId(PROJECT)).toBe(true);
    for (const bad of ['', 'A2-Home', 'a2', 'a2-home-', 'x'.repeat(31), 'evil.com/x']) {
      expect(isProjectId(bad)).toBe(false);
    }
    expect(() => planHelper('evil.com/x', '/tmp')).toThrow(/invalide/);
  });

  it('plan : URL firebaseapp.com, pages .html pour GitHub Pages, noms bruts à part', () => {
    const plan = planHelper(PROJECT, '/out');
    expect(plan.map((p) => p.url)).toContain(`https://${PROJECT}.firebaseapp.com/__/auth/handler`);
    const handler = plan.find((p) => p.path === '__/auth/handler');
    expect(handler.pages).toBe(`/out/${PAGES_DIR}/__/auth/handler.html`);
    expect(handler.raw).toBe(`/out/${RAW_DIR}/__/auth/handler`);
    const js = plan.find((p) => p.path === '__/auth/handler.js');
    expect(js.pages).toBe(`/out/${PAGES_DIR}/__/auth/handler.js`);
    expect(plan).toHaveLength(HELPER_FILES.length);
  });

  it('écrit les deux formes et .nojekyll', async () => {
    const out = tmp();
    const { impl, seen } = fakeFetch();
    await downloadHelper({ projectId: PROJECT, outDir: out, fetchImpl: impl });
    expect(seen).toHaveLength(HELPER_FILES.length);
    const pages = join(out, PAGES_DIR);
    expect(existsSync(join(pages, '.nojekyll'))).toBe(true);
    for (const name of ['handler', 'iframe', 'links']) {
      expect(readFileSync(join(pages, `__/auth/${name}.html`), 'utf8')).toContain('<script');
      // Sans extension, GitHub Pages servirait un téléchargement : jamais côté Pages.
      expect(existsSync(join(pages, `__/auth/${name}`))).toBe(false);
      expect(existsSync(join(out, RAW_DIR, `__/auth/${name}`))).toBe(true);
    }
    expect(JSON.parse(readFileSync(join(pages, '__/firebase/init.json'), 'utf8')).projectId).toBe(PROJECT);
    expect(existsSync(join(pages, '__/auth/experiments.js'))).toBe(true);
  });

  it('n’écrit rien si un fichier manque ou si init.json est d’un autre projet', async () => {
    const out = tmp();
    await expect(
      downloadHelper({ projectId: PROJECT, outDir: out, fetchImpl: fakeFetch({ missing: '__/auth/links.js' }).impl }),
    ).rejects.toThrow(/HTTP 404/);
    await expect(
      downloadHelper({ projectId: PROJECT, outDir: out, fetchImpl: fakeFetch({ projectId: 'autre-projet' }).impl }),
    ).rejects.toThrow(/autre-projet/);
    expect(existsSync(join(out, PAGES_DIR))).toBe(false);
  });
});
