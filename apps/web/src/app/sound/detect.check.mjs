/**
 * Test unitaire de la détection et de l'anti-rafale (logique pure).
 * Usage : node apps/web/src/app/sound/detect.check.mjs   (Node ≥ 22.6, types effacés)
 * Les états sont minimaux (seules les branches lues par la détection) ; la
 * QA Chromium (scripts/qa-sons.mjs) rejoue les vraies actions du store.
 */
import assert from 'node:assert/strict';
import { detectSoundEvents, isWholesaleChange, planSounds } from './detect.ts';
import { createSoundGate } from './gate.ts';

const forest = (o = {}) => ({
  vitality: 40, lifetimeCare: 4, currentStreak: 2, longestStreak: 3, lastMeaningfulActionDate: null,
  growthStage: 1, unlockedCreatureIds: ['moss'], unlockedEnvironmentIds: [], lastRareEvent: null,
  paused: false, pausedAt: null, pauses: [], creditLedger: {}, lastProcessedDay: null, ...o,
});
const base = () => ({
  schemaVersion: 2,
  household: { people: [{ id: 'a', name: 'AL' }, { id: 'b', name: 'AC' }] },
  budget: { settings: {}, months: [], selectedMonth: '2026-10' },
  chores: {
    tasks: [
      { id: 't1', title: 'Arroser', assignee: 'a', recurrence: 'daily', createdAt: '2026-10-01' },
      { id: 't2', title: 'Salle de bain', assignee: 'b', recurrence: 'weekly', weeklyDay: 6, createdAt: '2026-10-01', effort: 3 },
    ],
    completions: [],
    skips: [],
  },
  forest: forest(),
  groceries: { items: [] },
});
const fact = (id, taskId, assignee, doneBy) => ({
  id, taskId, taskTitle: taskId, assignee, dueDate: '2026-10-04', completedAt: '2026-10-04T10:00:00.000Z',
  ...(doneBy ? { doneBy } : {}),
});
/** Un geste : ne remplace que les branches touchées (comme le store). */
const step = (s, patch) => ({ ...s, ...patch });
const withChores = (s, chores) => step(s, { chores: { ...s.chores, ...chores } });
const cues = (events) => events.map((e) => e.who ? `${e.cue}:${e.who}` : e.cue);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`OK   ${name}`); };

const s0 = base();

test('premier rendu / même état : rien', () => {
  assert.deepEqual(detectSoundEvents(null, s0), []);
  assert.deepEqual(detectSoundEvents(s0, s0), []);
});

test('tâche faite : carillon teinté par qui (assignee, doneBy, ensemble)', () => {
  const s1 = withChores(s0, { completions: [fact('c1', 't1', 'a')] });
  assert.deepEqual(cues(detectSoundEvents(s0, s1)), ['done:a']);
  const s2 = withChores(s0, { completions: [fact('c1', 't1', 'a', 'b')] });
  assert.deepEqual(cues(detectSoundEvents(s0, s2)), ['done:b']);
  const s3 = withChores(s0, { completions: [fact('c1', 't1', 'both')] });
  assert.deepEqual(cues(detectSoundEvents(s0, s3)), ['done:both']);
  const s4 = withChores(s0, { completions: [fact('c1', 't1', 'unassigned')] });
  assert.deepEqual(cues(detectSoundEvents(s0, s4)), ['done:none']);
  const s5 = withChores(s0, { completions: [fact('c1', 't1', 'a'), fact('c2', 't1', 'b')] });
  assert.deepEqual(cues(detectSoundEvents(s0, s5)), ['done:both'], 'deux faits, deux personnes');
});

test('corvée (effort 3) : version ample', () => {
  const s1 = withChores(s0, { completions: [fact('c1', 't2', 'b')] });
  assert.deepEqual(cues(detectSoundEvents(s0, s1)), ['chore:b']);
});

test('annuler un fait, passer, reprendre', () => {
  const done = withChores(s0, { completions: [fact('c1', 't1', 'a')] });
  assert.deepEqual(cues(detectSoundEvents(done, withChores(done, { completions: [] }))), ['undo']);
  const skipped = withChores(s0, { skips: [{ id: 'k1', taskId: 't1', dueDate: '2026-10-04', at: 'x' }] });
  assert.deepEqual(cues(detectSoundEvents(s0, skipped)), ['skip']);
  assert.deepEqual(cues(detectSoundEvents(skipped, withChores(skipped, { skips: [] }))), ['undo']);
});

test('créature, croissance, gardien enchaînés après la lumière', () => {
  const s1 = step(withChores(s0, { completions: [fact('c1', 't1', 'a')] }), {
    forest: forest({ lifetimeCare: 5, growthStage: 2, unlockedCreatureIds: ['moss', 'fox'], currentStreak: 10, lastRareEvent: 'guardian' }),
  });
  assert.deepEqual(cues(detectSoundEvents(s0, s1)), ['done:a', 'creature', 'growth', 'guardian']);
  const plan = planSounds(detectSoundEvents(s0, s1));
  assert.deepEqual(plan.map((p) => p.delayMs), [0, 360, 800, 1320]);
  const reduced = planSounds(detectSoundEvents(s0, s1), { reduced: true });
  assert.deepEqual(reduced.map((p) => p.cue), ['guardian'], 'mouvement réduit : un seul son');
});

