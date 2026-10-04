import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  PHONE,
  STORAGE_KEY,
  closeSheet,
  fmt,
  goTo,
  monthKey,
  openApp,
  persisted,
  setAmount,
  sheet,
} from './helpers';

test.use({ viewport: PHONE });

/**
 * Dépenses récurrentes par défaut (core) :
 * Loyer 1300 + Électricité 100 + Courses 400 + Internet 30 + Assurance 15 = 1845 €.
 */
test.describe('Budget — critère de réussite', () => {
  test('A 2200 ; B 3000 + compléments 675 → AL 880, AC 1335, total 2215 ; dépenses 1845 → reste 370 ; persistant', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-a', '2200');
    await setAmount(page, 'salary-b', '3000');
    await expect(page.getByTestId('contribution-b')).toHaveText(fmt(120_000));

    // Compléments repliés tant qu'ils valent 0 ; le bouton ouvre le champ et lui donne le focus.
    await expect(page.locator('#bonus-b')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ajouter des compléments pour AC', exact: true }).click();
    await expect(page.locator('#bonus-b')).toBeFocused();
    await page.locator('#bonus-b').fill('675');
    await page.locator('#bonus-b').blur();

    await expect(page.getByTestId('contribution-a')).toHaveText(fmt(88_000));
    await expect(page.getByTestId('contribution-b')).toHaveText(fmt(133_500));
    await expect(page.getByTestId('household-total')).toHaveText(fmt(221_500));
    await expect(page.getByTestId('expenses-total')).toContainText(fmt(184_500));
    await expect(page.getByTestId('remaining')).toHaveText(fmt(37_000));

    // Règle des 2 secondes : tout tient dans le premier écran (390 × 844), compléments dépliés.
    for (const id of ['salary-a', 'salary-b', 'bonus-b']) {
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    for (const id of ['contribution-a', 'contribution-b', 'household-total', 'expenses-total', 'remaining']) {
      await expect(page.getByTestId(id)).toBeInViewport();
    }
    await expect(page.getByText(/prérempli/i)).toHaveCount(0);

    // Persistance après rechargement (et module mémorisé) : les compléments restent dépliés.
    await page.reload();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
    await expect(page.locator('#salary-b')).toHaveValue(fmt(300_000));
    await expect(page.locator('#bonus-b')).toHaveValue(fmt(67_500));
    await expect(page.locator('#bonus-a')).toHaveCount(0);
    await expect(page.getByTestId('household-total')).toHaveText(fmt(221_500));
    await expect(page.getByTestId('remaining')).toHaveText(fmt(37_000));
    await expect.poll(async () => {
      const s = await persisted(page);
      const m = s.budget.months.find((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
      return [m.salaryBCents, m.bonusBCents];
    }).toEqual([300_000, 67_500]);
  });

  test('un salaire au-delà du salaire habituel reste au taux de base', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-b', '3675');
    await expect(page.getByTestId('contribution-b')).toHaveText(fmt(147_000));
  });

  test('le détail du calcul est repliable et montre salaire + compléments', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-b', '3000');
    await page.getByRole('button', { name: 'Ajouter des compléments pour AC', exact: true }).click();
    await page.locator('#bonus-b').fill('675');
    await page.locator('#bonus-b').blur();
    const toggle = page.getByRole('button', { name: 'Détail du calcul' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const line = page.locator('.breakdown__line').nth(1);
    await expect(line).toContainText('40');
    await expect(line).toContainText('20');
    await expect(line).toContainText('de compléments');
    await expect(line).toContainText(fmt(133_500).replace(',00', ''));
  });

  test('déficit visible en terre cuite, jamais masqué', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-a', '1000');
    await setAmount(page, 'salary-b', '1000');
    await expect(page.locator('.ledger--deficit')).toBeVisible();
    await expect(page.locator('.ledger__row--rest .ledger__label')).toHaveText('Déficit');
    await expect(page.locator('.ledger__note')).toBeVisible();
  });
});

test.describe('Taux communs au curseur', () => {
  test('un seul couple de taux, réglé au clavier et aux boutons, écrit pour les deux', async ({ page }) => {
    await openApp(page, 'budget');
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const settings = sheet(page, 'Réglages');
    await expect(settings.getByText(/prérempli/i)).toHaveCount(0);
    await expect(settings.locator('input[type="range"]')).toHaveCount(2);
    const base = settings.getByRole('slider', { name: 'Taux de base' });
    const variable = settings.getByRole('slider', { name: 'Taux au-delà' });
    await expect(base).toHaveAttribute('aria-valuetext', /^40\s%$/u);

    await base.focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowLeft');
    await expect(base).toHaveAttribute('aria-valuetext', /^35\s%$/u);
    await settings.getByRole('button', { name: 'Taux au-delà : plus 1 %' }).click();
    await expect(variable).toHaveAttribute('aria-valuetext', /^21\s%$/u);
    await expect.poll(async () => {
      const s = (await persisted(page)).budget.settings;
      return [s.personA.baseRateBps, s.personB.baseRateBps, s.personA.variableRateBps, s.personB.variableRateBps];
    }).toEqual([3500, 3500, 2100, 2100]);

    await variable.focus();
    await page.keyboard.press('End');
    await expect(variable).toHaveAttribute('aria-valuetext', /^100\s%$/u);
    await page.keyboard.press('PageDown');
    await expect(variable).toHaveAttribute('aria-valuetext', /^90\s%$/u);
    await page.keyboard.press('Home');
    await expect(variable).toHaveAttribute('aria-valuetext', /^0\s%$/u);
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageUp');
    await expect.poll(async () => (await persisted(page)).budget.settings.personB.variableRateBps).toBe(2000);
    await closeSheet(page, 'Réglages');

    // Le mois affiché garde ses taux : l'application aux règles du mois est explicite.
    await page.getByRole('button', { name: 'Détail du calcul' }).click();
    await page.getByRole('button', { name: 'Appliquer les taux communs à ce mois', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Appliquer les taux communs à ce mois', exact: true })).toHaveCount(0);
    await expect.poll(async () => {
      const s = await persisted(page);
      const m = s.budget.months.find((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
      return [m.personA.baseRateBps, m.personB.baseRateBps];
    }).toEqual([3500, 3500]);
  });
});

test.describe('Saisie des montants', () => {
  test('ambiguïté rejetée sans toucher l’état ; brouillon invalide bloque Ajouter ; 0 accepté', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-a', '2200');

    // « 1,234 » est ambigu : erreur locale, la valeur enregistrée reste.
    await setAmount(page, 'salary-a', '1,234');
    await expect(page.locator('#salary-a-error')).toBeVisible();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
    await expect.poll(async () => {
      const s = await persisted(page);
      return s.budget.months.find((m: { monthKey: string }) => m.monthKey === s.budget.selectedMonth).salaryACents;
    }).toBe(220_000);

    // Virgule ou point acceptés.
    await setAmount(page, 'salary-a', '2300.5');
    await expect(page.locator('#salary-a')).toHaveValue(fmt(230_050));

    const key = await monthKey(page);
    await page.getByRole('button', { name: 'Ajouter une dépense', exact: true }).click();
    const label = page.locator(`#m-${key}-add-label`);
    const amount = page.locator(`#m-${key}-add-amount`);
    const submit = page.locator('.expense-add__submit');
    await expect(label).toBeFocused();
    await label.fill('Mutuelle');
    await amount.click();
    await amount.fill('12,345');
    await amount.blur();
    await expect(page.locator(`#m-${key}-add-amount-error`)).toBeVisible();
    await expect(submit).toBeDisabled();

    await amount.click();
    await amount.fill('');
    await amount.blur();
    await amount.click();
    await amount.fill('0');
    await expect(submit).toBeEnabled();
    const before = await page.locator('.expense-row').count();
    await submit.click();
    await expect(page.locator('.expense-row')).toHaveCount(before + 1);
    await expect(page.getByTestId('expenses-total')).toContainText(fmt(184_500));
  });

  test('renommer, changer le montant et retirer une dépense (annulable)', async ({ page }) => {
    await openApp(page, 'budget');
    const amountId = await page.getByLabel('Montant de Internet', { exact: true }).getAttribute('id');
    await setAmount(page, amountId!, '45');
    await expect(page.getByTestId('expenses-total')).toContainText(fmt(186_000));

    await page.getByRole('button', { name: 'Retirer Internet', exact: true }).click();
    await expect(page.getByTestId('expenses-total')).toContainText(fmt(181_500));
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByTestId('expenses-total')).toContainText(fmt(186_000));
  });
});

test.describe('Historique et mois', () => {
  test('naviguer entre les mois, revenir au mois courant, l’historique ouvre un mois', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-a', '2200');
    const current = await monthKey(page);
    await page.getByRole('button', { name: 'Mois précédent', exact: true }).click();
    await expect.poll(async () => (await persisted(page)).budget.selectedMonth).not.toBe(current);
    await setAmount(page, 'salary-a', '2400');
    await page.getByRole('button', { name: 'Revenir au mois courant', exact: true }).click();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));

    await page.getByRole('button', { name: 'Historique du budget', exact: true }).click();
    const history = sheet(page, 'Historique du budget');
    await expect(history.locator('.history-month')).toHaveCount(2);
    await expect(history.locator('input, select, textarea')).toHaveCount(0);
    await history.locator('.history-month').nth(1).click();
    await expect(history).toBeHidden();
    await expect(page.locator('#salary-a')).toHaveValue(fmt(240_000));
  });
});

test.describe('Import / export', () => {
  test('export puis import confirmé avec résumé ; import invalide sans effet', async ({ page }) => {
    await openApp(page, 'budget');
    await setAmount(page, 'salary-a', '2200');
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const settings = sheet(page, 'Réglages');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      settings.getByRole('button', { name: 'Exporter une sauvegarde' }).click(),
    ]);
    const path = await download.path();
    if (path === null) throw new Error('Sauvegarde téléchargée inaccessible.');
    const json = await readFile(path, 'utf8');
    expect(json).toContain('"schemaVersion"');

    await page.setInputFiles('input[type="file"]', { name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(json) });
    const confirm = page.getByRole('alertdialog', { name: /Remplacer les données/ });
    await expect(confirm.locator('.import-confirm')).toContainText('Budget');
    await confirm.getByRole('button', { name: 'Remplacer', exact: true }).click();
    await expect(page.locator('.import-note--success')).toBeVisible();

    await page.setInputFiles('input[type="file"]', {
      name: 'invalide.json',
      mimeType: 'application/json',
      buffer: Buffer.from('ceci n’est pas une sauvegarde'),
    });
    await expect(page.locator('.import-note--error')).toContainText('invalide');
    await closeSheet(page, 'Réglages');
    await expect(page.locator('#salary-a')).toHaveValue(fmt(220_000));
  });
});

