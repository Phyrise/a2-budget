/**
 * Calendrier V4.1 : le Chatbus traverse sans à-coups quand on ajoute un
 * moment — vitesse constante (positions image par image proches d'une
 * droite, jamais de recul), rebond et inclinaison de course, une seule
 * pose visible à la fois, page jamais élargie, parti à la fin. Mouvement
 * réduit : pas de traversée.
 */
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, UI_KEY, trackErrors } from './helpers';

test.use({ viewport: PHONE });

async function openCalendar(page: Page) {
  await page.addInitScript((ui) => {
    if (sessionStorage.getItem('catbus-seeded')) return;
    localStorage.setItem(ui, JSON.stringify({ module: 'calendar', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
    sessionStorage.setItem('catbus-seeded', '1');
  }, UI_KEY);
  await page.goto(`${APP}?module=calendar`);
  await expect(page.locator('#calendar-title')).toBeVisible();
}

async function addEvent(page: Page, sentence: string) {
  await page.locator('.calendar button[aria-label^="Ajouter"]').click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#event-sentence').fill(sentence);
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
}

interface Sample {
  t: number;
  x: number;
  y: number;
  angle: number;
  visible: number;
}

test('le Chatbus file à vitesse constante, rebondit, s’incline, puis repart', async ({ page }) => {
  const errors = trackErrors(page);
  await openCalendar(page);
  await addEvent(page, 'pique-nique au parc dimanche 12h');
  await page.locator('.cal-catbus').waitFor();

  const samples = await page.evaluate(
    () =>
      new Promise<Sample[]>((resolve) => {
        const out: Sample[] = [];
        const t0 = performance.now();
        const tick = () => {
          const track = document.querySelector('.cal-catbus__track');
          const body = document.querySelector('.cal-catbus__body');
          const tilt = document.querySelector('.cal-catbus__tilt');
          if (!track || !body || !tilt) return resolve(out);
          const m = new DOMMatrix(getComputedStyle(tilt).transform);
          const visible = [...document.querySelectorAll('.cal-catbus__bus')].filter((el) => Number(getComputedStyle(el).opacity) > 0.5).length;
          out.push({
            t: performance.now() - t0,
            x: track.getBoundingClientRect().left,
            y: body.getBoundingClientRect().top - track.getBoundingClientRect().top,
            angle: (Math.atan2(m.b, m.a) * 180) / Math.PI,
            visible,
          });
          if (document.documentElement.scrollWidth > window.innerWidth) out.push({ t: -1, x: 0, y: 0, angle: 0, visible: -1 });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

  expect(samples.some((s) => s.t < 0), 'la page ne s’élargit jamais').toBe(false);
  const mid = samples.filter((s) => s.x < 390 && s.x > -190);
  expect(mid.length).toBeGreaterThan(20);
  // Jamais de recul, et des positions alignées sur une droite x(t).
  expect(mid.slice(1).filter((s, i) => s.x > mid[i]!.x)).toHaveLength(0);
  const n = mid.length;
  const mt = mid.reduce((a, s) => a + s.t, 0) / n;
  const mx = mid.reduce((a, s) => a + s.x, 0) / n;
  const slope = mid.reduce((a, s) => a + (s.t - mt) * (s.x - mx), 0) / mid.reduce((a, s) => a + (s.t - mt) ** 2, 0);
  const deviation = Math.max(...mid.map((s) => Math.abs(mx + slope * (s.t - mt) - s.x)));
  expect(deviation, `écart à une vitesse constante : ${deviation.toFixed(1)} px`).toBeLessThan(8);
  expect(-slope).toBeGreaterThan(0.2);
  // Rebond (quelques px) et inclinaison légère (quelques degrés).
  const ys = mid.map((s) => s.y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(4);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(12);
  const angles = mid.map((s) => s.angle);
  expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThanOrEqual(1);
  expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(4);
  // Une seule pose à l'écran à chaque image.
  expect(new Set(samples.map((s) => s.visible))).toEqual(new Set([1]));
  // Traversée complète en moins de 2,5 s, puis plus rien.
  expect(samples.at(-1)!.t).toBeLessThan(2500);
  await expect(page.locator('.cal-catbus')).toHaveCount(0);
  expect(errors, `erreurs page : ${errors.join(' | ')}`).toHaveLength(0);
});

test.describe('mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('pas de Chatbus, le moment est bien ajouté', async ({ page }) => {
    await openCalendar(page);
    await addEvent(page, 'dîner samedi 20h');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.waitForTimeout(500);
    await expect(page.locator('.cal-catbus')).toHaveCount(0);
  });
});
