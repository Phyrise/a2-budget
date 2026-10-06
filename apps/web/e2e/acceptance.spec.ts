import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  PHONE,
  STORAGE_KEY,
  closeSheet,
  goTo,
  monthKey,
  openApp,
  persisted,
  sheet,
} from './helpers';

test.use({ viewport: PHONE });

/** V4 : euros entiers, jamais de centimes (« 1 335 € »), comme formatEuros de core. */
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
function euros(cents: number): string {
  return cents < 0 ? `− ${eur0.format(-cents / 100)}` : eur0.format(cents / 100);
}

/** Montant « toucher pour saisir » (curseurs, − / +) : toucher le chiffre, écrire, Entrée. */
async function setEuros(page: Page, id: string, text: string) {
  await page.locator(`#${id}-value`).click();
  const field = page.locator(`#${id}-edit`);
  await expect(field).toBeFocused();
  await field.fill(text);
  await field.press('Enter');
}

async function currentMonthOf(page: Page) {
  const s = await persisted(page);
  return s.budget.months.find((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
}

/**
 * Dépenses récurrentes par défaut (core) :
 * Loyer 1300 + Électricité 100 + Courses 400 + Internet 30 + Assurance 15 = 1845 €.
 */
test.describe('Budget — critère de réussite', () => {
  test('A 2200 ; B 3000 + compléments 675 → AL 880, AC 1335, total 2215 ; dépenses 1845 → +370 au compte ; persistant', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
    await setEuros(page, 'salary-b', '3000');
    await expect(page.getByTestId('contribution-b')).toHaveText(euros(120_000));

    // Compléments repliés tant qu'ils valent 0 ; le bouton ouvre le curseur et lui donne le focus.
    await expect(page.locator('#bonus-b')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ajouter des compléments pour AC', exact: true }).click();
    await expect(page.locator('#bonus-b')).toBeFocused();
    await setEuros(page, 'bonus-b', '675');

    await expect(page.getByTestId('contribution-a')).toHaveText(euros(88_000));
    await expect(page.getByTestId('contribution-b')).toHaveText(euros(133_500));
    await expect(page.getByTestId('household-total')).toHaveText(euros(221_500));
    await expect(page.getByTestId('expenses-total')).toContainText(euros(184_500));
    // Premier mois, rien de coché : 0 € sur le compte maintenant, +370 € en fin de mois.
    await expect(page.getByTestId('balance-now')).toHaveText(euros(0));
    await expect(page.getByTestId('balance-projection')).toHaveText(euros(37_000));
    await expect(page.getByText(/\bReste\b/u)).toHaveCount(0);

    // Règle des 2 secondes : versements, total et solde tiennent dans le premier écran (390 × 844).
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const id of ['contribution-a', 'contribution-b', 'household-total', 'expenses-total', 'balance-now', 'balance-projection']) {
      await expect(page.getByTestId(id)).toBeInViewport();
    }
    // Aucun centime, nulle part dans le Budget.
    expect(await page.locator('.budget').innerText()).not.toMatch(/\d,\d{2}\s?€/u);

    // Persistance après rechargement : les compléments restent dépliés.
    await page.reload();
    await expect(page.locator('#salary-a-value')).toHaveText(euros(220_000));
    await expect(page.locator('#salary-b-value')).toHaveText(euros(300_000));
    await expect(page.locator('#bonus-b-value')).toHaveText(euros(67_500));
    await expect(page.locator('#bonus-a')).toHaveCount(0);
    await expect(page.getByTestId('household-total')).toHaveText(euros(221_500));
    await expect(page.getByTestId('balance-projection')).toHaveText(euros(37_000));
    await expect.poll(async () => {
      const m = await currentMonthOf(page);
      return [m.salaryBCents, m.bonusBCents];
    }).toEqual([300_000, 67_500]);
  });

  test('curseurs : + d’un euro, appui long qui accélère, saisie au-delà du maximum', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
    const salary = page.locator('#salary-a');
    await expect(salary).toHaveAttribute('max', '5000');
    await expect(salary).toHaveAttribute('aria-valuetext', euros(220_000));

    await page.locator('#salary-a-plus').click();
    await expect(page.locator('#salary-a-value')).toHaveText(euros(220_100));
    await page.locator('#salary-a-minus').click();
    await page.locator('#salary-a-minus').click();
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(219_900);

    // Appui long : l'avance s'accélère (pas de 1 €, puis 10 €, puis 50 €).
    const plus = await page.locator('#salary-a-plus').boundingBox();
    if (plus === null) throw new Error('Bouton + introuvable');
    await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2400);
    await page.mouse.up();
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBeGreaterThan(219_900 + 3_000);
    const held = (await currentMonthOf(page)).salaryACents;
    expect(held % 100).toBe(0);

    // Clavier sur la piste : flèches ±1 €, Page ±100 €.
    await salary.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('PageUp');
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(held + 9_900);

    // Une valeur au-delà du maximum est acceptée : le curseur se cale au bout.
    await setEuros(page, 'salary-a', '6200');
    await expect(page.locator('#salary-a-value')).toHaveText(euros(620_000));
    await expect(salary).toHaveValue('5000');
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(620_000);
  });

  test('un salaire au-delà du salaire habituel reste au taux de base', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-b', '3675');
    await expect(page.getByTestId('contribution-b')).toHaveText(euros(147_000));
  });

  test('le détail du calcul est repliable et montre salaire + compléments', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-b', '3000');
    await page.getByRole('button', { name: 'Ajouter des compléments pour AC', exact: true }).click();
    await setEuros(page, 'bonus-b', '675');
    const toggle = page.getByRole('button', { name: 'Détail du calcul' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const line = page.locator('.breakdown__line').nth(1);
    await expect(line).toContainText('40');
    await expect(line).toContainText('20');
    await expect(line).toContainText('de compléments');
    await expect(line).toContainText(euros(133_500));
  });

  test('mois en déficit : note douce et solde prévu en terre cuite, jamais masqués', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '1000');
    await setEuros(page, 'salary-b', '1000');
    await expect(page.locator('.balance-card--low')).toBeVisible();
    await expect(page.getByTestId('balance-projection')).toHaveText(euros(-104_500));
    await expect(page.locator('.balance-card__note')).toBeVisible();
    await expect(page.locator('.balance-card__note')).toContainText(euros(104_500));
  });
});

