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
export const ALEXIA = 'alexia.chaval@free.fr';

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
