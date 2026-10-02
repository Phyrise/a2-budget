import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createMonthRecord, defaultSettings, type PersistedState } from '@a2/core';

const STORAGE_KEY = 'a2-budget:state:v1';

/**
 * Format fr-FR/EUR identique à l'app (Intl) : le séparateur de milliers est
 * un espace insécable étroit (U+202F), d'où l'usage d'un formateur et non de
 * chaînes littérales.
 */
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
function fmt(cents: number): string {
  return eur.format(cents / 100);
}

/**
 * Saisie d'un montant : focaliser le champ AVANT fill (le passage
 * formaté→édition modifie la chaîne), puis blur pour commit.
 */
async function setAmount(page: Page, id: string, text: string) {
  const input = page.locator(`#${id}`);
  await input.click();
  await input.fill(text);
  await input.blur();
}

async function monthKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

async function closeSheet(page: Page, title: string) {
  const sheet = page.getByRole('dialog', { name: title, exact: true });
  await sheet.locator('.overlay-sheet__close').click();
  await expect(sheet).toBeHidden();
}

function legacyReserveFixture(key: string): PersistedState {
  const settings = defaultSettings();
  settings.defaultReserveTargetCents = 50_000;
  return {
    schemaVersion: 1,
    settings,
    months: [createMonthRecord(key, settings)],
    selectedMonth: key,
  };
}

/**
 * Dépenses récurrentes par défaut (core) :
 * Loyer 1300 + Électricité 100 + Courses 400 + Internet 30 + Assurance 15 = 1845 €.
 */

test.describe('Calcul de référence', () => {
  test('2200/3675 => 880/1335/2215 ; dépenses 1845 => reste 370', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');
    await setAmount(page, 'salary-b', '3675');

    const rows = page.locator('.budget-person__contribution');
    await expect(rows.nth(0)).toHaveText(fmt(88_000));
    await expect(rows.nth(1)).toHaveText(fmt(133_500));
    await expect(page.locator('.budget-total strong')).toHaveText(fmt(221_500));

    // Dépenses par défaut = 1845 ; reste 2215 - 1845 = 370.
    const balance = page.locator('.balance-preview');
    await expect(balance.locator('strong').nth(0)).toHaveText(fmt(184_500));
    await expect(balance.locator('strong').nth(1)).toHaveText(fmt(37_000));
  });

  test('une sauvegarde V1 avec réserve est importée et conservée sans réserve visible', async ({ page }) => {
    await page.goto('/a2-budget/');
    await expect(page.locator('#salary-a')).toBeVisible();
    const key = await monthKey(page);
    const fixture = legacyReserveFixture(key);
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Réglages', exact: true })).toBeVisible();
    await page.setInputFiles('input[type="file"]', {
      name: 'budget-v1-avec-reserve.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await expect(page.locator('.import-confirm')).toBeVisible();
    await page.getByRole('button', { name: 'Remplacer', exact: true }).click();
    await expect(page.locator('.import-note--success')).toBeVisible();
    await expect(page.locator('#default-reserve')).toHaveCount(0);
    await closeSheet(page, 'Réglages');

    const rows = page.locator('.budget-person__contribution');
    await expect(rows.nth(0)).toHaveText(fmt(88_000));
    await expect(rows.nth(1)).toHaveText(fmt(120_000));
    await expect(page.locator('.budget-total strong')).toHaveText(fmt(208_000));
    await expect(page.locator('.balance-preview strong').nth(1)).toHaveText(fmt(23_500));
    await expect(page.locator('#cm-reserve')).toHaveCount(0);

    // Une nouvelle écriture ne doit pas effacer les champs V1 devenus invisibles.
    await setAmount(page, 'salary-a', '2300');
    await expect.poll(() => page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.budget;
      const month = state?.months.find((item: { monthKey: string }) => item.monthKey === state.selectedMonth);
      return {
        salary: month?.salaryACents,
        monthReserve: month?.reserveTargetCents,
        defaultReserve: state?.settings.defaultReserveTargetCents,
      };
    }, STORAGE_KEY)).toEqual({ salary: 230_000, monthReserve: 50_000, defaultReserve: 50_000 });
    await page.reload();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(230_000));
    await expect(page.locator('.balance-preview strong').nth(1)).toHaveText(fmt(25_500));
    await expect(page.locator('#cm-reserve')).toHaveCount(0);
  });
});

