/**
 * Budget — univers « Le Voyage de Chihiro » (V3.2) : le Sans-Visage suit
 * l'état du mois sans jamais effrayer, la rigole d'or se remplit avec le
 * reste, une Noiraude traverse après une modification de montant, chaque
 * dépense a son kompeitō. Les chiffres restent la seule source d'information.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, openApp, setAmount, trackErrors } from './helpers';

test.use({ viewport: PHONE });

const noFace = (page: Page) => page.locator('.ledger .noface');

/** Salaires du mois (dépenses par défaut des réglages). */
async function salaries(page: Page, a: string, b: string) {
  await setAmount(page, 'salary-a', a);
  await setAmount(page, 'salary-b', b);
}

async function expectPose(page: Page, mood: string) {
  await expect(noFace(page)).toHaveAttribute('data-mood', mood);
  // Après le salut et le fondu, la pose affichée rejoint l'humeur.
  await expect(noFace(page)).toHaveAttribute('data-pose', mood, { timeout: 6_000 });
  await expect(noFace(page).locator(`.noface__img--${mood}`)).toHaveClass(/is-shown/);
}

async function ratio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const parse = (id: string) => {
      const text = document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
      return Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
    };
    return parse('remaining') / parse('household-total');
  });
}

test.describe('Budget — univers Chihiro', () => {
  test('le Sans-Visage suit le mois : offre, calme, repu, timide', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'budget');

    await salaries(page, '2800', '3600');
    await expectPose(page, 'offering');
    const fill = Number(await page.locator('.gold-gauge').getAttribute('data-fill'));
    expect(Math.abs(fill - (await ratio(page)))).toBeLessThan(0.01);
    await expect(page.locator('.gold-gauge__nugget.is-on').first()).toBeVisible();

    await salaries(page, '2000', '3000');
    await expectPose(page, 'calm');

    await salaries(page, '1850', '2900');
    await expectPose(page, 'content');

    await salaries(page, '1600', '2700');
    await expectPose(page, 'shy');
    await expect(page.locator('.gold-gauge--deficit')).toBeVisible();
    await expect(page.locator('.gold-gauge__nugget.is-on')).toHaveCount(0);
    await expect(page.locator('.ledger__row--rest .ledger__label')).toHaveText('Déficit');

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

    await setAmount(page, 'salary-a', '2900');
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
    await setAmount(page, 'salary-b', '3700');
    await expect(noFace(page)).toHaveAttribute('data-pose', 'bow');
    await page.waitForTimeout(400);
    await expect(page.locator('.susu-runner')).toHaveCount(0);
  });

  test('chaque dépense a son kompeitō, de couleur stable ; liste vide = Noiraude cachée', async ({ page }) => {
    await openApp(page, 'budget');
    const rows = page.locator('.expense-list--konpeito .expense-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('.expense-list--konpeito .konpeito')).toHaveCount(count);
    const colors = await page.locator('.konpeito').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.color));
    await page.reload();
    await expect(page.locator('.konpeito')).toHaveCount(count);
    const again = await page.locator('.konpeito').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.color));
    expect(again).toEqual(colors);

    for (let i = 0; i < count; i += 1) {
      await rows.first().locator('.expense-row__remove').click();
    }
    await expect(page.locator('.susu-empty .susu-empty__img')).toBeVisible();
    await expect(page.getByText('Aucune dépense ce mois-ci')).toBeVisible();
  });
});
