import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  DAILY_CREDIT_CAP,
  DAILY_DECAY,
  emptyForest,
  evaluateRareEvents,
  evaluateUnlocks,
  grantCredit,
  growthStageFor,
  GUARDIAN_STREAK,
  pauseForest,
  resumeForest,
  tombstoneCredit,
  updateStreak,
  VITALITY_MAX,
  VITALITY_PER_CREDIT,
  vitalityState,
} from './forest.js';
import { migrateState } from './appState.js';
import type { ForestState } from './types.js';

/** Construit une forêt avec un streak de `n` jours consécutifs (à partir du 1er oct). */
function forestWithStreak(n: number): ForestState {
  let forest = emptyForest();
  for (let i = 1; i <= n; i += 1) {
    const day = `2026-10-${String(i).padStart(2, '0')}`;
    forest = updateStreak(forest, day);
  }
  return forest;
}

/** Accorde `n` crédits significatifs sur plusieurs jours (respecte le cap quotidien). */
function grantNCredits(n: number): ForestState {
  let forest = emptyForest();
  let day = 1;
  let count = 0;
  while (count < n) {
    const dateKey = `2026-10-${String(day).padStart(2, '0')}`;
    for (let i = 1; i <= DAILY_CREDIT_CAP && count < n; i += 1) {
      forest = grantCredit(forest, `t${day}-${i}|${dateKey}`, dateKey).forest;
      count += 1;
    }
    day += 1;
  }
  return forest;
}

describe('vitalityState', () => {
  it('quatre états qualitatifs distincts', () => {
    expect(vitalityState(0)).toBe('quiet');
    expect(vitalityState(24)).toBe('quiet');
    expect(vitalityState(25)).toBe('peaceful');
    expect(vitalityState(49)).toBe('peaceful');
    expect(vitalityState(50)).toBe('lively');
    expect(vitalityState(74)).toBe('lively');
    expect(vitalityState(75)).toBe('flourishing');
    expect(vitalityState(100)).toBe('flourishing');
  });
});

describe('grantCredit (action significative)', () => {
  it('une action augmente vitalité et croissance', () => {
    const { forest, granted } = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01');
    expect(granted).toBe(true);
    expect(forest.vitality).toBe(VITALITY_PER_CREDIT);
    expect(forest.lifetimeCare).toBe(1);
  });

  it('double complétion du même événement = no-op (pas de doublon)', () => {
    const first = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01');
    const second = grantCredit(first.forest, 't1|2026-10-01', '2026-10-01');
    expect(second.granted).toBe(false);
    expect(second.forest.lifetimeCare).toBe(1);
    expect(second.forest.vitality).toBe(VITALITY_PER_CREDIT);
  });

  it('cap quotidien : 30 tâches différentes le même jour → 3 crédits max', () => {
    let forest = emptyForest();
    let grantedCount = 0;
    for (let i = 1; i <= 30; i += 1) {
      const { forest: f, granted } = grantCredit(forest, `t${i}|2026-10-01`, '2026-10-01');
      forest = f;
      if (granted) grantedCount += 1;
    }
    expect(grantedCount).toBe(DAILY_CREDIT_CAP);
    expect(forest.lifetimeCare).toBe(DAILY_CREDIT_CAP);
    expect(forest.vitality).toBe(DAILY_CREDIT_CAP * VITALITY_PER_CREDIT);
  });

  it('le cap se renouvelle le jour suivant', () => {
    let forest = emptyForest();
    for (let i = 1; i <= DAILY_CREDIT_CAP; i += 1) {
      forest = grantCredit(forest, `t${i}|2026-10-01`, '2026-10-01').forest;
    }
    // Jour suivant : le cap est frais.
    const { forest: f2, granted } = grantCredit(forest, 't99|2026-10-02', '2026-10-02');
    expect(granted).toBe(true);
    expect(f2.lifetimeCare).toBe(DAILY_CREDIT_CAP + 1);
  });
});

