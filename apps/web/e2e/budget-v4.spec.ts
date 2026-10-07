/**
 * Budget V4 / V4.1 : montants au pavé (AmountPad : grosses touches, − / +,
 * raccourcis, clavier physique ; aucun curseur, aucun clavier système),
 * paiements du mois cochés dans « Ce mois-ci » et solde du compte commun
 * (en ce moment, fin du mois, recalage).
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

/** Euros entiers, jamais de centimes (« 1 335 € »), comme formatEuros de core. */
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
function euros(cents: number): string {
  return cents < 0 ? `−\u202f${eur0.format(-cents / 100)}` : eur0.format(cents / 100);
}

/** Montant au pavé : toucher le montant, taper les chiffres (clavier physique), Entrée. */
async function setEuros(page: Page, id: string, digits: string) {
  await page.locator(`#${id}-value`).click();
  const display = page.locator(`#${id}-pad-display`);
  await expect(display).toBeFocused();
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(display).toBeHidden();
}

async function currentMonthOf(page: Page) {
  const s = await persisted(page);
  return s.budget.months.find((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
}

test.describe('Saisie au pavé (AmountPad)', () => {
  test('toucher le montant ouvre le pavé : touches, 00, effacer, − / +, raccourci, Annuler, Valider', async ({ page }) => {
    await openApp(page, 'budget');
    await expect(page.locator('.budget input[type="range"], .budget [role="slider"]')).toHaveCount(0);
    await setEuros(page, 'salary-a', '2200');

    await page.locator('#salary-a-value').click();
    const pad = page.getByRole('dialog', { name: 'Salaire d’AL', exact: true });
    const display = pad.getByTestId('amount-pad-display');
    await expect(display).toBeFocused();
    // Aucun champ texte : le clavier du téléphone ne s'ouvre pas.
    expect(await page.evaluate(() => document.activeElement?.matches('input, textarea') ?? false)).toBe(false);
    await expect(display).toHaveText(euros(220_000));

    // Le premier chiffre remplace le montant ; « 00 » ; effacer.
    const key = (name: string) => pad.getByRole('button', { name, exact: true }).click();
    await key('2');
    await key('4');
    await key('Deux zéros');
    await key('7');
    await key('Effacer le dernier chiffre');
    await expect(display).toHaveText(euros(240_000));
    await key('Plus 100 €');
    await key('Moins 10 €');
    await expect(display).toHaveText(euros(249_000));
    // Rien n'est écrit avant « Valider ».
    expect((await currentMonthOf(page)).salaryACents).toBe(220_000);
    await pad.getByRole('button', { name: 'Valider' }).click();
    await expect(pad).toBeHidden();
    await expect(page.locator('#salary-a-value')).toBeFocused();
    await expect(page.locator('#salary-a-value')).toHaveText(euros(249_000));
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(249_000);

    // Annuler ne change rien ; le raccourci « Salaire habituel » remet 2 200 €.
    await page.locator('#salary-a-value').click();
    await key('9');
    await pad.getByRole('button', { name: 'Annuler' }).click();
    await expect(pad).toBeHidden();
    expect((await currentMonthOf(page)).salaryACents).toBe(249_000);
    await page.locator('#salary-a-value').click();
    await pad.getByRole('button', { name: /^Salaire habituel/u }).click();
    await expect(display).toHaveText(euros(220_000));
    await pad.getByRole('button', { name: 'Valider' }).click();
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(220_000);

    // Clavier physique : Entrée rouvre, chiffres, Échap annule ; pas de maximum.
    await page.keyboard.press('Enter');
    await expect(display).toBeFocused();
    await page.keyboard.type('6200');
    await page.keyboard.press('Escape');
    await expect(pad).toBeHidden();
    expect((await currentMonthOf(page)).salaryACents).toBe(220_000);
    await setEuros(page, 'salary-a', '6200');
    await expect(page.locator('#salary-a-value')).toHaveText(euros(620_000));
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(620_000);
  });

  test('faire défiler au-dessus des montants ne change rien', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-b', '3000');
    const before = JSON.stringify(await currentMonthOf(page));
    const box = await page.locator('#salary-b-value').boundingBox();
    if (box === null) throw new Error('Salaire introuvable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 5; i += 1) await page.mouse.wheel(0, 140);
    for (let i = 0; i < 5; i += 1) await page.mouse.wheel(0, -140);
    await page.waitForTimeout(300);
    expect(JSON.stringify(await currentMonthOf(page))).toBe(before);
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
