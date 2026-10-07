import { describe, expect, it } from 'vitest';
import { emptyAppState, validateAppState } from '../home/appState.js';
import { emptyForest, evaluateUnlocks } from '../home/forest.js';
import type { ForestState } from '../home/types.js';
import { completionFact } from './facts.js';
import {
  applyMilestones,
  emptyMilestones,
  mergeMilestones,
  milestonesAtLeast,
  milestonesOf,
  raisesMilestones,
  validateMilestones,
  type ForestMilestones,
} from './milestones.js';
import { replayForest } from './replay.js';

const m = (over: Partial<ForestMilestones>): ForestMilestones => ({ ...emptyMilestones(), ...over });

describe('jalons de la forêt', () => {
  const x = m({ growthStage: 3, lifetimeCare: 30, unlockedCreatureIds: ['seed-spirit', 'moss-ling'], rareEvents: ['guardian'] });
  const y = m({ growthStage: 2, lifetimeCare: 12, longestStreak: 9, unlockedEnvironmentIds: ['young-tree'] });
  const z = m({ lifetimeCare: 40, unlockedCreatureIds: ['leaf-sprite'] });

  it('fusion : maximum champ par champ, commutative, associative, idempotente', () => {
    expect(mergeMilestones(x, y)).toEqual({
      growthStage: 3,
      lifetimeCare: 30,
      longestStreak: 9,
      unlockedCreatureIds: ['moss-ling', 'seed-spirit'],
      unlockedEnvironmentIds: ['young-tree'],
      rareEvents: ['guardian'],
    });
    expect(mergeMilestones(x, y)).toEqual(mergeMilestones(y, x));
    expect(mergeMilestones(mergeMilestones(x, y), z)).toEqual(mergeMilestones(x, mergeMilestones(y, z)));
    expect(mergeMilestones(x, x)).toEqual(mergeMilestones(x, emptyMilestones()));
  });

  it('jamais en baisse : la règle refuse toute valeur plus basse ou un déblocage perdu', () => {
    const merged = mergeMilestones(x, y);
    expect(milestonesAtLeast(merged, x)).toBe(true);
    expect(milestonesAtLeast(merged, y)).toBe(true);
    expect(milestonesAtLeast(y, x)).toBe(false);
    expect(milestonesAtLeast(m({ ...merged, unlockedCreatureIds: ['moss-ling'] }), merged)).toBe(false);
    expect(raisesMilestones(merged, x)).toBe(false);
    expect(raisesMilestones(x, z)).toBe(true);
  });

  it('affichage = max(rejeu, jalons) : le stade ne redescend pas, le registre reste cohérent', () => {
    // AC a coché hors ligne et vu le stade 2 ; la pause d’AL, arrivée ensuite, retire ces crédits.
    let seen: ForestState = emptyForest();
    const facts = [];
    for (let i = 0; i < 10; i += 1) {
      const day = `2026-10-${String(i + 1).padStart(2, '0')}`;
      facts.push(completionFact({ id: `c${i}`, taskId: 't', taskTitle: 't', assignee: 'b', dueDate: day, completedAt: `${day}T08:00:00.000Z` }, undefined));
    }
    seen = replayForest(null, { completions: facts }, '2026-10-10');
    expect(seen.growthStage).toBe(2);
    const replayed = replayForest(null, {
      completions: facts,
      forestEvents: [{ id: 'p', kind: 'pause', localDay: '2026-10-05', at: '2026-10-05T06:00:00.000Z' }],
    }, '2026-10-10');
    expect(replayed.growthStage).toBe(1);
    const shown = applyMilestones(replayed, milestonesOf(seen));
    expect(shown.growthStage).toBe(2);
    expect(shown.unlockedCreatureIds).toEqual(expect.arrayContaining(['moss-ling', 'seed-spirit']));
    expect(shown.lifetimeCare).toBe(replayed.lifetimeCare);
    expect(shown.vitality).toBe(replayed.vitality);
    const state = { ...emptyAppState(), forest: shown };
    expect(validateAppState(JSON.parse(JSON.stringify(state))).ok).toBe(true);
  });

  it('rien à relever → même référence ; série et événement rare gardés', () => {
    const forest = evaluateUnlocks({ ...emptyForest(), lifetimeCare: 0 });
    expect(applyMilestones(forest, milestonesOf(forest))).toBe(forest);
    const raised = applyMilestones(forest, m({ longestStreak: 12, rareEvents: ['guardian'] }));
    expect(raised.longestStreak).toBe(12);
    expect(raised.lastRareEvent).toBe('guardian');
  });

  it('validation d’un document de jalons', () => {
    expect(validateMilestones({ ...x, extra: 1 })).toEqual({ ok: true, state: mergeMilestones(x, emptyMilestones()) });
    expect(validateMilestones({ ...x, growthStage: 0 }).ok).toBe(false);
    expect(validateMilestones({ ...x, rareEvents: [1] }).ok).toBe(false);
    expect(validateMilestones(null).ok).toBe(false);
  });
});