test.describe('Récupération des données corrompues', () => {
  test('JSON corrompu : préservé, écritures bloquées, recommencer explicite', async ({ page, context }) => {
    const corrupted = '{"version":1,"months":[';
    await context.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, value);
      },
      [STORAGE_KEY, corrupted],
    );
    await openApp(page, 'budget');
    const notice = page.locator('.load-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('illisibles');
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(corrupted);

    await setAmount(page, 'salary-a', '2200');
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe(corrupted);

    await notice.getByRole('button', { name: 'Recommencer à zéro' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Effacer et recommencer' }).click();
    await expect(notice).toBeHidden();
    const after = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(after).not.toBe(corrupted);
    expect(JSON.parse(after as string).schemaVersion).toBe(2);
  });
});

test.describe('Coquille accessible', () => {
  for (const title of ['Réglages', 'Historique du budget']) {
    test(`Échap ferme ${title} et rend le focus à son bouton`, async ({ page }) => {
      await openApp(page, 'budget');
      const opener = page.getByRole('button', { name: title, exact: true });
      await opener.click();
      const dialog = sheet(page, title);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Fermer', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });
  }

  test('Tab et Maj+Tab restent piégés dans les Réglages', async ({ page }) => {
    await openApp(page, 'budget');
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const dialog = sheet(page, 'Réglages');
    const close = dialog.getByRole('button', { name: 'Fermer', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await expect(close).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    for (let step = 0; step < 14; step += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
  });

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`${viewport.width}px : pas de débordement horizontal, cibles ≥ 44 px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const module of ['Maison', 'Budget', 'Courses'] as const) {
        if (module === 'Maison') await openApp(page);
        else await goTo(page, module);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        for (const name of ['Budget', 'Maison', 'Courses']) {
          const box = await page.getByRole('navigation', { name: 'Modules de la maison' }).getByRole('button', { name, exact: true }).boundingBox();
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});
