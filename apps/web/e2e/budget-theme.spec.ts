/**
 * Budget — univers « Le Voyage de Chihiro » (V3.2, V4) : le Sans-Visage suit
 * le compte commun sans jamais effrayer, la rigole d'or suit le solde (un
 * repère marque la fin du mois), il mange les pépites quand on coche un
 * paiement, une Noiraude traverse après une modification de montant, chaque
 * dépense a son kompeitō. Les chiffres restent la seule source d'information.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, trackErrors } from './helpers';

test.use({ viewport: PHONE });

const noFace = (page: Page) => page.locator('.balance-card .noface');

/** Montant au pavé : toucher le montant, taper les chiffres (clavier physique), Entrée. */
async function setEuros(page: Page, id: string, digits: string) {
  await page.locator(`#${id}-value`).click();
  const display = page.locator(`#${id}-pad-display`);
  await expect(display).toBeFocused();
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(display).toBeHidden();
}

/** Salaires du mois (dépenses par défaut des réglages). */
async function salaries(page: Page, a: string, b: string) {
  await setEuros(page, 'salary-a', a);
  await setEuros(page, 'salary-b', b);
}

async function expectPose(page: Page, mood: string) {
  await expect(noFace(page)).toHaveAttribute('data-mood', mood);
  // Après le salut et le fondu, la pose affichée rejoint l'humeur.
  await expect(noFace(page)).toHaveAttribute('data-pose', mood, { timeout: 6_000 });
  await expect(noFace(page).locator(`.noface__img--${mood}`)).toHaveClass(/is-shown/);
}

/** Repère de fin de mois : projection rapportée au plus grand des versements et des dépenses. */
async function ratio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const parse = (id: string) => {
      const text = document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
      return Number(text.replace(/[^\d]/g, ''));
    };
    return parse('balance-projection') / Math.max(parse('household-total'), parse('expenses-total'));
  });
}

test.describe('Budget — univers Chihiro', () => {
  test('le Sans-Visage suit le mois : offre, calme, repu, timide', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'budget');

    await salaries(page, '2800', '3600');
    await expectPose(page, 'offering');
    const mark = Number(await page.locator('.gold-gauge__mark').getAttribute('data-mark'));
    expect(Math.abs(mark - (await ratio(page)))).toBeLessThan(0.01);
    // Rien de coché, premier mois : le compte est à 0, la rigole attend son or.
    await expect(page.locator('.gold-gauge')).toHaveAttribute('data-fill', '0.000');
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(page.locator('.gold-gauge__nugget.is-on').first()).toBeVisible();

    await salaries(page, '2000', '3000');
    await expectPose(page, 'calm');

    await salaries(page, '1850', '2900');
    await expectPose(page, 'content');

    await salaries(page, '1600', '2700');
    await expectPose(page, 'shy');
    await expect(page.locator('.balance-card--low')).toBeVisible();
    await expect(page.locator('.gold-gauge__mark')).toHaveAttribute('data-mark', '0.000');

    // Décor muet : l'information est déjà dans les chiffres.
    await expect(noFace(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.gold-gauge')).toHaveAttribute('aria-hidden', 'true');
    const alts = await page.locator('.budget img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));
    expect(alts.every((alt) => alt === '')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('une modification : salut du Sans-Visage et Noiraude qui traverse', async ({ page }) => {
    await openApp(page, 'budget');
    await salaries(page, '2800', '3600');
    await expectPose(page, 'offering');

    await setEuros(page, 'salary-a', '2900');
    await expect(noFace(page)).toHaveAttribute('data-pose', 'bow');
    const runner = page.locator('.susu-runner');
    await expect(runner).toBeVisible();
    await expect(runner).toHaveAttribute('data-carrier', 'carryYellow');
    await expect(runner).toHaveCount(0, { timeout: 4_000 });
    await expectPose(page, 'offering');
  });

  test('mouvement réduit : pas de Noiraude qui traverse', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, 'budget');
    await salaries(page, '2800', '3600');
    await setEuros(page, 'salary-b', '3700');
    await expect(noFace(page)).toHaveAttribute('data-pose', 'bow');
    await page.waitForTimeout(400);
    await expect(page.locator('.susu-runner')).toHaveCount(0);
  });

  test('chaque dépense a son kompeitō, de couleur stable ; liste vide = Noiraude cachée', async ({ page }) => {
    await openApp(page, 'budget');
    const rows = page.locator('.paybook-list--expenses .paybook-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    const konpeito = page.locator('.paybook-list--expenses .konpeito');
    await expect(konpeito).toHaveCount(count);
    const colors = await konpeito.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.color));
    await page.reload();
    await expect(konpeito).toHaveCount(count);
    const again = await konpeito.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.color));
    expect(again).toEqual(colors);
    // Le kompeitō d'une dépense est celui de sa ligne dans « Ce mois-ci ».
    const paying = await page
      .locator('[data-testid="pay-expense-internet"] .konpeito')
      .evaluate((e) => (e as HTMLElement).dataset.color);
    expect(colors).toContain(paying);

    for (let i = 0; i < count; i += 1) {
      await rows.first().locator('.paybook-row__remove').click();
    }
    await expect(page.locator('.susu-empty .susu-empty__img')).toBeVisible();
    await expect(page.getByText('Aucune dépense ce mois-ci')).toBeVisible();
  });

  test('cocher un paiement : les pépites volent, il mâche, s’arrondit, puis salue quand tout est payé', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'budget');
    await salaries(page, '2200', '3000');
    await page.waitForTimeout(1600);

    const before = await noFace(page).evaluate((e) => getComputedStyle(e).getPropertyValue('--full').trim());
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(page.locator('.nugget-flight')).toHaveCount(1);
    await expect(page.locator('.nugget-flight img')).not.toHaveCount(0);
    await expect(noFace(page)).toHaveClass(/is-eating/);
    await expect(noFace(page)).toHaveAttribute('data-pose', 'content');
    await expect(page.locator('.nugget-flight')).toHaveCount(0, { timeout: 4_000 });
    const after = await noFace(page).evaluate((e) => getComputedStyle(e).getPropertyValue('--full').trim());
    expect(Number(after)).toBeGreaterThan(Number(before));

    // Plus bas dans la liste, il vient manger au bord de l'écran.
    const last = page.getByRole('checkbox', { name: 'Assurance payé', exact: true });
    await last.evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await expect(noFace(page)).not.toBeInViewport();
    await last.click();
    await expect(page.locator('.noface-visitor.is-in .noface')).toBeVisible();
    await expect(page.locator('.noface-visitor .noface')).toHaveCount(0, { timeout: 6_000 });

    // Tout payer : il salue.
    const unpaid = page.locator('.paybook-row:not(.is-paid) [role="checkbox"]');
    for (let guard = 0; guard < 10 && (await unpaid.count()) > 0; guard += 1) {
      await unpaid.first().click();
    }
    await expect(page.getByTestId('payments-progress')).toHaveText('Tout est payé');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.noface[data-pose="bow"]')).not.toHaveCount(0, { timeout: 6_000 });
    expect(errors).toEqual([]);
  });

  test('mouvement réduit : pas de pépites qui volent, il mange quand même', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, 'budget');
    await salaries(page, '2200', '3000');
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(noFace(page)).toHaveClass(/is-eating/);
    await expect(page.locator('.nugget-flight')).toHaveCount(0);
  });
});
