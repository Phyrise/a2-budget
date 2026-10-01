import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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

/**
 * Dépenses récurrentes par défaut (core) :
 * Loyer 1300 + Électricité 100 + Courses 400 + Internet 30 + Assurance 15 = 1845 €.
 */

test.describe('Calcul de référence', () => {
  test('2200/3675 => 880/1335/2215 ; dépenses 1845 => reste 370', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');
    await setAmount(page, 'salary-b', '3675');

    const rows = page.locator('.cm-main__row .cm-main__value');
    await expect(rows.nth(0)).toHaveText(fmt(88_000));
    await expect(rows.nth(1)).toHaveText(fmt(133_500));
    await expect(page.locator('.cm-main__total-value')).toHaveText(fmt(221_500));

    // Dépenses par défaut = 1845 ; reste 2215 - 1845 = 370.
    const balance = page.locator('.balance-preview');
    await expect(balance.locator('strong').nth(0)).toHaveText(fmt(184_500));
    await expect(balance.locator('strong').nth(1)).toHaveText(fmt(37_000));
  });

  test('2200/3000 + réserve 500 : 880/1200/2080, reste 235, loisirs 0, non couvert 265', async ({
    page,
  }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2200');
    await setAmount(page, 'salary-b', '3000');
    await setAmount(page, 'cm-reserve', '500');

    const rows = page.locator('.cm-main__row .cm-main__value');
    await expect(rows.nth(0)).toHaveText(fmt(88_000));
    await expect(rows.nth(1)).toHaveText(fmt(120_000));
    await expect(page.locator('.cm-main__total-value')).toHaveText(fmt(208_000));

    // Reste 2080 - 1845 = 235 ; réserve 500 > 235 : loisirs 0, 265 manquants.
    await expect(page.locator('.rest-row__value')).toHaveText(fmt(0));
    await expect(page.locator('.rest-note--danger')).toContainText(fmt(26_500));
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

    await page.getByRole('button', { name: 'Ce mois', exact: true }).click();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
    await expect(page.locator('#salary-b')).toHaveValue(fmt(300_000));
  });

  test('l’historique liste les mois sans les modifier', async ({ page }) => {
    await page.goto('/a2-budget/');
    await setAmount(page, 'salary-a', '2250');

    await page.getByRole('button', { name: 'Historique', exact: true }).click();
    // Revenus 2250 + 3000 = 5250 ; contributions 890 + 1200 = 2090.
    await expect(page.locator('.history-list')).toContainText(fmt(525_000));
    await expect(page.locator('.history-list')).toContainText(fmt(209_000));

    await page.getByRole('button', { name: 'Ce mois', exact: true }).click();
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
    const json = await readFile(await download.path(), 'utf8');
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
    await page.getByRole('button', { name: 'Ce mois', exact: true }).click();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
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
    expect(JSON.parse(after as string).schemaVersion).toBe(1);
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
