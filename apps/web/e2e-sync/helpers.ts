/**
 * Aides des tests du compte (V5) sur émulateurs : remise à zéro, lecture
 * directe de Firestore (jeton « owner » de l'émulateur, règles ignorées),
 * faux jeton Google, journal réseau.
 */
import { expect, type BrowserContext, type Page } from '@playwright/test';

export const APP = '/a2-budget/';
export const STATE_KEY = 'a2-budget:state:v1';
export const ACCOUNT_KEY = 'a2-budget:account:v1';
const PROJECT = 'demo-a2home';
const FIRESTORE = `http://127.0.0.1:8180`;
const AUTH = `http://127.0.0.1:9180`;
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;

export const ARTHUR = 'arthur.longuefosse@gmail.com';
export const ALEXIA = 'blabladodo24@gmail.com';

/** Attend Auth ET Firestore (le serveur web de Playwright n'en surveille qu'un). */
export async function waitForEmulators(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const up = await Promise.all(
      [`${FIRESTORE}/`, `${AUTH}/`].map((url) =>
        fetch(url).then(
          () => true,
          () => false,
        ),
      ),
    );
    if (up.every(Boolean)) return;
    if (Date.now() > deadline) throw new Error('Émulateurs Firebase injoignables (ports 8180 / 9180)');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/** Base et comptes de l'émulateur vidés (chaque test part de rien). */
export async function resetEmulators(): Promise<void> {
  const a = await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  expect(a.ok && b.ok).toBe(true);
}

type Value =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields?: Record<string, Value> } }
  | { arrayValue: { values?: Value[] } };

function plain(value: Value): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return fields(value.mapValue.fields ?? {});
  return (value.arrayValue.values ?? []).map(plain);
}

function fields(map: Record<string, Value>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, plain(v)]));
}

/** Un document lu sans les règles, ou null s'il n'existe pas. */
export async function readDoc(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return null;
  expect(res.ok).toBe(true);
  const body = (await res.json()) as { fields?: Record<string, Value> };
  return fields(body.fields ?? {});
}

/** Comptes connus de l'émulateur Auth. */
export async function authUsers(): Promise<Array<{ localId: string; email?: string }>> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = (await res.json()) as { userInfo?: Array<{ localId: string; email?: string }> };
  return body.userInfo ?? [];
}

/** Connexion par faux jeton Google (build émulateurs seulement). */
export async function fakeGoogle(page: Page, email: string, emailVerified = true): Promise<void> {
  await page.waitForFunction(() => '__a2qa' in window);
  await page.evaluate(
    ([e, v]) => (window as unknown as { __a2qa: { signInAs: (e: string, v: boolean) => void } }).__a2qa.signInAs(e, v),
    [email, emailVerified] as const,
  );
}

/** Toutes les requêtes du contexte (page et service worker). */
export function recordRequests(context: BrowserContext): string[] {
  const urls: string[] = [];
  context.on('request', (request) => urls.push(request.url()));
  return urls;
}

/** Une requête vers Google, Firebase ou les émulateurs. */
export function isServerRequest(url: string): boolean {
  const { hostname, port } = new URL(url);
  return (
    /(^|\.)(googleapis\.com|google\.com|gstatic\.com|firebaseapp\.com|firebaseio\.com|firebase\.com|web\.app)$/.test(hostname) ||
    port === '9180' ||
    port === '8180'
  );
}

export function welcome(page: Page) {
  return page.getByRole('main', { name: 'A² Home' });
}

export async function expectApp(page: Page): Promise<void> {
  await expect(page.locator('.screen-sheet')).toBeVisible();
  await expect(welcome(page)).toHaveCount(0);
}

export async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages', exact: true });
  await expect(settings).toBeVisible();
  return settings;
}

export function accountSection(page: Page) {
  return page.getByRole('region', { name: 'Compte' });
}

/** Documents d'une collection, lus sans les règles : id → champs. */
export async function listDocs(path: string): Promise<Record<string, Record<string, unknown>>> {
  const res = await fetch(`${DOCS}/${path}?pageSize=1000`, { headers: { Authorization: 'Bearer owner' } });
  expect(res.ok).toBe(true);
  const body = (await res.json()) as { documents?: Array<{ name: string; fields?: Record<string, Value> }> };
  return Object.fromEntries((body.documents ?? []).map((d) => [d.name.slice(d.name.lastIndexOf('/') + 1), fields(d.fields ?? {})]));
}

export const SYNC_KEY = 'a2-budget:sync:v1';
export const BACKUP_KEY = 'a2-budget:backup-pre-sync';

/** L'écran de la première connexion (« Notre maison commune »). */
export function setupScreen(page: Page) {
  return page.getByRole('main', { name: 'Notre maison commune' });
}

/** Première connexion : un choix de l'écran, puis l'app. */
export async function chooseSetup(page: Page, choice: 'Y mettre mes données' | 'La rejoindre'): Promise<void> {
  await setupScreen(page).getByRole('button', { name: choice }).click();
  await expectApp(page);
}

/**
 * Première mise « À jour » : le navigateur de test rend la forêt WebGL sans
 * carte graphique et l'émulateur sert ~20 écoutes une à une ; plus que le
 * délai par défaut (15 s) sur une machine chargée.
 */
export const SYNC_READY = { timeout: 45_000 };

/** Petit nuage de la synchronisation (en-tête). */
export function syncIndicator(page: Page) {
  return page.locator('.sync-indicator');
}

export async function quickAdd(page: Page, text: string): Promise<void> {
  const input = page.locator('#grocery-input');
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

export function toBuy(page: Page, label: string) {
  return page.locator('.aisles .item-row').filter({ hasText: label });
}

/**
 * V5.4 — cocher une tâche ouvre « Qui ? » : choisit `who`, sinon la
 * personne mise en avant (prévue, sinon le compte connecté).
 */
export async function pickWho(page: Page, who?: 'a' | 'b' | 'both'): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Qui ?', exact: true });
  await expect(dialog).toBeVisible();
  const choice = who ? dialog.locator(`.who-did__choice[data-who="${who}"]`) : dialog.locator('.who-did__choice.is-suggested');
  await choice.click();
  await expect(dialog).toBeHidden();
}
