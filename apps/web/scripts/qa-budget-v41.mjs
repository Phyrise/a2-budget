/**
 * QA BUDGET V4.1 (390 × 844) : saisie au pavé (AmountPad, aucun clavier
 * système), plus aucun curseur (défiler ne change rien), bloc « Ce mois-ci »
 * fusionné (virements + dépenses cochables), revenus au-dessus.
 *
 * Usage (depuis la racine du worktree) :
 *   node apps/web/node_modules/vite/bin/vite.js apps/web --port 5181 --strictPort &
 *   node apps/web/scripts/qa-budget-v41.mjs 5181
 * Captures dans apps/web/qa/budget/ (gitignoré).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { seedBudgetV41 } from './qa-budget-v41.seed.mjs';

const port = Number(process.argv[2] ?? 5181);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreEntry = resolve(webRoot, '../../packages/core/src/index.ts');
const outDir = join(webRoot, 'qa', 'budget');
mkdirSync(outDir, { recursive: true });
const APP = `http://127.0.0.1:${port}/a2-budget/`;

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
const seeded = await page.evaluate(seedBudgetV41, { entry: coreEntry });
if (!seeded.ok) throw new Error(`État invalide : ${seeded.reason}`);
await page.reload();
await page.locator('[data-testid="balance-now"]').waitFor();
await page.waitForTimeout(1500);
const shot = async (name, opts = {}) => {
  await page.screenshot({ path: join(outDir, `${name}.png`), ...opts });
  console.log('capture', name);
};
const persistedMonth = () =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('a2-budget:state:v1'));
    return s.budget.months.find((m) => m.monthKey === s.budget.selectedMonth);
  });

// 1. Structure : revenus au-dessus du bloc fusionné, plus de curseur, plus d'ancien bloc.
const order = await page.evaluate(() =>
  [...document.querySelectorAll('.budget .section-title')].map((h) => h.textContent.trim()),
);
check('ordre des sections : Revenus puis Ce mois-ci', order.indexOf('Revenus du mois') >= 0 && order.indexOf('Revenus du mois') < order.indexOf('Ce mois-ci'), order);
check('plus de « Dépenses communes » ni « À payer ce mois » en titre', !order.includes('Dépenses communes') && !order.includes('À payer ce mois'), order);
check('aucun curseur dans le Budget', (await page.locator('.budget input[type="range"], .budget [role="slider"]').count()) === 0);
check('aucun champ texte de montant', (await page.locator('.budget input[inputmode="decimal"], .budget input[inputmode="numeric"]').count()) === 0);
const text = await page.locator('.budget').innerText();
check('plus de « souvent payé(e)s le mois suivant »', !/mois suivant/iu.test(text));
check('aucun centime', !/\d,\d{2}\s?€/u.test(text));
check('progression dans l’en-tête', /2 sur \d+ payés/u.test(await page.getByTestId('payments-progress').innerText()));
const bar = await page.locator('.paybook__progress .payments__bar').boundingBox();
check('barre de progression visible', bar !== null && bar.width > 120 && bar.height >= 3, bar);
check('pas de débordement horizontal', (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);

await shot('01-budget-haut');
await shot('02-budget-complet', { fullPage: true });

// 2. Défiler (molette, glisser) au-dessus des montants ne change rien.
const before = await persistedMonth();
const salaryBox = await page.locator('#salary-b-value').boundingBox();
await page.mouse.move(salaryBox.x + salaryBox.width / 2, salaryBox.y + salaryBox.height / 2);
for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, 120);
for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -120);
await page.waitForTimeout(300);
const after = await persistedMonth();
check('défiler sur les montants ne change rien', JSON.stringify(before) === JSON.stringify(after));

// 3. Pavé : ouverture, aucun champ texte focalisé, saisie, Valider.
await page.locator('#salary-b-value').scrollIntoViewIfNeeded();
await page.locator('#salary-b-value').click();
const pad = page.getByRole('dialog', { name: 'Salaire d’AC' });
await pad.waitFor();
await page.waitForTimeout(450);
check('le focus est sur le montant (pas de clavier système)', await page.evaluate(() => document.activeElement?.id === 'salary-b-pad-display' && !document.activeElement.matches('input, textarea')));
const panel = await pad.locator('.sheet__panel').boundingBox();
check('la feuille tient entière à 390 × 844', panel.y >= 0 && panel.y + panel.height <= 844 + 1, panel);
check('raccourci « Salaire habituel »', (await pad.getByRole('button', { name: /Salaire habituel/u }).count()) === 1);
await pad.getByRole('button', { name: '3', exact: true }).click();
await pad.getByRole('button', { name: '1', exact: true }).click();
await pad.getByRole('button', { name: 'Deux zéros', exact: true }).click();
await pad.getByRole('button', { name: 'Plus 10 €', exact: true }).click();
await shot('03-pave-ouvert');
check('montant composé 3 110 €', (await pad.getByTestId('amount-pad-display').innerText()).replace(/\s/gu, '') === '3110€');
await pad.getByRole('button', { name: 'Valider' }).click();
await pad.waitFor({ state: 'hidden' });
check('validé et enregistré', (await persistedMonth()).salaryBCents === 311_000);
check('focus rendu au montant', await page.evaluate(() => document.activeElement?.id === 'salary-b-value'));

// 4. Clavier physique : chiffres + Entrée ; Échap annule.
await page.keyboard.press('Enter');
await pad.waitFor();
await page.waitForTimeout(300);
await page.keyboard.type('3000');
await page.keyboard.press('Enter');
await pad.waitFor({ state: 'hidden' });
check('clavier : 3000 + Entrée', (await persistedMonth()).salaryBCents === 300_000);
await page.keyboard.press('Enter');
await pad.waitFor();
await page.keyboard.type('9');
await page.keyboard.press('Escape');
await pad.waitFor({ state: 'hidden' });
check('Échap annule', (await persistedMonth()).salaryBCents === 300_000);

// 5. Bloc fusionné : cocher (le Sans-Visage mange), montant d'une dépense au pavé.
const ledger = page.getByTestId('month-ledger');
await ledger.scrollIntoViewIfNeeded();
await ledger.getByRole('checkbox', { name: 'Virement d’AC fait' }).click();
await page.waitForTimeout(250);
await ledger.getByRole('checkbox', { name: 'Électricité payé' }).click();
await page.waitForTimeout(1600);
check('cases cochées enregistrées', (await persistedMonth()).paid?.transferB === true);
await page.evaluate(() => document.querySelector('[data-testid="month-ledger"]').scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -70));
await page.waitForTimeout(400);
await shot('04-bloc-fusionne');
const internet = page.locator('[id$="-internet-amount-value"]');
await internet.click();
const padInternet = page.getByRole('dialog', { name: 'Montant de Internet' });
await padInternet.waitFor();
check('raccourci « Comme le mois dernier » ou « Montant habituel »', (await padInternet.locator('.amount-pad__shortcut').count()) >= 1);
await page.keyboard.type('45');
await page.keyboard.press('Enter');
await padInternet.waitFor({ state: 'hidden' });
check('dépense au pavé : Internet 45 €', (await persistedMonth()).expenses.find((e) => e.id === 'internet')?.amountCents === 4_500);

// 6. Compléments repliés : le bouton ouvre directement le pavé ; Annuler replie.
await page.evaluate(() => window.scrollTo(0, 0));
const addBonus = page.getByRole('button', { name: 'Ajouter des compléments pour AL' });
await addBonus.scrollIntoViewIfNeeded();
await addBonus.click();
const padBonus = page.getByRole('dialog', { name: 'Compléments d’AL' });
await padBonus.waitFor();
await padBonus.getByRole('button', { name: 'Annuler' }).click();
await padBonus.waitFor({ state: 'hidden' });
await page.waitForTimeout(300);
check('Annuler replie les compléments et rend le focus', (await page.locator('#bonus-a').count()) === 0 && (await addBonus.evaluate((b) => b === document.activeElement)));

check('aucune erreur de page', errors.length === 0, errors);
await browser.close();
console.log(failures.length === 0 ? '\nTOUT VA BIEN' : `\n${failures.length} échec(s)`);
process.exit(failures.length === 0 ? 0 : 1);
