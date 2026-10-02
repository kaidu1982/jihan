import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ADVENTURE_STAGES, COMPANIONS, DAILY_MISSIONS, WORLDS } from '../src/content.js';
import { MAX_RUN_RECEIPTS, PROGRESS_KEY_PREFIX, ProgressStore, achievementProgress, createProgressRunId, dailySeed, freshProgress, missionProgress, normalizeProgress, recordProgress, seoulDateKey, type StorageLike } from '../src/progression.js';
import { makeSteps } from '../functions/src/shared/rules.js';

const DAY = '2026-10-02';
const BASE = Date.parse('2026-10-02T01:00:00Z');
const run = (index: number) => `${BASE + index}-test-run-${index}`;
function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
const fixedClock = () => new Date(BASE);

test('five complete original worlds and sequential adventures have deterministic playable routes', () => {
  assert.deepEqual(WORLDS.map(world => world.id), ['meadow', 'sunset', 'forest', 'snow', 'space']);
  assert.deepEqual(ADVENTURE_STAGES.map(stage => stage.goal), [30, 50, 75, 100, 150]);
  assert.equal(new Set(ADVENTURE_STAGES.map(stage => stage.seed)).size, 5);
  for (const stage of ADVENTURE_STAGES) {
    assert.ok(WORLDS.some(world => world.id === stage.worldId));
    assert.deepEqual(makeSteps(stage.seed, stage.goal + 1), makeSteps(stage.seed, stage.goal + 1));
    assert.ok(stage.reward > 0);
  }
  assert.equal(COMPANIONS.length, 6);
  assert.equal(ACHIEVEMENTS.length, 8);
  assert.equal(DAILY_MISSIONS.length, 3);
});

test('calendar and daily seed switch at midnight in Korea, independent of UTC date', () => {
  assert.equal(seoulDateKey(new Date('2026-10-01T14:59:59.999Z')), '2026-10-01');
  assert.equal(seoulDateKey(new Date('2026-10-01T15:00:00.000Z')), '2026-10-02');
  assert.equal(seoulDateKey(new Date('2026-12-31T15:00:00.000Z')), '2027-01-01');
  assert.equal(dailySeed('2026-10-02'), dailySeed('2026-10-02'));
  assert.notEqual(dailySeed('2026-10-02'), dailySeed('2026-10-03'));
  assert.throws(() => dailySeed('2026-02-30'));
  assert.throws(() => seoulDateKey(NaN));
});

test('saving each step, pausing, ending and reloading count every successful stair only once', () => {
  const storage = memoryStorage();
  const store = new ProgressStore(storage, fixedClock);
  for (let score = 1; score <= 30; score++) {
    store.record('jihan', { runId: run(1), mode: 'practice', score });
    const repeated = store.record('jihan', { runId: run(1), mode: 'practice', score });
    assert.equal(repeated.earnedStars, 0);
  }
  assert.equal(store.get('jihan').totalStairs, 30);
  assert.equal(store.get('jihan').stars, 8, 'three stair stars and a one-time five-star welcome reward');
  assert.equal(store.get('jihan').runCount, 1);
  assert.equal(store.get('jihan').daily.runs, 1);
  const reloaded = new ProgressStore(storage, fixedClock);
  const end = reloaded.record('jihan', { runId: run(1), mode: 'practice', score: 30, completed: true });
  assert.equal(end.earnedStars, 0);
  assert.equal(end.progress.totalStairs, 30);
  assert.equal(end.progress.stars, 8);
  assert.equal(end.stored, true);
  assert.equal(reloaded.record('jihan', { runId: run(1), mode: 'practice', score: 31 }).accepted, false, 'a concluded run cannot grow');
});

test('partial runs combine toward star currency and callers cannot change a saved run identity', () => {
  let current = freshProgress(DAY);
  current = recordProgress(current, { runId: run(1), mode: 'challenge', score: 6 }, DAY).progress;
  const combined = recordProgress(current, { runId: run(2), mode: 'practice', score: 4 }, DAY);
  assert.equal(combined.progress.totalStairs, 10);
  assert.equal(combined.earnedStars, 1, 'six stairs plus four stairs earn one star');
  const lower = recordProgress(combined.progress, { runId: run(1), mode: 'challenge', score: 5 }, DAY);
  assert.equal(lower.accepted, false);
  const changed = recordProgress(combined.progress, { runId: run(1), mode: 'daily', score: 6 }, DAY);
  assert.equal(changed.accepted, false);
  const changedDate = recordProgress(combined.progress, { runId: run(1), mode: 'challenge', score: 6, dateKey: '2026-10-03' }, DAY);
  assert.equal(changedDate.accepted, false);
  assert.deepEqual(combined.progress, changedDate.progress);
});

