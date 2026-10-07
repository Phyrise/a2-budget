import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, UI_KEY, openApp, sheet, trackErrors } from './helpers';

test.use({ viewport: PHONE });

/**
 * Une Noiraude de la scène bien dégagée (aucune autre devant elle), au
 * repos et visible : centre de son corps (px CSS de la page) et son état.
 */
async function creature(page: Page, skip: number[] = []) {
  return page.evaluate((avoid) => {
    const canvas = document.querySelector('.nlab__canvas') as HTMLCanvasElement & { noiraudes?: any };
    const layer = canvas.noiraudes;
    const r = canvas.getBoundingClientRect();
    const free = layer.creatures.find((s: any) => {
      const b = s.body();
      return !avoid.includes(s.id) && s.state !== 'gone' && b.x > 30 && b.x < r.width - 30 && layer.hitTest(b.x, b.y) === s;
    });
    const s = free ?? layer.creatures[0];
    const b = s.body();
    return { id: s.id as number, x: r.left + b.x, y: r.top + b.y, state: s.state as string, count: layer.creatures.length as number };
  }, skip);
}

async function stateOf(page: Page, id: number) {
  return page.evaluate((wanted) => {
    const canvas = document.querySelector('.nlab__canvas') as HTMLCanvasElement & { noiraudes?: any };
    const s = canvas.noiraudes.creatures.find((c: { id: number }) => c.id === wanted);
    return { state: s.state as string, z: s.z as number };
  }, id);
}

/**
 * Labo Noiraudes (V4.3) : `?lab=noiraudes` ouvre la page plein écran ;
 * comparaison peinture / code, scène vivante (toucher → rebond, appui long
 * → tremblement puis fuite), Nuit, nombre. Ouvert aussi depuis le panneau DEV.
 */
test('labo Noiraudes : comparaison, scène vivante, toucher, appui long, nuit', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(`${APP}?lab=noiraudes`);
  const lab = page.getByTestId('noiraudes-lab');
  await expect(lab).toBeVisible();
  await expect(lab.getByRole('heading', { name: 'Labo Noiraudes' })).toBeVisible();
  await expect(lab.getByRole('img', { name: 'Trio de Noiraudes peint' })).toBeVisible();

  // La toile du trio en code est peinte (des pixels sombres au centre).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector('.nlab-cell canvas') as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let dark = 0;
        for (let i = 3; i < d.length; i += 4 * 7) if (d[i]! > 200 && d[i - 1]! < 60) dark++;
        return dark;
      }),
    )
    .toBeGreaterThan(500);

  // La scène : 8 Noiraudes par défaut ; le curseur en met 30.
  await expect.poll(async () => (await creature(page)).count).toBe(8);
  await lab.getByRole('slider', { name: 'Nombre' }).fill('30');
  await expect.poll(async () => (await creature(page)).count).toBe(30);
  await lab.getByRole('slider', { name: 'Nombre' }).fill('6');
  await expect.poll(async () => (await creature(page)).count).toBe(6);

  // Toucher : elle bondit.
  const a = await creature(page);
  await page.mouse.click(a.x, a.y);
  await expect.poll(async () => (await stateOf(page, a.id)).z, { timeout: 2000, intervals: [30] }).toBeGreaterThan(5);

  // Appui long : elle tremble, puis s'enfuit hors de l'écran.
  const b = await creature(page, [a.id]);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await expect.poll(async () => (await stateOf(page, b.id)).state, { timeout: 2000, intervals: [50] }).toBe('shiver');
  await page.waitForTimeout(800);
  await page.mouse.up();
  await expect.poll(async () => (await stateOf(page, b.id)).state, { timeout: 5000 }).toMatch(/flee|gone/);

  // Nuit.
  const night = lab.getByRole('button', { name: 'Nuit' });
  await night.click();
  await expect(night).toHaveAttribute('aria-pressed', 'true');
  await expect(lab).toHaveClass(/is-night/);

  // Fermer : retour à l'app.
  await lab.getByRole('button', { name: 'Fermer le labo' }).click();
  await expect(page.locator('.screen-sheet')).toBeVisible();
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

/** Encre de l'aperçu des tailles : somme des opacités (le papier est en CSS, la toile transparente). */
async function previewInk(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('.nlab-sizes__canvas') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 3; i < d.length; i += 4 * 3) ink += d[i]!;
    return ink / 255;
  });
}

