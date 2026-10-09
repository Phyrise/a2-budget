#!/usr/bin/env node
/**
 * Sonde « connecté » (docs/PERF.md) sur les émulateurs Firebase : foyer
 * réaliste migré par AL, rejoint par AC, puis on compte.
 *
 *   pnpm --filter @a2/web build:emu
 *   (émulateurs lancés à part, ports 8180/9180, sous verrou /tmp/a2-emu.lock)
 *   node scripts/perf-emu.mjs [--months 12] [--port 4284] [--presence 130]
 *
 * ATTENTION : vide la base et les comptes des émulateurs (comme e2e-sync).
 *
 * Mesures : documents et taille du foyer côté serveur (formule de stockage
 * Firestore, hors index), stockage des téléphones (IndexedDB du SDK,
 * localStorage), documents reçus par les écouteurs (≈ lectures facturées :
 * chaque document reçu = 1 lecture, chaque requête vide = 1 lecture) à la
 * migration, à la réouverture et quand AC rejoint ; écritures et documents
 * reçus pendant `--presence` secondes, les deux téléphones ouverts au repos.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { householdState } from './perf-household.mjs';
import { deviceStorage, kb, printStorage } from './perf-storage.mjs';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-a2home';
const FS = 'http://127.0.0.1:8180';
const AUTH = 'http://127.0.0.1:9180';
const DOCS = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
const HOME = 'households/a2home';
const SUBS = ['tasks', 'completions', 'skips', 'forestEvents', 'focusSessions', 'groceries', 'groceryHistory', 'events', 'months', 'balanceCorrections',
  'circles', 'settings', 'checkpoints', 'meta', 'quests', 'memberState', 'play', 'activity', 'push'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const o = { months: 12, port: 4284, presence: 130 };
for (let i = 2; i < process.argv.length; i += 2) o[process.argv[i].replace(/^--/, '')] = Number(process.argv[i + 1]);

/** Taille de stockage Firestore d'une valeur REST (octets, formule publiée). */
function valueSize(v) {
  if ('stringValue' in v) return Buffer.byteLength(v.stringValue) + 1;
  if ('mapValue' in v) return Object.entries(v.mapValue.fields ?? {}).reduce((s, [k, x]) => s + Buffer.byteLength(k) + 1 + valueSize(x), 0);
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).reduce((s, x) => s + valueSize(x), 0);
  if ('booleanValue' in v || 'nullValue' in v) return 1;
  return 8; // nombres, horodatages
}
const docSize = (d) => d.name.split('/documents/')[1].split('/').reduce((s, seg) => s + Buffer.byteLength(seg) + 1, 16) + valueSize({ mapValue: { fields: d.fields ?? {} } }) + 32;

