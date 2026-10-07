/**
 * Corrections V3.1 : taux communs réellement communs (réglages anciens
 * divergents), « Appliquer les taux communs » annulable, copie de sécurité
 * d'avant V3.1 écrite une seule fois.
 * États de départ construits avec @a2/core (validateAppState).
 */
import { createMonthRecord, emptyAppState, validateAppState, type AppState } from '@a2/core';
import { expect, test, type Page } from '@playwright/test';
import { APP, PHONE, STORAGE_KEY, UI_KEY, closeSheet, persisted, sheet } from './helpers';

test.use({ viewport: PHONE });

const BACKUP_KEY = 'a2-budget:backup-pre-v31';

function currentKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Réglages hérités : A 40 % / 20 %, B 30 % / 15 % ; mois courant aux taux d'origine. */
function divergentState(): AppState {
  const s = emptyAppState();
  const settings = {
    ...s.budget.settings,
    personB: { ...s.budget.settings.personB, baseRateBps: 3000, variableRateBps: 1500 },
  };
  const key = currentKey();
  const month = createMonthRecord(key, s.budget.settings);
  const state: AppState = {
    ...s,
    budget: {
      settings,
      months: [{ ...month, personB: { ...month.personB, baseRateBps: 3000, variableRateBps: 1500 } }],
      selectedMonth: key,
    },
  };
  const v = validateAppState(state);
  if (!v.ok) throw new Error(`état de test invalide : ${v.reason}`);
  return state;
}

/** Ouvre « Détail du calcul » s'il est replié (il le reste d'un mois à l'autre). */
async function openDetail(page: Page) {
  const toggle = page.getByRole('button', { name: 'Détail du calcul' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function openSeeded(page: Page, raw: string) {
  await page.addInitScript(
    ({ key, ui, value }) => {
      if (sessionStorage.getItem('corr-seeded')) return;
      localStorage.setItem(key, value);
      localStorage.setItem(ui, JSON.stringify({ module: 'budget', forestMotion: 'still', guardianSeen: true, offlineAnnounced: true }));
      sessionStorage.setItem('corr-seeded', '1');
    },
    { key: STORAGE_KEY, ui: UI_KEY, value: raw },
  );
  await page.goto(`${APP}?module=budget`);
  await expect(page.locator('.screen-sheet')).toBeVisible();
}

test.describe('Corrections V3.1', () => {
  test('réglages divergents : un nouveau mois est calculé aux taux communs affichés', async ({ page }) => {
    await openSeeded(page, JSON.stringify(divergentState()));

    // Mois existant : taux d'origine signalés, jamais réécrits d'eux-mêmes.
    await openDetail(page);
    await expect(page.getByText(/Ce mois garde des taux différents pour chacun/)).toBeVisible();

    // Réglages : la note est au présent, avec une action explicite.
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    const settings = sheet(page, 'Réglages');
    await expect(settings.getByRole('note').filter({ hasText: 'encore des taux différents' })).toBeVisible();
    await closeSheet(page, 'Réglages');

    // Mois suivant : depuis la V4, le consulter ne l'écrit pas (le solde
    // reporté ne doit pas bouger) ; il est créé au premier geste, ici un
    // virement coché — et il l'est alors aux taux communs (B à 40 %).
    await page.getByRole('button', { name: 'Mois suivant' }).click();
    await expect
      .poll(async () => {
        const s = await persisted(page);
        return s.budget.months.some((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
      })
      .toBe(false);
    await page.getByRole('checkbox', { name: /^Virement d’.+ fait$/ }).first().click();
    await expect.poll(async () => {
      const s = await persisted(page);
      const m = s.budget.months.find((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
      return m && [m.personA.baseRateBps, m.personB.baseRateBps, m.personB.variableRateBps];
    }).toEqual([4000, 4000, 2000]);
    await openDetail(page);
    await expect(page.getByText('Les taux sont communs à vous deux et se règlent dans les Réglages.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appliquer les taux communs à ce mois' })).toHaveCount(0);

    // « Les rendre communs » aligne les réglages ; la note disparaît.
    await page.getByRole('button', { name: 'Réglages', exact: true }).click();
    await settings.getByRole('button', { name: 'Les rendre communs' }).click();
    await expect(settings.getByText('encore des taux différents')).toHaveCount(0);
    await expect.poll(async () => (await persisted(page)).budget.settings.personB.baseRateBps).toBe(4000);
  });

  test('« Appliquer les taux communs à ce mois » se défait avec Annuler', async ({ page }) => {
    await openSeeded(page, JSON.stringify(divergentState()));
    await openDetail(page);
    const apply = page.getByRole('button', { name: 'Appliquer les taux communs à ce mois', exact: true });
    await apply.click();
    const ratesOf = async () => {
      const s = await persisted(page);
      const m = s.budget.months.find((x: { monthKey: string }) => x.monthKey === s.budget.selectedMonth);
      return [m.personB.baseRateBps, m.personB.variableRateBps];
    };
    await expect.poll(ratesOf).toEqual([4000, 2000]);
    await expect(page.getByText(/Taux communs appliqués à/)).toBeVisible();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect.poll(ratesOf).toEqual([3000, 1500]);
    await expect(apply).toBeVisible();
  });

  test('données d’avant V3.1 : copie de sécurité brute, écrite une seule fois', async ({ page }) => {
    const key = currentKey();
    const s = emptyAppState();
    const legacyMonth = { ...createMonthRecord(key, s.budget.settings), salaryBCents: 367_500 } as Record<string, unknown>;
    delete legacyMonth.bonusACents;
    delete legacyMonth.bonusBCents;
    const raw = JSON.stringify({ ...s, budget: { ...s.budget, months: [legacyMonth], selectedMonth: key } });
    await openSeeded(page, raw);

    await expect.poll(async () => (await persisted(page)).budget.months[0].bonusBCents).toBe(67_500);
    expect(await page.evaluate((k) => localStorage.getItem(k), BACKUP_KEY)).toBe(raw);

    // Rechargé au nouveau format : la copie n'est ni remplacée ni effacée.
    await page.reload();
    await expect(page.locator('.screen-sheet')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), BACKUP_KEY)).toBe(raw);
  });

  test('données déjà au format V3.1 : aucune copie de sécurité', async ({ page }) => {
    await openSeeded(page, JSON.stringify(divergentState()));
    await expect.poll(async () => (await persisted(page)).budget.months.length).toBe(1);
    expect(await page.evaluate((k) => localStorage.getItem(k), BACKUP_KEY)).toBeNull();
  });
});
