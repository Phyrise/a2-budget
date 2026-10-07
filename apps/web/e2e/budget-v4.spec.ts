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
  await expect(display).toHaveCount(0);
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
    await expect(pad).toHaveCount(0);
    await expect(page.locator('#salary-a-value')).toBeFocused();
    await expect(page.locator('#salary-a-value')).toHaveText(euros(249_000));
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(249_000);

    // Annuler ne change rien ; le raccourci « Salaire habituel » remet 2 200 €.
    await page.locator('#salary-a-value').click();
    await key('9');
    await pad.getByRole('button', { name: 'Annuler' }).click();
    await expect(pad).toHaveCount(0);
    expect((await currentMonthOf(page)).salaryACents).toBe(249_000);
    await page.locator('#salary-a-value').click();
    await pad.getByRole('button', { name: /^Salaire habituel/u }).click();
    await expect(display).toHaveText(euros(220_000));
    await pad.getByRole('button', { name: 'Valider' }).click();
    await expect.poll(async () => (await currentMonthOf(page)).salaryACents).toBe(220_000);
    await expect(pad).toHaveCount(0);
    await expect(page.locator('#salary-a-value')).toBeFocused();

    // Clavier physique : Entrée rouvre, chiffres, Échap annule ; pas de maximum.
    await page.keyboard.press('Enter');
    await expect(display).toBeFocused();
    await page.keyboard.type('6200');
    await page.keyboard.press('Escape');
    await expect(pad).toHaveCount(0);
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

  test('recaler sur le compte : au pavé, prérempli, annulable, jamais négatif, dernier recalage', async ({ page }) => {
    await openApp(page, 'budget');
    await setEuros(page, 'salary-a', '2200');
    await setEuros(page, 'salary-b', '3000');
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(88_000));

    const recalibrate = page.getByRole('button', { name: 'Recaler sur le compte', exact: true });
    await recalibrate.click();
    const dialog = sheet(page, 'Recaler sur le compte');
    const display = page.locator('#recalibrate-pad-display');
    const ok = dialog.getByRole('button', { name: 'Recaler', exact: true });
    // Le pavé, prérempli avec l'estimation : aucun champ, aucun clavier système, rien d'autre.
    await expect(display).toBeFocused();
    await expect(display).toHaveText(euros(88_000));
    await expect(dialog.locator('input, textarea, [role="switch"]')).toHaveCount(0);
    await expect(dialog.getByText(/Dernier recalage/u)).toHaveCount(0);
    await page.keyboard.type('1500');
    await ok.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(150_000));
    // Fin du mois = 1 500 − 880 (déjà versé) + (880 + 1 200) − 1 845.
    await expect(page.getByTestId('balance-projection')).toHaveText(euros(85_500));
    await expect.poll(async () => (await persisted(page)).budget.balance.corrections.map((c: { balanceCents: number; observedCents?: number }) => [c.balanceCents, c.observedCents]))
      .toEqual([[62_000, 150_000]]);

    // Annuler depuis le toast : l'estimation revient.
    await page.locator('.toast').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(88_000));

    // Jamais en dessous de 0 € : « − 10 » s'éteint à zéro.
    await recalibrate.click();
    await page.keyboard.press('Delete');
    await expect(dialog.getByRole('button', { name: 'Moins 10 €', exact: true })).toBeDisabled();
    await page.keyboard.press('-');
    await expect(display).toHaveText(euros(0));
    await ok.click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(0));

    // Seule précision : le dernier recalage. Valider sans rien changer confirme le solde.
    await recalibrate.click();
    await expect(dialog).toContainText(/Dernier recalage\s:\s0\s€, aujourd’hui/u);
    await ok.click();
    await expect(page.locator('.toast')).toContainText(/Compte recalé\s:\s0\s€/u);

    // Un solde négatif reste lisible ; le pavé repart alors de 0 €.
    await page.getByRole('checkbox', { name: 'Loyer + charges payé', exact: true }).click();
    await expect(page.getByTestId('balance-now')).toHaveText(euros(-130_000));
    await recalibrate.click();
    await expect(display).toHaveText(euros(0));
  });

  for (const viewport of [PHONE, { width: 375, height: 667 }]) {
    test.describe(`${viewport.width} × ${viewport.height}`, () => {
      test.use({ viewport });
      test('la feuille « Recaler » tient entière à l’écran', async ({ page }) => {
        await openApp(page, 'budget');
        await page.getByRole('button', { name: 'Recaler sur le compte', exact: true }).click();
        const dialog = sheet(page, 'Recaler sur le compte');
        await expect(dialog.getByRole('button', { name: 'Recaler', exact: true })).toBeInViewport({ ratio: 1 });
        await expect.poll(async () => {
          const box = await dialog.locator('.sheet__panel').boundingBox();
          return box !== null && box.y >= 0 && box.y + box.height <= viewport.height + 0.5;
        }).toBe(true);
      });
    });
  }
});