async function inventory() {
  const out = {};
  const get = (path) => fetch(`${DOCS}/${path}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
  for (const name of SUBS) {
    let docs = [];
    let token = '';
    do {
      const body = await get(`${HOME}/${name}?pageSize=300${token ? `&pageToken=${token}` : ''}`);
      docs = docs.concat(body.documents ?? []);
      token = body.nextPageToken ?? '';
    } while (token);
    if (docs.length) out[name] = { docs: docs.length, bytes: docs.reduce((s, d) => s + docSize(d), 0) };
  }
  const home = await get(HOME);
  out.households = { docs: 1, bytes: home.name ? docSize(home) : 0 };
  return out;
}

/** Trafic Firestore d'une page : documents reçus par les écouteurs, écritures envoyées, octets. */
function traffic(page) {
  const t = { docsIn: 0, targets: 0, writes: 0, bytesIn: 0, bytesOut: 0 };
  const open = new Map(); // requête en cours -> heure de départ (longues interrogations du canal)
  page.on('requestfinished', (req) => open.delete(req));
  page.on('requestfailed', (req) => open.delete(req));
  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes(':8180')) return;
    open.set(req, Date.now());
    const body = decodeURIComponent((req.postData() ?? '').replace(/\+/g, ' '));
    t.bytesOut += body.length;
    if (url.includes('/Listen/channel')) t.targets += (body.match(/"addTarget"/g) ?? []).length;
    if (url.includes('/Write/channel')) t.writes += (body.match(/"(update|delete|transform)"\s*:/g) ?? []).filter((m) => !m.includes('transform')).length;
    if (url.includes(':commit')) t.writes += (JSON.parse(req.postData() ?? '{}').writes ?? []).length;
  });
  page.on('response', async (res) => {
    if (!res.url().includes(':8180')) return;
    try {
      const text = await res.text();
      t.bytesIn += text.length;
      if (res.url().includes('/Listen/channel')) t.docsIn += (text.match(/"documentChange"/g) ?? []).length;
      if (res.url().includes(':runQuery') || res.url().includes(':batchGet')) t.docsIn += (text.match(/"document"\s*:/g) ?? []).length;
    } catch {
      /* flux coupé */
    }
  });
  return {
    /** Attend la fin des interrogations parties avant maintenant (leurs documents arrivent à la fin). */
    async drain(maxMs = 120_000) {
      const mark = Date.now();
      const end = mark + maxMs;
      while (Date.now() < end && [...open.values()].some((t0) => t0 <= mark)) await sleep(500);
      await sleep(500);
    },
    take() {
      const copy = { ...t };
      Object.assign(t, { docsIn: 0, targets: 0, writes: 0, bytesIn: 0, bytesOut: 0 });
      return copy;
    },
  };
}

async function signIn(page, email) {
  await page.waitForFunction(() => '__a2qa' in window);
  await page.evaluate((e) => window.__a2qa.signInAs(e, true), email);
}
const synced = (page) => page.locator('.sync-indicator[title="À jour"]').waitFor({ timeout: 180_000 });

async function main() {
  const up = await fetch(`${FS}/`).then(() => true, () => false);
  if (!up) throw new Error('Émulateurs injoignables (8180/9180) : lance-les sous verrou d’abord');
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const url = `http://127.0.0.1:${o.port}/a2-budget/`;
  const preview = spawn('npx', ['vite', 'preview', '--outDir', 'dist-emu', '--port', String(o.port), '--strictPort'], { cwd: webRoot, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60 && !(await fetch(url).then((r) => r.ok, () => false)); i += 1) await sleep(500);

  const state = await householdState(o.months);
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const phone = async (seed) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await context.addInitScript(
      ([s]) => {
        if (localStorage.getItem('a2-budget:ui:v1') !== null) return;
        if (s) localStorage.setItem('a2-budget:state:v1', s);
        localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'maison', guardianSeen: true, offlineAnnounced: true, lanternIntroSeen: true }));
      },
      [seed ? JSON.stringify(state) : null],
    );
    const page = await context.newPage();
    return { context, page, net: traffic(page) };
  };
  const r = { months: o.months, localStateChars: JSON.stringify(state).length };

  const al = await phone(true);
  await al.page.goto(url);
  await signIn(al.page, 'arthur.longuefosse@gmail.com');
  const t0 = Date.now();
  await al.page.getByRole('button', { name: 'Y mettre mes données' }).click();
  await synced(al.page);
  const migrationMs = Date.now() - t0;
  await al.net.drain();
  r.migration = { ms: migrationMs, ...al.net.take() };
  r.server = await inventory();
  r.migration.serverDocs = Object.values(r.server).reduce((s, c) => s + c.docs, 0);

  // Au-delà du chevauchement de 2 min des curseurs : la réouverture ne relit que le neuf.
  await sleep(150_000);
  await al.net.drain();
  al.net.take();
  await al.page.reload();
  await synced(al.page);
  await al.net.drain();
  r.reopen = al.net.take();

  const ac = await phone(false);
  await ac.page.goto(url);
  await signIn(ac.page, 'blabladodo24@gmail.com');
  await ac.page.getByRole('button', { name: 'La rejoindre' }).click();
  await synced(ac.page);
  await ac.net.drain();
  r.join = ac.net.take();
  await al.net.drain();
  al.net.take();

  // Les deux ouverts sur Maison, sans rien toucher : battements de présence.
  await sleep(o.presence * 1000);
  await Promise.all([al.net.drain(), ac.net.drain()]);
  r.presence = { seconds: o.presence, al: al.net.take(), ac: ac.net.take() };

  // Un geste : AC ajoute un article de courses.
  await ac.page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name: 'Courses', exact: true }).click();
  await Promise.all([al.net.drain(), ac.net.drain()]);
  al.net.take();
  ac.net.take();
  await ac.page.locator('#grocery-input').fill('Clémentines');
  await ac.page.locator('#grocery-input').press('Enter');
  await sleep(3_000);
  await Promise.all([al.net.drain(), ac.net.drain()]);
  r.gesture = { label: 'AC ajoute un article', al: al.net.take(), ac: ac.net.take() };

  r.storageAL = await deviceStorage(al.page);
  r.storageAC = await deviceStorage(ac.page);
  await browser.close();
  process.kill(-preview.pid);

  console.log(`\n== Connecté (émulateurs), foyer de ${o.months} mois ==`);
  const total = Object.values(r.server).reduce((s, c) => s + c.bytes, 0);
  console.log(`  serveur : ${r.migration.serverDocs} documents, ${kb(total)} (hors index)`);
  for (const [k, v] of Object.entries(r.server).sort((a, b) => b[1].bytes - a[1].bytes)) console.log(`    ${k.padEnd(20)} ${String(v.docs).padStart(5)} docs ${kb(v.bytes).padStart(10)}`);
  const line = (label, n) => console.log(`  ${label.padEnd(34)} docs reçus ${n.docsIn}, requêtes écoutées ${n.targets}, écritures ${n.writes}, ↓ ${kb(n.bytesIn)} ↑ ${kb(n.bytesOut)}`);
  line(`migration (${r.migration.ms} ms)`, r.migration);
  line('réouverture d’AL', r.reopen);
  line('AC rejoint (relecture complète)', r.join);
  line(`présence ${o.presence} s — AL`, r.presence.al);
  line(`présence ${o.presence} s — AC`, r.presence.ac);
  line('geste (AC) — chez AC', r.gesture.ac);
  line('geste (AC) — chez AL', r.gesture.al);
  printStorage(r.storageAL);
  console.log(`JSON:${JSON.stringify(r)}`);
}

await main();