test('adventures unlock sequentially and reward completion once, including after reload', () => {
  const storage = memoryStorage();
  const store = new ProgressStore(storage, fixedClock);
  const [first, second] = ADVENTURE_STAGES;
  assert.equal(store.isStageUnlocked('jihan', first.id), true);
  assert.equal(store.isStageUnlocked('jihan', second.id), false);
  assert.equal(store.record('jihan', { runId: run(2), mode: 'adventure', stageId: second.id, score: second.goal, completed: true }).accepted, false);
  const partial = store.record('jihan', { runId: run(1), mode: 'adventure', stageId: first.id, score: first.goal });
  assert.deepEqual(partial.progress.completedStages, []);
  const clear = store.record('jihan', { runId: run(1), mode: 'adventure', stageId: first.id, score: first.goal, completed: true, mistakes: 2 });
  assert.deepEqual(clear.progress.completedStages, [first.id]);
  assert.equal(clear.stageUnlocked, second.id);
  assert.equal(clear.earnedStars, first.reward + ACHIEVEMENTS.find(item => item.id === 'adventure-first')!.reward);
  assert.equal(store.isStageUnlocked('jihan', second.id), true);
  const reloaded = new ProgressStore(storage, fixedClock);
  const repeat = reloaded.record('jihan', { runId: run(3), mode: 'adventure', stageId: first.id, score: first.goal, completed: true });
  assert.equal(repeat.progress.completedStages.length, 1);
  assert.deepEqual(repeat.newAchievements, []);
  assert.equal(repeat.earnedStars, 3 + 5, 'only the new stairs and today’s cumulative 60-stair mission are rewarded');
  for (let i = 1; i < ADVENTURE_STAGES.length; i++) {
    const stage = ADVENTURE_STAGES[i];
    reloaded.record('jihan', { runId: run(10 + i), mode: 'adventure', stageId: stage.id, score: stage.goal, completed: true });
  }
  assert.equal(reloaded.get('jihan').completedStages.length, 5);
  assert.ok(reloaded.get('jihan').achievements.includes('adventure-all'));
});

test('three adventure mistakes cannot be hidden by a later snapshot or count as a clear', () => {
  const stage = ADVENTURE_STAGES[0];
  let current = recordProgress(freshProgress(DAY), { runId: run(1), mode: 'adventure', stageId: stage.id, score: stage.goal, mistakes: 3 }, DAY).progress;
  const result = recordProgress(current, { runId: run(1), mode: 'adventure', stageId: stage.id, score: stage.goal, mistakes: 0, completed: true }, DAY);
  assert.deepEqual(result.progress.completedStages, []);
  assert.equal(result.progress.receipts[0].mistakes, 3);
  current = recordProgress(current, { runId: run(2), mode: 'adventure', stageId: stage.id, score: stage.goal - 1, completed: true }, DAY).progress;
  assert.deepEqual(current.completedStages, []);
});

test('daily best is isolated from other modes, with three unique automatic daily mission rewards', () => {
  const store = new ProgressStore(memoryStorage(), fixedClock);
  store.record('jihan', { runId: run(1), mode: 'practice', score: 100 });
  assert.equal(store.get('jihan').daily.best, 0);
  const daily = store.record('jihan', { runId: run(2), mode: 'daily', score: 50 });
  assert.equal(daily.progress.daily.best, 50);
  assert.ok(daily.completedMissions.includes('daily-course'));
  const third = store.record('jihan', { runId: run(3), mode: 'challenge', score: 10 });
  assert.ok(third.completedMissions.includes('daily-runs'));
  assert.equal(third.progress.daily.runs, 3);
  assert.equal(third.progress.daily.missionIds.length, 3);
  const repeated = store.record('jihan', { runId: run(3), mode: 'challenge', score: 10, completed: true });
  assert.equal(repeated.earnedStars, 0);
  assert.equal(missionProgress(repeated.progress, 'daily-runs'), 3);
  assert.equal(achievementProgress(repeated.progress, 'high-100'), 100);
});