test.describe('Régressions de saisie', () => {
  test('brouillon invalide bloque Ajouter (même après blur) ; vide refusé ; 0 accepté', async ({
    page,
  }) => {
    await page.goto('/a2-budget/');
    const key = await monthKey(page);
    const label = page.locator('.expense-add__label');
    const amount = page.locator(`#m-${key}-add-amount`);
    const submit = page.locator('.expense-add__submit');

    await expect(label).toBeHidden();
    await page.getByRole('button', { name: 'Ajouter une dépense', exact: true }).click();
    await expect(label).toBeVisible();
    await expect(label).toBeFocused();

    await label.fill('Test');

    // « 12,345 » (trois décimales) : invalide, erreur conservée au blur.
    await amount.click();
    await amount.fill('12,345');
    await amount.blur();
    await expect(page.locator(`#m-${key}-add-amount-error`)).toBeVisible();
    await expect(submit).toBeDisabled();

    // Champ vidé : refusé (pas de commit, pas d'erreur).
    await amount.click();
    await amount.fill('');
    await amount.blur();
    await expect(submit).toBeDisabled();
    await expect(page.locator(`#m-${key}-add-amount-error`)).toBeHidden();

    // Zéro explicite : valide.
    await amount.click();
    await amount.fill('0');
    await amount.blur();
    await expect(submit).toBeEnabled();

    // Ajout validé puis reset du formulaire.
    await submit.click();
    await expect(label).toHaveValue('');
    await expect(amount).toHaveValue(fmt(0));
    await expect(page.locator('.expense-list')).toContainText('Test');
  });

  test('salaire depuis un champ nouvellement focalisé : focus/curseur conservés', async ({
    page,
  }) => {
    await page.goto('/a2-budget/');
    const salary = page.locator('#salary-a');

    // Première saisie depuis un champ vierge.
    await salary.click();
    await salary.fill('2200');
    await salary.blur();
    await expect(salary).toHaveValue(fmt(220_000));

    // Re-focalisation : la chaîne d'édition repart de la notation plate.
    await salary.click();
    await expect(salary).toHaveValue('2200');
    await salary.fill('2250,50');
    await salary.blur();
    await expect(salary).toHaveValue(fmt(225_050));
  });
});

test.describe('Persistance', () => {
  test('les données survivent à la fermeture/rechargement', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');
    await setAmount(page, 'salary-b', '3675');
    const key = await monthKey(page);
    await page.getByRole('button', { name: 'Ajouter une dépense', exact: true }).click();
    await page.locator('.expense-add__label').fill('Courses');
    await setAmount(page, `m-${key}-add-amount`, '45,50');
    await page.locator('.expense-add__submit').click();

    await page.reload();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
    await expect(page.locator('#salary-b')).toHaveValue(fmt(367_500));
    await expect(page.locator('.expense-list')).toContainText('Courses');
    // 1845 + 45,50 = 1890,50.
    await expect(page.locator('.balance-preview strong').nth(0)).toHaveText(fmt(189_050));
  });
});

test.describe('Isolation historique / réglages', () => {
  test('changer les réglages n’altère pas les mois existants', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');

    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    await setAmount(page, 'base-salary-a', '2500');
    await setAmount(page, 'base-salary-b', '3500');

    await closeSheet(page, 'Réglages');
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
    await expect(page.locator('#salary-b')).toHaveValue(fmt(300_000));
  });

  test('l’historique liste les mois sans les modifier', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2250');

    await page.getByRole('button', { name: 'Historique du budget', exact: true }).click();
    // Revenus 2250 + 3000 = 5250 ; contributions 890 + 1200 = 2090.
    await expect(page.locator('.history-list')).toContainText(fmt(525_000));
    await expect(page.locator('.history-list')).toContainText(fmt(209_000));

    await closeSheet(page, 'Historique du budget');
    await expect(page.locator('#salary-a')).toHaveValue(fmt(225_000));
  });
});