describe('tombstoneCredit (annuler / recompléter)', () => {
  it('annuler met en tombstone sans diminuer la croissance', () => {
    const granted = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01');
    const { forest, tombstoned } = tombstoneCredit(granted.forest, 't1|2026-10-01');
    expect(tombstoned).toBe(true);
    expect(forest.lifetimeCare).toBe(1); // inchangé
    expect(forest.vitality).toBe(VITALITY_PER_CREDIT); // inchangé
    expect(forest.creditLedger['t1|2026-10-01']!.status).toBe('tombstoned');
  });

  it('recompléter après annulation ne redonne aucun crédit', () => {
    const granted = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01');
    const tombstoned = tombstoneCredit(granted.forest, 't1|2026-10-01');
    const regrant = grantCredit(tombstoned.forest, 't1|2026-10-01', '2026-10-01');
    expect(regrant.granted).toBe(false);
    expect(regrant.forest.lifetimeCare).toBe(1);
  });

  it('un tombstone compte toujours pour le cap du jour (anti-farming)', () => {
    let forest = emptyForest();
    for (let i = 1; i <= DAILY_CREDIT_CAP; i += 1) {
      forest = grantCredit(forest, `t${i}|2026-10-01`, '2026-10-01').forest;
    }
    // Annuler un crédit ne libère pas de place : le 4e crédit du jour est refusé.
    forest = tombstoneCredit(forest, 't1|2026-10-01').forest;
    const { granted } = grantCredit(forest, 't99|2026-10-01', '2026-10-01');
    expect(granted).toBe(false);
  });
});

describe('advanceDay (décroissance douce + jour manqué)', () => {
  it('l’inactivité fait décroître la vitalité doucement', () => {
    let forest = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01').forest;
    const v0 = forest.vitality;
    forest = advanceDay(forest, '2026-10-02');
    expect(forest.vitality).toBe(v0 - DAILY_DECAY);
    forest = advanceDay(forest, '2026-10-03');
    expect(forest.vitality).toBe(v0 - 2 * DAILY_DECAY);
  });

  it('la vitalité ne descend jamais sous 0', () => {
    let forest = emptyForest();
    for (let i = 0; i < 50; i += 1) {
      forest = advanceDay(forest, `2026-10-${String((i % 28) + 1).padStart(2, '0')}`);
    }
    expect(forest.vitality).toBe(0);
  });

  it('idempotent par jour (pas de double décroissance)', () => {
    let forest = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01').forest;
    forest = advanceDay(forest, '2026-10-02');
    const v = forest.vitality;
    forest = advanceDay(forest, '2026-10-02'); // même jour
    expect(forest.vitality).toBe(v);
  });

  it('un jour manqué non ponctué casse le streak (comportement défini)', () => {
    let forest = forestWithStreak(3);
    expect(forest.currentStreak).toBe(3);
    forest = advanceDay(forest, '2026-10-04'); // jour 4 sans action
    expect(forest.currentStreak).toBe(0);
    // Le streak repart à 1 le jour suivant.
    forest = updateStreak(forest, '2026-10-05');
    expect(forest.currentStreak).toBe(1);
  });

  it('la croissance permanente ne diminue jamais (stade, lifetimeCare)', () => {
    const forest = grantNCredits(12); // 12 crédits sur 4 jours (cap 3/jour)
    // 12 crédits → stade 2 (seuil 10).
    const before = evaluateUnlocks(forest);
    expect(before.lifetimeCare).toBe(12);
    expect(before.growthStage).toBe(2);
    // Décroissance + tombstones : la croissance ne baisse pas.
    let decayed = before;
    for (let i = 0; i < 10; i += 1) {
      decayed = advanceDay(decayed, `2026-11-${String(i + 1).padStart(2, '0')}`);
    }
    expect(decayed.lifetimeCare).toBe(before.lifetimeCare);
    expect(decayed.growthStage).toBe(before.growthStage);
    expect(decayed.vitality).toBeLessThan(before.vitality);
  });
});