/**
 * Panneau « Réglages » (V4.3) : replié par défaut, il s'ouvre sans masquer
 * les Noiraudes ; un curseur redessine aussitôt, « Copier » produit l'objet
 * TypeScript, les mémoires et « Coller » rechargent des paramètres, et tout
 * est retrouvé au retour (localStorage).
 */
test('labo Noiraudes : réglages au doigt — un curseur redessine, copier produit un objet', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(`${APP}?lab=noiraudes`);
  const lab = page.getByTestId('noiraudes-lab');
  const toggle = lab.getByRole('button', { name: 'Réglages' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const panel = lab.getByRole('region', { name: 'Réglages de l’apparence' });
  await expect(panel).toBeVisible();

  // Comparaison et aperçu restent au-dessus du panneau, dans l'écran.
  const sizes = (await lab.locator('.nlab-sizes').boundingBox())!;
  const box = (await panel.boundingBox())!;
  expect(sizes.y).toBeGreaterThan(0);
  expect(sizes.y + sizes.height).toBeLessThanOrEqual(box.y + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);

  // Un curseur change le rendu : disque plus petit → bien moins d'encre.
  await expect.poll(() => previewInk(page)).toBeGreaterThan(1000);
  const before = await previewInk(page);
  await panel.getByRole('tab', { name: 'Corps' }).click();
  const radius = panel.getByRole('slider', { name: 'Taille du disque', exact: true });
  await expect(radius).toHaveValue('0.86');
  await radius.fill('0.6');
  await expect(radius).toHaveValue('0.6');
  await expect.poll(() => previewInk(page), { timeout: 3000 }).toBeLessThan(before * 0.75);

  // Copier : un objet TypeScript complet, qui s'évalue et porte la valeur réglée.
  await panel.getByRole('button', { name: 'Copier les paramètres' }).click();
  const text = await panel.getByRole('textbox', { name: 'Paramètres en TypeScript' }).inputValue();
  expect(text).toMatch(/^export const SOOT_PARAMS: SootSpriteParams = \{/);
  const copied = new Function(`return ${text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)}`)() as Record<string, Record<string, number>>;
  expect(Object.keys(copied)).toEqual(['body', 'hair', 'eyes', 'limbs', 'shadow', 'anim', 'glow', 'palette']);
  expect(copied.body!.radius).toBe(0.6);
  expect(copied.hair!.count).toBe(150);
  await panel.getByRole('button', { name: 'Fermer' }).click();

  // Mémoire A, réinitialiser, rappeler A.
  await panel.getByRole('button', { name: 'Mémoriser A' }).click();
  await panel.getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(radius).toHaveValue('0.86');
  await panel.getByRole('button', { name: 'Rappeler A' }).click();
  await expect(radius).toHaveValue('0.6');

  // Coller un objet partiel.
  await panel.getByRole('button', { name: 'Coller' }).click();
  await panel.getByRole('textbox', { name: 'Paramètres à importer' }).fill('const p = { hair: { count: 225, lenMax: 0.24 } };');
  await panel.getByRole('button', { name: 'Appliquer' }).click();
  await panel.getByRole('tab', { name: 'Poils' }).click();
  await expect(panel.getByRole('slider', { name: 'Nombre de poils', exact: true })).toHaveValue('225');

  // Au retour, le panneau et les réglages sont retrouvés.
  await page.waitForTimeout(300);
  await page.reload();
  await expect(lab.getByRole('region', { name: 'Réglages de l’apparence' })).toBeVisible();
  await expect(panel.getByRole('slider', { name: 'Nombre de poils', exact: true })).toHaveValue('225');
  await panel.getByRole('tab', { name: 'Corps' }).click();
  await expect(radius).toHaveValue('0.6');
  await expect(panel.getByRole('button', { name: 'Rappeler A' })).toBeEnabled();
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test('labo Noiraudes : ouvert depuis le panneau DEV', async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem(key, JSON.stringify({ devMode: true }));
      sessionStorage.setItem('seeded', '1');
    }
  }, UI_KEY);
  await openApp(page);
  await page.locator('.app-header').getByRole('button', { name: 'Mode développeur' }).click();
  const dev = sheet(page, 'Mode développeur');
  await dev.getByRole('button', { name: 'Labo Noiraudes' }).click();
  await expect(page.getByTestId('noiraudes-lab')).toBeVisible();
  await expect(page).toHaveURL(/\?lab=noiraudes/);
});
