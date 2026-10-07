/**
 * Taux communs (V4.2 : globaux) et copie de sécurité d'avant V3.1.
 * - Les taux changés dans les Réglages valent pour le mois courant et les
 *   suivants ; les mois passés gardent les leurs (le solde ne bouge pas).
 * - Réglages anciens divergents : alignés sans bruit au chargement (A fait foi).
 * - Copie de sécurité d'avant V3.1 écrite une seule fois.
 * États de départ construits avec @a2/core (validateAppState).
 */
import { createMonthRecord, emptyAppState, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, closeSheet, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

const BACKUP_KEY = 'a2-budget:backup-pre-v31';

function currentKey(offset = 0): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
}

/** Réglages hérités : A 40 % / 20 %, B 30 % / 15 % ; mois courant aux taux d'origine. */
function divergentState(): AppState {
  const s = emptyAppState();
  const settings = {
    ...s.budget.settings,
    personB: { ...s.budget.settings.personB, baseRateBps: 3000, variableRateBps: 1500 },
  };
  const key = currentKey();
  const month = createMonthRecord(key, s.budget.settings);
  const state: AppState = {
    ...s,
    budget: {
      settings,
      months: [{ ...month, personB: { ...month.personB, baseRateBps: 3000, variableRateBps: 1500 } }],
      selectedMonth: key,
    },
  };
  const v = validateAppState(state);
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

async function openSeeded(page: Page, raw: string) {
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('corr-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'budget', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('corr-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: raw },
  );
  await page.goto(`${APP}?module=budget`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

/** Trois mois aux taux par défaut (40 % / 20 %) : le précédent, le courant, le suivant. */
function threeMonths(): AppState {
  const s = emptyAppState();
  const months = [-1, 0, 1].map((offset) => createMonthRecord(currentKey(offset), s.budget.settings));
  const state: AppState = { ...s, budget: { settings: s.budget.settings, months, selectedMonth: currentKey() } };
  const v = validateAppState(state);
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

type Rated = { monthKey: string; personA: { baseRateBps: number }; personB: { baseRateBps: number; variableRateBps: number } };

test.describe('Taux communs globaux et copie de sécurité', () => {
  test('changer le taux : le mois courant et les suivants suivent, le mois passé et le solde non', async ({ page }) => {
    await openSeeded(page, JSON.stringify(threeMonths()));
    await expect(page.getByTestId('contribution-a')).toHaveText(/880\s€/u);
    const balance = await page.getByTestId('balance-now').textContent();

    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const settings = sheet(page, 'Réglages');
    const base = settings.getByRole('slider', { name: 'Taux de base' });
    await base.focus();
    for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowLeft');
    await expect(base).toHaveAttribute('aria-valuetext', /^30\s%$/u);
    // L'exemple suit : 30 % × 3 000 € + 20 % × 500 € = 1 000 €.
    await expect(settings.getByTestId('rates-example')).toContainText(/1\s000\s€/u);
    await expect.poll(async () => {
      const s = await persisted(page);
      const by = (k: string) => (s.budget.months as Rated[]).find((m) => m.monthKey === k)!;
      return [s.budget.settings.personB.baseRateBps, ...[-1, 0, 1].map((o) => by(currentKey(o)).personA.baseRateBps)];
    }).toEqual([3000, 4000, 3000, 3000]);
    await closeSheet(page, 'Réglages');

    // Part à verser à jour (30 % × 2 200 €) ; le solde reporté ne bouge pas.
    await expect(page.getByTestId('contribution-a')).toHaveText(/660\s€/u);
    await expect(page.getByTestId('balance-now')).toHaveText(balance ?? '');
    await expect(page.getByText(/taux communs à ce mois|taux différents/u)).toHaveCount(0);
  });

  test('réglages anciens divergents : alignés sans un mot (A fait foi), mois courant compris', async ({ page }) => {
    await openSeeded(page, JSON.stringify(divergentState()));
    await expect.poll(async () => {
      const s = await persisted(page);
      const m = (s.budget.months as Rated[]).find((x) => x.monthKey === s.budget.selectedMonth)!;
      return [s.budget.settings.personB.baseRateBps, s.budget.settings.personB.variableRateBps, m.personB.baseRateBps, m.personB.variableRateBps];
    }).toEqual([4000, 2000, 4000, 2000]);
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const settings = sheet(page, 'Réglages');
    await expect(settings.getByText(/taux différents|Les rendre communs/u)).toHaveCount(0);
    await expect(settings.getByText(/Appliquer au mois affiché|Réserve/u)).toHaveCount(0);
  });

  test('données d’avant V3.1 : copie de sécurité brute, écrite une seule fois', async ({ page }) => {
    const key = currentKey();
    const s = emptyAppState();
    const legacyMonth = { ...createMonthRecord(key, s.budget.settings), salaryBCents: 367_500 } as Record<string, unknown>;
    delete legacyMonth.bonusACents;
    delete legacyMonth.bonusBCents;
    const raw = JSON.stringify({ ...s, budget: { ...s.budget, months: [legacyMonth], selectedMonth: key } });
    await openSeeded(page, raw);

    await expect.poll(async () => (await persisted(page)).budget.months[0].bonusBCents).toBe(67_500);
    expect(await page.evaluate((k) => localStorage.getItem(k), BACKUP_KEY)).toBe(raw);

    // Rechargé au nouveau format : la copie n'est ni remplacée ni effacée.
    await page.reload();
    await expect(page.locator('.screen-sheet')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), BACKUP_KEY)).toBe(raw);
  });

  test('données déjà au format V3.1 : aucune copie de sécurité', async ({ page }) => {
    await openSeeded(page, JSON.stringify(divergentState()));
    await expect.poll(async () => (await persisted(page)).budget.months.length).toBe(1);
    expect(await page.evaluate((k) => localStorage.getItem(k), BACKUP_KEY)).toBeNull();
  });
});