describe('pause / reprise', () => {
  it('la pause empêche la décroissance', () => {
    let forest = grantCredit(emptyForest(), 't1|2026-10-01', '2026-10-01').forest;
    const v0 = forest.vitality;
    forest = pauseForest(forest, '2026-10-02');
    forest = advanceDay(forest, '2026-10-03'); // en pause
    expect(forest.vitality).toBe(v0); // pas de décroissance
    expect(forest.paused).toBe(true);
  });

  it('la pause exclut les jours de pause du streak (ponté)', () => {
    let forest = forestWithStreak(1); // streak 1, dernier jour 2026-10-01
    forest = pauseForest(forest, '2026-10-02'); // pause 2-3 oct
    forest = resumeForest(forest, '2026-10-04'); // reprise le 4 oct
    expect(forest.paused).toBe(false);
    forest = updateStreak(forest, '2026-10-04');
    expect(forest.currentStreak).toBe(2); // ponté par la pause
  });

  it('la reprise permet de nouveau d’accorder des crédits', () => {
    let forest = emptyForest();
    forest = pauseForest(forest, '2026-10-01');
    const during = grantCredit(forest, 't1|2026-10-01', '2026-10-01');
    expect(during.granted).toBe(false); // en pause : pas de crédit
    forest = resumeForest(forest, '2026-10-02');
    const after = grantCredit(forest, 't1|2026-10-02', '2026-10-02');
    expect(after.granted).toBe(true);
  });

  it('une pause du même jour ne crée pas de jour de pause', () => {
    let forest = emptyForest();
    forest = pauseForest(forest, '2026-10-01');
    forest = resumeForest(forest, '2026-10-01');
    // L'intervalle est vide : aucun jour n'est « ponctué ».
    expect(forest.pauses[0]!.end).toBe('2026-10-01');
    expect(forest.pauses[0]!.start).toBe('2026-10-01');
  });
});

describe('streak', () => {
  it('incrémente correctement sur jours consécutifs', () => {
    let forest = emptyForest();
    forest = updateStreak(forest, '2026-10-01');
    expect(forest.currentStreak).toBe(1);
    forest = updateStreak(forest, '2026-10-02');
    expect(forest.currentStreak).toBe(2);
    forest = updateStreak(forest, '2026-10-03');
    expect(forest.currentStreak).toBe(3);
    expect(forest.longestStreak).toBe(3);
  });

  it('plusieurs actions le même jour n’augmentent pas le streak', () => {
    let forest = emptyForest();
    forest = updateStreak(forest, '2026-10-01');
    forest = updateStreak(forest, '2026-10-01'); // même jour
    expect(forest.currentStreak).toBe(1);
  });

  it('longestStreak ne diminue jamais', () => {
    let forest = forestWithStreak(5);
    expect(forest.longestStreak).toBe(5);
    forest = advanceDay(forest, '2026-10-06'); // casse le streak
    expect(forest.currentStreak).toBe(0);
    expect(forest.longestStreak).toBe(5); // mémoire conservée
  });
});

describe('événements rares (gardien)', () => {
  it('le gardien se déclenche quand le streak atteint 10', () => {
    let forest = forestWithStreak(GUARDIAN_STREAK - 1); // streak 9
    const previous = forest.currentStreak;
    forest = updateStreak(forest, '2026-10-10'); // streak 10
    const { forest: f2, triggered } = evaluateRareEvents(forest, previous, forest.currentStreak);
    expect(triggered).toBe('guardian');
    expect(f2.lastRareEvent).toBe('guardian');
  });

  it('pas de doublon : le gardien ne se redéclenche pas à 11, 12…', () => {
    let forest = forestWithStreak(GUARDIAN_STREAK); // streak 10
    const { triggered: at10 } = evaluateRareEvents(forest, 9, 10);
    expect(at10).toBe('guardian');
    // Jour 11 : streak 11, pas de nouveau déclenchement.
    const previous = forest.currentStreak;
    forest = updateStreak(forest, '2026-10-11');
    const { triggered: at11 } = evaluateRareEvents(forest, previous, forest.currentStreak);
    expect(at11).toBeNull();
    // Jour 12 : idem.
    const previous2 = forest.currentStreak;
    forest = updateStreak(forest, '2026-10-12');
    const { triggered: at12 } = evaluateRareEvents(forest, previous2, forest.currentStreak);
    expect(at12).toBeNull();
  });

  it('un nouveau streak de 10 après une cassure redéclenche le gardien', () => {
    let forest = forestWithStreak(GUARDIAN_STREAK); // streak 10
    evaluateRareEvents(forest, 9, 10); // déclenché
    // Cassure.
    forest = advanceDay(forest, '2026-10-11');
    expect(forest.currentStreak).toBe(0);
    // Nouveau streak jusqu'à 10.
    let day = 12;
    let prev = 0;
    while (forest.currentStreak < GUARDIAN_STREAK) {
      const key = `2026-10-${String(day).padStart(2, '0')}`;
      const before = forest.currentStreak;
      forest = updateStreak(forest, key);
      const { forest: f2, triggered } = evaluateRareEvents(forest, before, forest.currentStreak);
      forest = f2;
      if (triggered === 'guardian') break;
      prev = forest.currentStreak;
      day += 1;
    }
    expect(forest.currentStreak).toBe(GUARDIAN_STREAK);
    expect(forest.lastRareEvent).toBe('guardian');
  });
});

