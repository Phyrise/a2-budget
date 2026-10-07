/**
 * Budget — univers « Le Voyage de Chihiro » (V3.2, V4, V4.2) : le Sans-Visage
 * suit le compte commun sans jamais effrayer (il reçoit l'argent, content,
 * quand le compte monte ; il le laisse partir, triste, quand il descend), la
 * rigole d'or suit le solde, une Noiraude traverse après une modification de
 * montant, chaque dépense a son kompeitō, et des Noiraudes vagabondes
 * s'attrapent. Les chiffres restent la seule source d'information.
 */
import { expect, test, type Page } from '@playwright/test';
import { PHONE, STORAGE_KEY, openApp, trackErrors } from './helpers';

test.use({ viewport: PHONE });

const noFace = (page: Page) => page.locator('.balance-card .noface');

/** Montant au pavé : toucher le montant, taper les chiffres (clavier physique), Entrée. */
async function setEuros(page: Page, id: string, digits: string) {
  await page.locator(`#${id}-value`).click();
  const display = page.locator(`#${id}-pad-display`);
  await expect(display).toBeFocused();
  await page.keyboard.type(digits);
  await page.keyboard.press('Enter');
  await expect(display).toHaveCount(0);
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

/**
 * V4.2 : le compte commun est en haut, « Ce mois-ci » plus bas. On fait
 * défiler juste assez pour voir la case au-dessus de la navigation : le
 * Sans-Visage du solde reste à l'écran et mange sur place (sinon il vient
 * en visiteur, voir plus bas).
 */
async function revealNearNoFace(page: Page, testId: string) {
  await page.evaluate((id) => {
    const box = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    window.scrollBy(0, Math.max(0, box.bottom - (window.innerHeight - 130)));
  }, testId);
  await expect(noFace(page)).toBeInViewport();
}

/** Repère de fin de mois : projection rapportée au plus grand des versements (AL + AC) et des dépenses. */
async function ratio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const parse = (id: string) => {
      const text = document.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
      return Number(text.replace(/[^\d]/g, ''));
    };
    const given = parse('contribution-a') + parse('contribution-b');
    return parse('balance-projection') / Math.max(given, parse('ledger-expenses-total'));
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

    // Décor muet (seul le toucher est nommé) : l'information est déjà dans les chiffres.
    await expect(page.getByRole('button', { name: 'Saluer le Sans-Visage', exact: true })).toHaveCount(1);
    await expect(page.locator('.gold-gauge')).toHaveAttribute('aria-hidden', 'true');
    const alts = await page.locator('.budget img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));
    expect(alts.every((alt) => alt === '')).toBe(true);
    expect(errors).toEqual([]);
  });

  test('une modification : il suit le compte, et une Noiraude traverse', async ({ page }) => {
    await openApp(page, 'budget');
    await salaries(page, '2800', '3600');
    await expectPose(page, 'offering');

    // Plus versé : il reçoit l'argent, content.
    await setEuros(page, 'salary-a', '2900');
    await expect(noFace(page)).toHaveAttribute('data-reaction', 'gain');
    await expect(noFace(page)).toHaveAttribute('data-pose', 'content');
    const runner = page.locator('.susu-runner');
    await expect(runner).toBeVisible();
    await expect(runner).toHaveAttribute('data-carrier', 'carryYellow');
    await expect(runner).toHaveCount(0, { timeout: 4_000 });
    await expectPose(page, 'offering');

    // Moins versé : un peu triste, puis il revient à son humeur.
    await setEuros(page, 'salary-a', '2800');
    await expect(noFace(page)).toHaveAttribute('data-reaction', 'loss');
    await expect(noFace(page)).toHaveAttribute('data-pose', 'shy');
    await expectPose(page, 'offering');
  });

  test('mouvement réduit : pas de Noiraude qui traverse', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, 'budget');
    await salaries(page, '2800', '3600');
    await setEuros(page, 'salary-b', '3700');
    await expect(noFace(page)).toHaveAttribute('data-pose', 'content');
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

  test('cocher, décocher : il reçoit l’argent (content) ou le laisse partir (triste)', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'budget');
    await salaries(page, '2200', '3000');
    await page.waitForTimeout(1600);
    const full = () => noFace(page).evaluate((e) => Number(getComputedStyle(e).getPropertyValue('--full').trim()));

    // Un virement : le compte monte, les pépites volent jusqu'à lui, il mâche et s'arrondit.
    const before = await full();
    await revealNearNoFace(page, 'pay-transfer-a');
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(page.locator('.nugget-flight')).toHaveCount(1);
    await expect(page.locator('.nugget-flight img')).not.toHaveCount(0);
    await expect(noFace(page)).toHaveClass(/is-eating/);
    await expect(noFace(page)).toHaveAttribute('data-pose', 'content');
    await expect(page.locator('.nugget-flight')).toHaveCount(0, { timeout: 4_000 });
    const fed = await full();
    expect(fed).toBeGreaterThan(before);
    await expect(noFace(page)).not.toHaveAttribute('data-reaction', /./, { timeout: 4_000 });

    // Une dépense payée plus bas : il vient au bord, les pièces le quittent, triste, il se tasse.
    const last = page.getByRole('checkbox', { name: 'Assurance payé', exact: true });
    await last.evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -90));
    await expect(noFace(page)).not.toBeInViewport();
    await last.click();
    const visitor = page.locator('.noface-visitor.is-in .noface');
    await expect(visitor).toHaveAttribute('data-reaction', 'loss');
    await expect(visitor).toHaveAttribute('data-pose', 'shy');
    await expect(page.locator('.nugget-flight')).toHaveCount(1);
    expect(await full()).toBeLessThan(fed);
    await expect(page.locator('.noface-visitor .noface')).toHaveCount(0, { timeout: 6_000 });

    // Décocher : l'argent revient, il est content.
    await last.click();
    await expect(page.locator('.noface-visitor.is-in .noface')).toHaveAttribute('data-reaction', 'gain');
    await expect(page.locator('.noface-visitor .noface')).toHaveCount(0, { timeout: 6_000 });
    expect(await full()).toBeCloseTo(fed, 3);
    expect(errors).toEqual([]);
  });

  test('toucher le Sans-Visage : il penche la tête et offre un kompeitō, sans rien changer', async ({ page }) => {
    await openApp(page, 'budget');
    await salaries(page, '2200', '3000');
    await page.waitForTimeout(1600);
    const state = () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    const saved = await state();
    const touch = page.getByRole('button', { name: 'Saluer le Sans-Visage', exact: true });
    await touch.click();
    await expect(noFace(page)).toHaveClass(/is-tapped/);
    await expect(noFace(page).locator('.noface__gift')).toHaveCount(1);
    await touch.click();
    await expect(noFace(page).locator('.noface__gift')).toHaveCount(1);
    await expect(noFace(page)).not.toHaveClass(/is-tapped/, { timeout: 4_000 });
    expect(await state()).toBe(saved);
  });

  test('Noiraudes vagabondes : jamais d’elles-mêmes en test, sur aucun contrôle, attrapées et comptées', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page, 'budget');
    const stray = page.locator('.susu-stray');
    const call = () => page.evaluate(() => window.dispatchEvent(new Event('a2:susuwatari')));
    await expect(stray).toHaveCount(0);

    // Pas pendant une feuille (le pavé ouvert).
    await page.locator('#salary-a-value').click();
    await expect(page.locator('#salary-a-pad-display')).toBeFocused();
    await call();
    await expect(stray).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#salary-a-pad-display')).toHaveCount(0);

    await call();
    await expect(stray).toHaveCount(1);
    const clear = await stray.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const controls = [...document.querySelectorAll('button, input, [role="checkbox"], a[href]')].filter((c) => c !== el);
      return controls.every((c) => {
        const b = c.getBoundingClientRect();
        return b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom;
      });
    });
    expect(clear).toBe(true);

    const saved = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    await stray.dispatchEvent('click');
    await expect(stray).toHaveClass(/is-caught/);
    await expect(page.locator('.susu-stray__tally')).toHaveText('Noiraudes attrapées\u00a0: 1');
    await expect(stray).toHaveCount(0, { timeout: 4_000 });
    await expect(page.getByTestId('susu-count')).toHaveText('Noiraudes attrapées\u00a0: 1');
    expect(await page.evaluate(() => localStorage.getItem('a2-budget:susuwatari:v1'))).toBe('{"caught":1}');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(saved);

    await page.reload();
    await expect(page.getByTestId('susu-count')).toHaveText('Noiraudes attrapées\u00a0: 1');
    expect(errors).toEqual([]);
  });

  test('mouvement réduit : pas de pépites qui volent, il mange quand même', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page, 'budget');
    await salaries(page, '2200', '3000');
    await revealNearNoFace(page, 'pay-transfer-a');
    await page.getByRole('checkbox', { name: 'Virement d’AL fait', exact: true }).click();
    await expect(noFace(page)).toHaveClass(/is-eating/);
    await expect(page.locator('.nugget-flight')).toHaveCount(0);
  });
});
