import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:5173/a2-budget/';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'qa-gate');
await import('node:fs').then((fs) => fs.mkdirSync(OUT, { recursive: true }));

// État V2 de démo : budget par défaut + 3 tâches + forêt vivante.
function seedState() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = `${monthKey}-${String(now.getDate()).padStart(2, '0')}`;
  // Jour ISO (1 = lundi … 7 = dimanche) pour que les tâches hebdo soient dues aujourd'hui.
  const isoDay = ((now.getDay() + 6) % 7) + 1;
  const personA = { id: 'a', name: 'AL', baseSalaryCents: 220000, baseRateBps: 4000, variableRateBps: 2000 };
  const personB = { id: 'b', name: 'AC', baseSalaryCents: 300000, baseRateBps: 4000, variableRateBps: 2000 };
  const recurring = [
    { id: 'rent', label: 'Loyer + charges', amountCents: 130000 },
    { id: 'electricity', label: 'Électricité', amountCents: 10000 },
    { id: 'groceries', label: 'Courses', amountCents: 40000 },
    { id: 'internet', label: 'Internet', amountCents: 3000 },
    { id: 'insurance', label: 'Assurance', amountCents: 1500 },
    { id: 'other', label: 'Autres', amountCents: 0 },
  ];
  return {
    schemaVersion: 2,
    household: { people: [{ id: 'a', name: 'AL' }, { id: 'b', name: 'AC' }] },
    budget: {
      settings: { personA, personB, recurringExpenses: recurring, defaultReserveTargetCents: 0 },
      months: [{ monthKey, personA, personB, salaryACents: 220000, salaryBCents: 300000, expenses: recurring, reserveTargetCents: 0 }],
      selectedMonth: monthKey,
    },
    chores: {
      tasks: [
        { id: 't1', title: 'Aspirateur', assignee: 'a', recurrence: 'weekly', weeklyDay: isoDay, createdAt: todayKey },
        { id: 't2', title: 'Salle de bain', assignee: 'b', recurrence: 'weekly', weeklyDay: isoDay, createdAt: todayKey },
        { id: 't3', title: 'Lessive', assignee: 'both', recurrence: 'weekly', weeklyDay: isoDay, createdAt: todayKey },
      ],
      completions: [],
    },
    forest: {
      vitality: 62,
      lifetimeCare: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastMeaningfulActionDate: null,
      growthStage: 2,
      unlockedCreatureIds: ['moss-ling', 'seed-spirit'],
      unlockedEnvironmentIds: [],
      lastRareEvent: null,
      paused: false,
      pausedAt: null,
      pauses: [],
      creditLedger: {},
      lastProcessedDay: null,
    },
    groceries: { items: [] },
  };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript((state) => {
  window.localStorage.setItem('a2-budget:state:v1', JSON.stringify(state));
}, seedState());
const page = await context.newPage();

// Budget
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'gate-budget.png') });
console.log('captured budget');

// Maison
await page.goto(BASE + '?module=maison', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'gate-maison.png') });
console.log('captured maison');

// Réglages (overlay)
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('button[aria-label="Réglages"]').click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'gate-settings.png') });
console.log('captured settings');

await browser.close();