test('gardien : redéclenché par une nouvelle série, pas par 11, 12…', () => {
  const g = step(s0, { forest: forest({ currentStreak: 10, lastRareEvent: 'guardian' }) });
  const g11 = step(g, { forest: forest({ currentStreak: 11, lastRareEvent: 'guardian' }) });
  assert.deepEqual(cues(detectSoundEvents(g, g11)), []);
  const broken = step(g, { forest: forest({ currentStreak: 9, lastRareEvent: 'guardian' }) });
  const again = step(broken, { forest: forest({ currentStreak: 10, lastRareEvent: 'guardian' }) });
  assert.deepEqual(cues(detectSoundEvents(broken, again)), ['guardian']);
});

test('cercle enregistré (nouveau ou ré-enregistré) et lanterne', () => {
  const circle = { id: 'r1', weekStart: '2026-09-28', heldAt: 'h1', gratitude: [], burdens: [], intentions: [] };
  const c1 = step(s0, { rituals: { circles: [circle] } });
  assert.deepEqual(cues(detectSoundEvents(s0, c1)), ['circle']);
  const c2 = step(c1, { rituals: { circles: [{ ...circle, heldAt: 'h2' }] } });
  assert.deepEqual(cues(detectSoundEvents(c1, c2)), ['circle']);
  const f1 = step(s0, { focus: { sessions: [{ id: 'f1', startedAt: 'x', minutes: 10, who: 'a' }] } });
  assert.deepEqual(cues(detectSoundEvents(s0, f1)), ['lantern']);
});

test('remplacement en bloc (import, remise à zéro) : silence', () => {
  const imported = JSON.parse(JSON.stringify({ ...s0, chores: { ...s0.chores, completions: [fact('c1', 't1', 'a')] } }));
  assert.equal(isWholesaleChange(s0, imported), true);
  assert.deepEqual(detectSoundEvents(s0, imported), []);
  const many = withChores(s0, { completions: ['1', '2', '3', '4'].map((i) => fact(`c${i}`, 't1', 'a')) });
  assert.deepEqual(detectSoundEvents(s0, many), [], 'quatre faits d’un coup');
  const grown = step(s0, { forest: forest({ growthStage: 3 }) });
  assert.deepEqual(detectSoundEvents(s0, grown), [], 'deux stades d’un coup');
  const shrunk = step(s0, { forest: forest({ lifetimeCare: 0, unlockedCreatureIds: [] }) });
  assert.deepEqual(detectSoundEvents(s0, shrunk), [], 'la croissance ne recule jamais');
  // Renommer une personne (foyer + budget) sans toucher aux tâches : pas un bloc.
  assert.equal(isWholesaleChange(s0, step(s0, { household: { people: [] }, budget: { ...s0.budget } })), false);
});

test('anti-rafale : ≥ 120 ms, regroupement, pas de retard accumulé', () => {
  const gate = createSoundGate();
  const a = gate.admit([{ cue: 'done', who: 'a', delayMs: 0 }], 1000);
  assert.deepEqual(a.map((p) => p.delayMs), [0]);
  assert.deepEqual(gate.admit([{ cue: 'done', who: 'a', delayMs: 0 }], 1050), [], 'même son regroupé');
  const u = gate.admit([{ cue: 'undo', delayMs: 0 }], 1060);
  assert.equal(u[0].delayMs, 60, 'décalé à 120 ms du précédent');
  const chain = gate.admit([{ cue: 'skip', delayMs: 0 }, { cue: 'creature', delayMs: 40 }], 2000);
  assert.ok(chain[1].delayMs - chain[0].delayMs >= 120);
  // Rafale de 20 gestes en 1 s : peu de sons, aucun très en retard.
  const burst = createSoundGate();
  let played = [];
  for (let i = 0; i < 20; i++) {
    const now = 5000 + i * 50;
    played = played.concat(burst.admit([{ cue: i % 2 ? 'undo' : 'done', delayMs: 0 }], now).map((p) => ({ ...p, now })));
  }
  assert.ok(played.length <= 6, `rafale contenue (${played.length})`);
  assert.ok(played.every((p) => p.delayMs <= 1600));
  const starts = played.map((p) => p.now + p.delayMs).sort((x, y) => x - y);
  starts.slice(1).forEach((t, i) => assert.ok(t - starts[i] >= 120, 'écart minimal'));
  // Mouvement réduit : le même son n'est pas rejoué avant 1,5 s.
  const calm = createSoundGate();
  assert.equal(calm.admit([{ cue: 'done', delayMs: 0 }], 0, { reduced: true }).length, 1);
  assert.equal(calm.admit([{ cue: 'done', delayMs: 0 }], 900, { reduced: true }).length, 0);
  assert.equal(calm.admit([{ cue: 'done', delayMs: 0 }], 1700, { reduced: true }).length, 1);
});

console.log(`\n${passed} tests de détection réussis.`);