test('a run crossing midnight cannot claim the new day’s missions or best, but still earns permanent stairs', () => {
  let now = new Date('2026-10-02T14:59:00Z');
  const store = new ProgressStore(memoryStorage(), () => now);
  store.record('jihan', { runId: run(1), mode: 'daily', score: 60, dateKey: '2026-10-02' });
  now = new Date('2026-10-02T15:00:00Z');
  assert.deepEqual(store.get('jihan').daily, { dateKey: '2026-10-03', stairs: 0, runs: 0, best: 0, missionIds: [] });
  const late = store.record('jihan', { runId: run(1), mode: 'daily', score: 150, dateKey: '2026-10-02', completed: true });
  assert.equal(late.progress.totalStairs, 150);
  assert.equal(late.progress.daily.stairs, 0);
  assert.equal(late.progress.daily.best, 0);
  assert.equal(late.progress.dailyBestEver, 150, 'the permanent medal still recognizes a completed daily run');
  assert.deepEqual(late.completedMissions, []);
  const today = store.record('jihan', { runId: run(2), mode: 'daily', score: 60, dateKey: '2026-10-03' });
  assert.deepEqual(today.completedMissions.sort(), ['daily-course', 'daily-stairs']);
  assert.equal(today.progress.daily.best, 60);
});

test('companions use earned stars, stay purely cosmetic, and a second purchase never charges again', () => {
  const storage = memoryStorage();
  const store = new ProgressStore(storage, fixedClock);
  const poor = store.purchase('jihan', 'satellite');
  assert.equal(poor.ok, false);
  assert.deepEqual(poor.progress.ownedCompanions, ['cloud']);
  assert.equal(store.equip('jihan', 'satellite').ok, false);
  store.record('jihan', { runId: run(1), mode: 'practice', score: 100 });
  const before = store.get('jihan');
  const bought = store.purchase('jihan', 'sprout');
  assert.equal(bought.ok, true);
  assert.equal(bought.stored, true);
  assert.equal(bought.progress.stars, before.stars - 20);
  assert.equal(bought.progress.equippedCompanion, 'sprout');
  const repeated = store.purchase('jihan', 'sprout');
  assert.equal(repeated.progress.stars, bought.progress.stars);
  assert.equal(repeated.progress.totalStairs, before.totalStairs);
  assert.equal(repeated.progress.bestRun, before.bestRun);
  assert.equal(store.equip('jihan', 'cloud').progress.equippedCompanion, 'cloud');
  assert.ok(new ProgressStore(storage, fixedClock).get('jihan').ownedCompanions.includes('sprout'));
});

test('local profiles never share progress, and deletion removes only the requested profile record', () => {
  const storage = memoryStorage();
  const store = new ProgressStore(storage, fixedClock);
  storage.setItem('jihan-stairs-v1', 'existing profiles and scores stay untouched');
  store.record('jihan', { runId: run(1), mode: 'practice', score: 100 });
  store.record('friend', { runId: run(2), mode: 'daily', score: 30 });
  assert.equal(store.get('friend').totalStairs, 30);
  assert.equal(store.get('jihan').totalStairs, 100);
  assert.equal(store.deleteProfileProgress('jihan'), true);
  assert.equal(storage.getItem(`${PROGRESS_KEY_PREFIX}jihan`), null);
  assert.equal(store.get('jihan').totalStairs, 0);
  assert.equal(store.get('friend').totalStairs, 30);
  assert.equal(storage.getItem('jihan-stairs-v1'), 'existing profiles and scores stay untouched');
});

test('bounded receipts reject evicted run replays even after a new browser session', () => {
  const storage = memoryStorage();
  const store = new ProgressStore(storage, fixedClock);
  for (let i = 1; i <= MAX_RUN_RECEIPTS + 8; i++) store.record('jihan', { runId: run(i), mode: 'practice', score: 1, completed: true });
  const before = store.get('jihan');
  assert.equal(before.receipts.length, MAX_RUN_RECEIPTS);
  assert.ok(before.prunedBefore >= BASE + 8);
  const reloaded = new ProgressStore(storage, fixedClock);
  const replay = reloaded.record('jihan', { runId: run(1), mode: 'practice', score: 1, completed: true });
  assert.equal(replay.accepted, false);
  assert.equal(replay.progress.totalStairs, before.totalStairs);
  assert.equal(replay.earnedStars, 0);
  const recent = reloaded.record('jihan', { runId: run(MAX_RUN_RECEIPTS + 8), mode: 'practice', score: 1, completed: true });
  assert.equal(recent.accepted, true);
  assert.equal(recent.earnedStars, 0);
});