test.describe('Import / export', () => {
  test('export puis import valide confirmé ; import invalide inchangé', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');

    await page.getByRole('button', { name: 'Réglages', exact: true }).click();

    // Export.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exporter une sauvegarde' }).click(),
    ]);
    const downloadPath = await download.path();
    if (downloadPath === null) throw new Error('Le fichier de sauvegarde téléchargé est inaccessible.');
    const json = await readFile(downloadPath, 'utf8');
    expect(json).toContain('"schemaVersion"');

    // Import du même fichier : confirmation puis remplacement.
    await page.setInputFiles('input[type="file"]', {
      name: 'sauvegarde.json',
      mimeType: 'application/json',
      buffer: Buffer.from(json),
    });
    await expect(page.locator('.import-confirm')).toBeVisible();
    await page.getByRole('button', { name: 'Remplacer' }).click();
    await expect(page.locator('.import-note--error')).toBeHidden();

    // Import invalide : erreur, état inchangé.
    await page.setInputFiles('input[type="file"]', {
      name: 'invalide.json',
      mimeType: 'application/json',
      buffer: Buffer.from('ceci n’est pas un JSON de sauvegarde'),
    });
    await expect(page.locator('.import-note--error')).toContainText('invalide');

    // L’état n’a pas bougé.
    await closeSheet(page, 'Réglages');
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
  });
});