test.describe('Paiements du mois et compte commun', () => {
  test('cocher les virements et les dépenses : solde en ce moment, progression, décocher', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
    await setEuros(page, 'salary-b', '3000');
    const progress = page.getByTestId('payments-progress');
    await expect(progress).toHaveText('0 sur 7 payés');

    const transferA = page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true });
    await transferA.click();
    await expect(transferA).toHaveAttribute('aria-checked', 'true');
    await expect(progress).toHaveText('1 sur 7 payés');
    await expect(page.getByTestId('balance-now')).toHaveText(euros(88_000));
    // Le Sans-Visage mange les pépites (décor) ; les chiffres restent la seule information.
    await expect(page.locator('.noface.is-eating')).toHaveCount(1);

    const rent = page.getByRole('checkbox', { name: 'Loyer + charges payé', exact: true });
    await rent.click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(-42_000));
    // La fin du mois ne dépend pas des cases : 0 + (880 + 1 200) − 1 845.
    await expect(page.getByTestId('balance-projection')).toHaveText(euros(23_500));
    await expect.poll(async () => (await currentMonthOf(page)).paid).toEqual({ transferA: true, expenses: { rent: true } });

    await rent.click();
    await expect(rent).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('balance-now')).toHaveText(euros(88_000));
    await expect(progress).toHaveText('1 sur 7 payés');

    // Les cases repartent de zéro le mois suivant.
    await page.getByRole('button', { name: 'Mois suivant', exact: true }).click();
    await expect(progress).toHaveText('0 sur 7 payés');
    await expect(page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true })).toHaveAttribute('aria-checked', 'false');
  });

  test('recaler sur le compte : solde réel, annulable, négatif permis, historique', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
    await setEuros(page, 'salary-b', '3000');
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(88_000));

    await page.getByRole('button', { name: 'Recaler sur le compte', exact: true }).click();
    const dialog = sheet(page, 'Recaler sur le compte');
    await expect(page.locator('#recalibrate-amount')).toHaveValue('880');
    await page.locator('#recalibrate-amount').fill('1500,50');
    await dialog.getByRole('button', { name: 'Recaler', exact: true }).click();
    await expect(dialog.locator('.field__error')).toContainText('sans centimes');
    await page.locator('#recalibrate-amount').fill('1500');
    await page.locator('#recalibrate-note').fill('Relevé du jour');
    await dialog.getByRole('button', { name: 'Recaler', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(150_000));
    // Fin du mois = 1 500 − 880 (déjà versé) + (880 + 1 200) − 1 845.
    await expect(page.getByTestId('balance-projection')).toHaveText(euros(85_500));
    await expect.poll(async () => (await persisted(page)).budget.balance.corrections.map((c: { balanceCents: number; note?: string }) => [c.balanceCents, c.note]))
      .toEqual([[62_000, 'Relevé du jour']]);

    // Annuler depuis le toast : l'estimation revient.
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(88_000));

    // Compte à découvert : signe « − » accepté.
    await page.getByRole('button', { name: 'Recaler sur le compte', exact: true }).click();
    await page.locator('#recalibrate-amount').fill('-120');
    await dialog.getByRole('button', { name: 'Recaler', exact: true }).click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(-12_000));

    // Historique des recalages, replié.
    await page.getByRole('button', { name: 'Recaler sur le compte', exact: true }).click();
    await dialog.getByRole('button', { name: /Recalages précédents/ }).click();
    await expect(dialog.getByTestId('correction')).toHaveCount(1);
    await expect(dialog.getByTestId('correction')).toContainText(euros(-100_000));
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
  test('centimes et ambiguïtés rejetés sans toucher l’état ; brouillon invalide bloque Ajouter ; 0 accepté', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');

    // « 1,234 » est ambigu, « 2300,50 » a des centimes : erreur locale, la valeur enregistrée reste.
    for (const text of ['1,234', '2300,50']) {
      await setEuros(page, 'salary-a', text);
      await expect(page.locator('#salary-a-error')).toBeVisible();
      await expect(page.locator('#salary-a-value')).toHaveText(euros(220_000));
    }
    await expect(page.locator('#salary-a-error')).toContainText('sans centimes');
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(220_000);

    // Espaces de milliers et « € » acceptés.
    await setEuros(page, 'salary-a', '2 300 €');
    await expect(page.locator('#salary-a-value')).toHaveText(euros(230_000));
    await expect(page.locator('#salary-a-error')).toHaveCount(0);

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
    await expect(page.getByTestId('expenses-total')).toContainText(euros(184_500));
  });

  test('renommer, régler au − / + ou au toucher, retirer une dépense (annulable)', async ({ page }) => {
    await openApp(page, 'budget');
    const key = await monthKey(page);
    await page.getByRole('button', { name: 'Montant de Internet : plus 1 €', exact: true }).click();
    await expect(page.getByTestId('expenses-total')).toContainText(euros(184_600));
    await page.getByRole('button', { name: 'Montant de Internet : moins 1 €', exact: true }).click();
    await expect(page.getByTestId('expenses-total')).toContainText(euros(184_500));

    await setEuros(page, `m-${key}-internet-amount`, '45');
    await expect(page.getByTestId('expenses-total')).toContainText(euros(186_000));
    await expect(page.getByRole('checkbox', { name: 'Internet payé', exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="pay-expense-internet"] .pay-row__amount')).toHaveText(euros(4_500));

    await page.getByRole('button', { name: 'Retirer Internet', exact: true }).click();
    await expect(page.getByTestId('expenses-total')).toContainText(euros(181_500));
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByTestId('expenses-total')).toContainText(euros(186_000));
  });
});