test('corrupt, older partial and unsupported schemas normalize safely without granting unknown rewards', () => {
  const normalized = normalizeProgress({ totalStairs: 25, stars: -20, bestRun: Infinity, bestCombo: 900, ownedCompanions: ['space-ship', 'sprout', 'sprout'], equippedCompanion: 'satellite', achievements: ['imaginary', 'first-step', 'first-step'], completedStages: [ADVENTURE_STAGES[3].id], daily: { dateKey: '2026-10-01', best: 99, missionIds: ['daily-course'] }, receipts: [{ runId: 'bad', score: 999 }] }, DAY);
  assert.equal(normalized.totalStairs, 25);
  assert.equal(normalized.stars, 0);
  assert.equal(normalized.bestRun, 0);
  assert.equal(normalized.bestCombo, 0);
  assert.deepEqual(normalized.ownedCompanions, ['cloud', 'sprout']);
  assert.equal(normalized.equippedCompanion, 'cloud');
  assert.deepEqual(normalized.achievements, ['first-step']);
  assert.deepEqual(normalized.completedStages, []);
  assert.deepEqual(normalized.receipts, []);
  assert.deepEqual(normalizeProgress({ version: 200, stars: 500 }, DAY), freshProgress(DAY));
  const storage = memoryStorage();
  storage.setItem(`${PROGRESS_KEY_PREFIX}jihan`, '{unreadable');
  assert.deepEqual(new ProgressStore(storage, fixedClock).get('jihan'), freshProgress(DAY));
});

test('storage failure is reported and retrying the same run after recovery cannot grant twice', () => {
  const storage = memoryStorage();
  let fail = true;
  const broken: StorageLike = { getItem: storage.getItem, removeItem: () => { throw Error('unavailable'); }, setItem: (key, value) => { if (fail) throw Error('full'); storage.setItem(key, value); } };
  const store = new ProgressStore(broken, fixedClock);
  const initial = store.record('jihan', { runId: run(1), mode: 'practice', score: 30 });
  assert.equal(initial.accepted, true);
  assert.equal(initial.stored, false);
  assert.equal(store.get('jihan').stars, 8);
  fail = false;
  const retry = store.record('jihan', { runId: run(1), mode: 'practice', score: 30 });
  assert.equal(retry.stored, true);
  assert.equal(retry.earnedStars, 0);
  assert.equal(new ProgressStore(storage, fixedClock).get('jihan').stars, 8);
  assert.equal(store.deleteProfileProgress('jihan'), false);
  assert.equal(store.get('jihan').totalStairs, 30);
});

test('public snapshots are defensive copies and malformed runtime scores cannot corrupt persisted state', () => {
  const store = new ProgressStore(memoryStorage(), fixedClock);
  const retrieved = store.get('jihan');
  retrieved.stars = 999;
  retrieved.ownedCompanions.push('satellite');
  retrieved.daily.missionIds.push('daily-course');
  assert.equal(store.get('jihan').stars, 0);
  assert.deepEqual(store.get('jihan').ownedCompanions, ['cloud']);
  for (const score of [-1, NaN, Infinity, 1.5, 5001]) assert.equal(store.record('jihan', { runId: run(1), mode: 'practice', score }).accepted, false);
  assert.equal(store.record('jihan', { runId: 'unbounded-uuid', mode: 'practice', score: 10 }).accepted, false);
  const output = store.record('jihan', { runId: run(1), mode: 'practice', score: 10 });
  output.progress.stars = 999;
  assert.equal(store.get('jihan').stars, 6);
});

test('run identifiers remain unique during rapid restart even if the device clock repeats', () => {
  const first = createProgressRunId(BASE);
  const second = createProgressRunId(BASE);
  assert.notEqual(first, second);
  const result = recordProgress(freshProgress(DAY), { runId: first, mode: 'practice', score: 1 }, DAY);
  assert.equal(result.accepted, true);
  assert.equal(recordProgress(result.progress, { runId: second, mode: 'practice', score: 1 }, DAY).progress.totalStairs, 2);
});
