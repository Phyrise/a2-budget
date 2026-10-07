/**
 * QA BUDGET V4 (390 × 844) : curseurs en euros entiers, paiements cochés
 * (le Sans-Visage mange les pépites), solde du compte commun, recalage.
 * État réaliste construit dans la page avec l'API publique de @a2/core
 * (validateAppState ok) : mois précédent recalé, mois courant en cours.
 *
 * Usage (depuis la racine du dépôt) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5181 --strictPort &
 *   node apps/web/scripts/qa-budget-v4.mjs 5181
 * Captures dans apps/web/qa/budget-v4/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const port = Number(process.argv[2] ?? 5181);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'budget-v4');
mkdirSync(outDir, { recursive: true });
const APP = `http://127.0.0.1:${port}/a2-budget/`;

async function seedState({ entry }) {
  const core = await import(/* @vite-ignore */ `/a2-budget/@fs${entry}`);
  const now = new Date();
  const key = core.currentMonthKey(now);
  const [y, m] = key.split('-').map(Number);
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  let s = core.emptyAppState();
  s.budget.settings.personA.name = 'AL';
  s.budget.settings.personB.name = 'AC';
  const month = (k, a, b, bonusB) => ({
    ...core.createMonthRecord(k, s.budget.settings),
    salaryACents: a,
    salaryBCents: b,
    bonusBCents: bonusB,
  });
  let prev = month(prevKey, 220_000, 300_000, 45_000);
  prev = core.setTransferPaid(core.setTransferPaid(prev, 'A', true), 'B', true);
  for (const e of prev.expenses) prev = core.setExpensePaid(prev, e.id, true);
  let cur = month(key, 220_000, 300_000, 67_500);
  cur = core.setTransferPaid(cur, 'A', true);
  cur = core.setExpensePaid(cur, cur.expenses[0].id, true);
  let budget = { ...s.budget, months: [prev, cur], selectedMonth: key };
  budget = core.recordBalanceCorrection(budget, prevKey, 184_000, {
    id: 'corr-1',
    recordedAt: new Date(y, m - 2, 2, 9).toISOString(),
    note: 'Relevé de la banque',
  });
  s = { ...s, budget };
  const v = core.validateAppState(JSON.parse(JSON.stringify(s)));
  if (!v.ok) return { ok: false, reason: v.reason };
  localStorage.setItem('a2-budget:state:v1', JSON.stringify(s));
  localStorage.setItem('a2-budget:ui:v1', JSON.stringify({ module: 'budget', guardianSeen: true, offlineAnnounced: true }));
  return { ok: true, key };
}

const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, locale: 'fr-FR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`page: ${e}`));
page.on('console', (msg) => msg.type() === 'error' && errors.push(`console: ${msg.text()}`));

await page.goto(`${APP}?module=budget`);
const seeded = await page.evaluate(seedState, { entry: coreEntry });
if (!seeded.ok) throw new Error(`État invalide : ${seeded.reason}`);
await page.reload();
await page.locator('[data-testid="balance-now"]').waitFor();
await page.waitForTimeout(1800);
const shot = async (name) => {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log('capture', name);
};
const text = (id) => page.getByTestId(id).innerText();

// 1. Premier écran : versements, total, solde estimé visibles.
await shot('1-premier-ecran');
for (const id of ['contribution-a', 'contribution-b', 'household-total', 'balance-now', 'balance-projection']) {
  const box = await page.getByTestId(id).boundingBox();
  check(`${id} visible au premier écran`, box !== null && box.y + box.height <= 844 - 70, box);
}
console.log('versements', await text('contribution-a'), await text('contribution-b'), await text('household-total'));
console.log('solde', await text('balance-now'), 'fin du mois', await text('balance-projection'));
const sheetText = await page.locator('.budget').innerText();
check('aucun centime à l’écran', !/\d,\d{2}\s?€/u.test(sheetText), sheetText.match(/\d,\d{2}\s?€/u)?.[0]);
check('plus de « Reste »', !/\bReste\b/u.test(sheetText));