test.describe('Navigation compacte et feuilles accessibles', () => {
  for (const title of ['Réglages', 'Historique du budget']) {
    test(`Échap ferme ${title} et rend le focus à son bouton`, async ({ page }) => {
      await page.goto('/a2-budget/');
      await expect(page.locator('#salary-a')).toBeVisible();
      const opener = page.getByRole('button', { name: title, exact: true });
      await opener.click();
      const sheet = page.getByRole('dialog', { name: title, exact: true });
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.overlay-sheet__close')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(opener).toBeFocused();
      await expect(page.locator('#salary-a')).toBeVisible();
    });
  }

  test('Tab et Maj+Tab restent dans les Réglages, sans atteindre le Budget derrière', async ({ page }) => {
    await page.goto('/a2-budget/');
    await expect(page.locator('#salary-a')).toBeVisible();
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Réglages', exact: true });
    const close = sheet.locator('.overlay-sheet__close');
    await expect(close).toBeFocused();

    // Revenir depuis le premier contrôle doit boucler vers la fin du dialogue.
    await page.keyboard.press('Shift+Tab');
    expect(await sheet.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    await expect(close).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();

    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      expect(await sheet.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
    await expect(page.locator('#salary-a')).not.toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Réglages', exact: true })).toBeFocused();
  });

  test('le sélecteur de mois est dépliable et les revenus restent propres à chaque mois', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');
    const current = await monthKey(page);
    const [year, month] = current.split('-').map(Number);
    // Rester dans la même année évite de créer un mois intermédiaire en
    // changeant deux sélecteurs successivement, notamment en janvier.
    const otherMonth = month === 1 ? 2 : month - 1;
    const other = `${year}-${String(otherMonth).padStart(2, '0')}`;

    await expect(page.locator('#cm-month')).toBeHidden();
    await page.locator('.month-disclosure summary').click();
    await expect(page.locator('#cm-month')).toBeVisible();
    await page.locator('#cm-year').selectOption(String(year));
    await page.locator('#cm-month').selectOption(String(otherMonth));
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.budget.selectedMonth, STORAGE_KEY)).toBe(other);
    await setAmount(page, 'salary-a', '2400');
    await page.getByRole('button', { name: 'Revenir au mois courant', exact: true }).click();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.budget.selectedMonth, STORAGE_KEY)).toBe(current);

    const beforeHistory = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    await page.getByRole('button', { name: 'Historique du budget', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'Historique du budget', exact: true });
    await expect(history.locator('.history-item')).toHaveCount(2);
    await expect(history.locator('input, select, textarea')).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(beforeHistory);
    await closeSheet(page, 'Historique du budget');
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
  });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`${viewport.width}px : pas de débordement horizontal, modules tactiles d’au moins 44px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/a2-budget/');
      await expect(page.locator('#salary-a')).toBeVisible();
      await expect(page.locator('.bottom-nav')).toHaveCount(0);
      const navigation = page.getByRole('navigation', { name: 'Modules de la maison' });
      await expect(navigation.getByRole('button')).toHaveCount(3);
      for (const name of ['Budget', 'Maison', 'Courses']) {
        const button = navigation.getByRole('button', { name, exact: true });
        const bounds = await button.boundingBox();
        expect(bounds, `zone tactile ${name}`).not.toBeNull();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

      await page.getByRole('button', { name: 'Réglages', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Réglages', exact: true });
      await expect(sheet).toBeVisible();
      expect(await sheet.locator('.overlay-sheet__body').evaluate((body) => body.scrollWidth - body.clientWidth)).toBeLessThanOrEqual(1);
      const sheetBounds = await sheet.boundingBox();
      expect(sheetBounds?.height).toBeLessThanOrEqual(viewport.height * .9 + 1);
      await closeSheet(page, 'Réglages');
    });
  }

  test('Maison et Courses annoncent leur arrivée ; revenir au Budget conserve les données', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-b', '3675');
    const navigation = page.getByRole('navigation', { name: 'Modules de la maison' });
    await navigation.getByRole('button', { name: 'Maison', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Notre maison', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Une tâche pour la maison', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mettre la maison en pause', exact: true })).toBeVisible();
    await expect(navigation.getByRole('button', { name: 'Maison', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Historique de la maison', exact: true }).click();
    const householdHistory = page.getByRole('dialog', { name: 'Historique de la maison', exact: true });
    await expect(householdHistory.getByText('Les petits gestes apparaîtront ici', { exact: true })).toBeVisible();
    await expect(householdHistory.locator('.history-list')).toHaveCount(0);
    await closeSheet(page, 'Historique de la maison');

    await navigation.getByRole('button', { name: 'Courses', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nos courses', exact: true })).toBeVisible();
    await expect(page.getByText('La liste commune arrive bientôt.', { exact: true })).toBeVisible();
    await expect(page.locator('#contenu-principal input, #contenu-principal select')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Historique des courses', exact: true })).toBeVisible();
    await navigation.getByRole('button', { name: 'Budget', exact: true }).click();
    await expect(page.locator('#salary-b')).toHaveValue(fmt(367_500));
    await expect(page.locator('.budget-total strong')).toHaveText(fmt(221_500));
  });
});

test.describe('Récupération des données corrompues', () => {
  test('JSON corrompu : préservé, écritures bloquées, reset explicite', async ({
    page,
    context,
  }) => {
    const corrupted = '{"version":1,"months":[';
    await context.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [STORAGE_KEY, corrupted],
    );
    await page.goto('/a2-budget/');

    // Bandeau de récupération visible.
    await expect(page.locator('.load-notice')).toBeVisible();
    await expect(page.locator('.load-notice')).toContainText('illisibles');

    // Le contenu brut est préservé (aucun remplacement automatique).
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(corrupted);

    // Une édition ne persiste pas (écritures bloquées).
    await setAmount(page, 'salary-a', '2200');
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(corrupted);

    // Reset explicite : la clé est remplacée par un état neuf valide.
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.load-notice__actions .btn').click();
    await expect(page.locator('.load-notice')).toBeHidden();
    const after = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(after).not.toBe(corrupted);
    expect(JSON.parse(after as string).schemaVersion).toBe(2);
  });

  test('version inconnue : même protection', async ({ page, context }) => {
    const unknownVersion = JSON.stringify({ schemaVersion: 99, months: {} });
    await context.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [STORAGE_KEY, unknownVersion],
    );
    await page.goto('/a2-budget/');
    await expect(page.locator('.load-notice')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(unknownVersion);
  });
});