test.describe('Historique et mois', () => {
  test('naviguer entre les mois, revenir au mois courant, l’historique ouvre un mois', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
    const current = await monthKey(page);
    await page.getByRole('button', { name: 'Mois précédent', exact: true }).click();
    await expect.poll(async () => (await persisted(page)).budget.selectedMonth).not.toBe(current);
    await setEuros(page, 'salary-a', '2400');
    await page.getByRole('button', { name: 'Revenir au mois courant', exact: true }).click();
    await expect(page.locator('#salary-a-value')).toHaveText(euros(220_000));

    await page.getByRole('button', { name: 'Historique du budget', exact: true }).click();
    const history = sheet(page, 'Historique du budget');
    await expect(history.locator('.history-month')).toHaveCount(2);
    await expect(history.locator('input, select, textarea')).toHaveCount(0);
    // Euros entiers ; le « reste » a laissé place au compte commun en fin de mois.
    await expect(history.locator('.history-month').first()).toContainText('Compte en fin de mois');
    expect(await history.innerText()).not.toMatch(/\d,\d{2}\s?€/u);
    await history.locator('.history-month').nth(1).click();
    await expect(history).toBeHidden();
    await expect(page.locator('#salary-a-value')).toHaveText(euros(240_000));
  });
});

test.describe('Import / export', () => {
  test('export puis import confirmé avec résumé ; import invalide sans effet', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
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
    await expect(page.locator('#salary-a-value')).toHaveText(euros(220_000));
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

    await setEuros(page, 'salary-a', '2200');
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