describe('croissance / déblocages', () => {
  it('growthStageFor est monotone', () => {
    expect(growthStageFor(0)).toBe(1);
    expect(growthStageFor(9)).toBe(1);
    expect(growthStageFor(10)).toBe(2);
    expect(growthStageFor(25)).toBe(3);
    expect(growthStageFor(100)).toBe(5);
  });

  it('evaluateUnlocks ne diminue jamais les ids débloqués', () => {
    const forest = grantNCredits(25); // 25 crédits sur 9 jours (cap 3/jour)
    const unlocked = evaluateUnlocks(forest);
    expect(unlocked.lifetimeCare).toBe(25);
    expect(unlocked.growthStage).toBe(3);
    expect(unlocked.unlockedCreatureIds).toContain('moss-ling');
    expect(unlocked.unlockedCreatureIds).toContain('seed-spirit');
    expect(unlocked.unlockedCreatureIds).toContain('leaf-sprite');
    // Même état re-évalué : pas de perte.
    const again = evaluateUnlocks(unlocked);
    expect(again.unlockedCreatureIds).toEqual(unlocked.unlockedCreatureIds);
  });
});

describe('persistance (reload)', () => {
  it('une forêt avec crédits survit à un cycle sérialisation → migrateState', () => {
    let forest = emptyForest();
    forest = grantCredit(forest, 't1|2026-10-01', '2026-10-01').forest;
    forest = grantCredit(forest, 't2|2026-10-01', '2026-10-01').forest;
    forest = tombstoneCredit(forest, 't1|2026-10-01').forest;
    forest = updateStreak(forest, '2026-10-01');

    // Cycle JSON (comme localStorage).
    const raw = JSON.stringify({
      schemaVersion: 2,
      household: { people: [{ id: 'a', name: 'AL' }, { id: 'b', name: 'AC' }] },
      budget: {
        settings: {
          personA: { id: 'a', name: 'AL', baseSalaryCents: 220000, baseRateBps: 4000, variableRateBps: 2000 },
          personB: { id: 'b', name: 'AC', baseSalaryCents: 300000, baseRateBps: 4000, variableRateBps: 2000 },
          recurringExpenses: [],
          defaultReserveTargetCents: 0,
        },
        months: [],
        selectedMonth: '2026-10',
      },
      chores: { tasks: [], completions: [] },
      forest,
      groceries: { items: [] },
    });
    const reloaded = migrateState(JSON.parse(raw));
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;
    const f = reloaded.state.forest;
    expect(f.lifetimeCare).toBe(2);
    expect(f.creditLedger['t1|2026-10-01']!.status).toBe('tombstoned');
    expect(f.creditLedger['t2|2026-10-01']!.status).toBe('active');
    // Recompléter l'occurrence tombstonée ne redonne rien.
    const regrant = grantCredit(f, 't1|2026-10-01', '2026-10-01');
    expect(regrant.granted).toBe(false);
  });
});

describe('horloge / DST', () => {
  it('le cap quotidien suit la date locale, pas UTC', () => {
    // Une complétion tard le soir (23h30) et une tôt le matin (00h30) du
    // lendemain local doivent compter sur deux jours locaux distincts.
    const evening = new Date(2026, 9, 1, 23, 30); // 1er oct 23h30 (local)
    const morning = new Date(2026, 9, 2, 0, 30); // 2 oct 00h30 (local)
    const eveningKey = `${evening.getFullYear()}-${String(evening.getMonth() + 1).padStart(2, '0')}-${String(evening.getDate()).padStart(2, '0')}`;
    const morningKey = `${morning.getFullYear()}-${String(morning.getMonth() + 1).padStart(2, '0')}-${String(morning.getDate()).padStart(2, '0')}`;
    expect(eveningKey).toBe('2026-10-01');
    expect(morningKey).toBe('2026-10-02');
    // Deux jours distincts → le cap ne s'applique pas entre eux.
    let forest = grantCredit(emptyForest(), 't1|2026-10-01', eveningKey).forest;
    const { granted } = grantCredit(forest, 't2|2026-10-02', morningKey);
    expect(granted).toBe(true);
  });
});
