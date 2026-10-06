/**
 * Budget V4 : curseurs en euros entiers (− / + à l'euro, appui long qui
 * accélère, saisie au toucher au-delà du maximum), paiements du mois cochés
 * et solde du compte commun (en ce moment, fin du mois, recalage).
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

/** Euros entiers, jamais de centimes (« 1 335 € »), comme formatEuros de core. */
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
function euros(cents: number): string {
  return cents < 0 ? `−\u202f${eur0.format(-cents / 100)}` : eur0.format(cents / 100);
}

/** Montant « toucher pour saisir » : toucher le chiffre, écrire, Entrée. */
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

test.describe('Curseurs en euros entiers', () => {
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