// 2. Curseurs : + d'un euro, appui long qui accélère, saisie au toucher au-delà du max.
await page.locator('#salary-a').scrollIntoViewIfNeeded();
const before = await page.locator('#salary-a-value').innerText();
await page.locator('#salary-a-plus').click();
await page.waitForTimeout(500);
const afterOne = await page.locator('#salary-a-value').innerText();
console.log('salaire AL', before, '→', afterOne);
const plus = await page.locator('#salary-a-plus').boundingBox();
await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2);
await page.mouse.down();
await page.waitForTimeout(2600);
await shot('2-curseur-appui-long');
await page.mouse.up();
await page.waitForTimeout(400);
const afterHold = await page.locator('#salary-a-value').innerText();
console.log('après appui long', afterHold);
const euros = (t) => Number(t.replace(/[^\d-]/g, ''));
check('+1 €', euros(afterOne) === euros(before) + 1, [before, afterOne]);
check('appui long accéléré (> 30 €)', euros(afterHold) - euros(afterOne) > 30, [afterOne, afterHold]);
await page.locator('#bonus-b-value').click();
await page.locator('#bonus-b-edit').fill('3500');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const bonusRange = await page.locator('#bonus-b').inputValue();
check('valeur au-delà du max acceptée, curseur calé au bout', bonusRange === '3000' && euros(await page.locator('#bonus-b-value').innerText()) === 3500, bonusRange);
await shot('3-curseurs');
await page.locator('#bonus-b-value').click();
await page.locator('#bonus-b-edit').fill('675');
await page.keyboard.press('Enter');
await page.locator('#salary-a-value').click();
await page.locator('#salary-a-edit').fill('2200');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('B 3000 + 675 → 1 335 €', (await text('contribution-b')).replace(/\s/gu, ' ') === '1 335 €', await text('contribution-b'));

// 3. Paiements : cocher une dépense → pépites, il mange (en visite si hors écran).
const balanceBefore = await text('balance-now');
const progressBefore = await text('payments-progress');
const row = page.locator('[data-testid^="pay-expense-"]').nth(1);
await row.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await row.getByRole('checkbox').click();
await page.waitForTimeout(380);
await shot('4-paiement-vol');
await page.waitForTimeout(700);
await shot('5-paiement-mache');
check('pépites en vol puis il mâche', (await page.locator('.noface.is-eating').count()) > 0);
await page.waitForTimeout(2600);
const progressAfter = await text('payments-progress');
console.log('progression', progressBefore, '→', progressAfter);
check('progression avance', progressBefore !== progressAfter, [progressBefore, progressAfter]);
check('solde estimé baisse', balanceBefore !== (await text('balance-now')), balanceBefore);
// Décocher reste possible.
await row.getByRole('checkbox').click();
await page.waitForTimeout(300);
check('décocher', (await text('payments-progress')) === progressBefore, await text('payments-progress'));
await row.getByRole('checkbox').click();
await page.waitForTimeout(2500);

// Tout payer : salut final.
while ((await page.locator('.pay-row:not(.is-paid)').count()) > 0) {
  await page.locator('.pay-row:not(.is-paid)').first().getByRole('checkbox').click();
  await page.waitForTimeout(200);
}
await page.waitForTimeout(2400);
await shot('6-tout-paye');
check('« Tout est payé »', (await text('payments-progress')) === 'Tout est payé', await text('payments-progress'));

// 4. Recalage.
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('.screen-sheet').evaluate((el) => el.scrollTo?.(0, 0));
await page.getByRole('button', { name: 'Recaler sur le compte' }).click();
const dialog = page.getByRole('dialog', { name: 'Recaler sur le compte' });
await dialog.waitFor();
await page.keyboard.type('1500');
await page.waitForTimeout(400);
await shot('7-recaler');
await dialog.getByRole('button', { name: 'Recaler', exact: true }).click();
await page.waitForTimeout(800);
check('solde recalé à 1 500 €', (await text('balance-now')).replace(/\s/gu, ' ') === '1 500 €', await text('balance-now'));
await shot('8-apres-recalage');

check('aucune erreur console', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? 'QA budget V4 : tout est vert' : `QA budget V4 : ${failures.length} échec(s)`);
process.exit(failures.length === 0 ? 0 : 1);
