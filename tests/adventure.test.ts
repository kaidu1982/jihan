import assert from 'node:assert/strict';
import test from 'node:test';
import { ACHIEVEMENTS, ADVENTURE_STAGES, COMPANIONS, DAILY_MISSIONS, type GameMode } from '../src/content';
import { StairSession } from '../src/game-session';
import { ProgressStore, createProgressRunId, dailySeed, seoulDateKey, type RunSnapshot, type StorageLike } from '../src/progression';
import { makeSteps, validateRun, type Action } from '../functions/src/shared/rules';

const NOW = new Date('2026-10-03T03:00:00.000Z');
const DATE = seoulDateKey(NOW);
function storage(): StorageLike {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
function metadata(mode: GameMode, stageId?: string): Pick<RunSnapshot, 'runId' | 'mode' | 'stageId' | 'dateKey'> {
  return { runId: createProgressRunId(NOW), mode, stageId, dateKey: DATE };
}
function save(store: ProgressStore, session: StairSession, run: ReturnType<typeof metadata>, completed = false) {
  const progress = session.getProgress();
  return store.record('integration-player', { ...run, score: progress.score, maxCombo: progress.maxCombo, mistakes: progress.mistakes, completed });
}
/** Follow the shared deterministic route as real timed inputs, without changing session state. */
function climb(store: ProgressStore, session: StairSession, run: ReturnType<typeof metadata>, seed: number, count: number): number {
  const route = makeSteps(seed);
  let expectedTime = session.activeTime;
  for (let step = 0; step < count; step++) {
    const delta = 80 + (step % 6) * 17;
    expectedTime += delta;
    session.advance(delta);
    const action: Action = route[session.score + 1].direction === session.facing ? 'climb' : 'turn';
    assert.equal(session.act(action), 'step');
    const recorded = save(store, session, run);
    assert.equal(recorded.accepted, true);
    assert.equal(recorded.stored, true);
    if (step % 13 === 0) {
      const before = store.get('integration-player');
      // Pausing/opening a dialog saves the same snapshot; no game time advances while paused.
      const paused = save(store, session, run);
      assert.equal(paused.earnedStars, 0);
      assert.deepEqual(paused.progress, before);
      assert.equal(session.activeTime, expectedTime);
    }
  }
  assert.equal(session.activeTime, expectedTime);
  assert.equal(session.getResult().inputs.at(-1)?.at, Math.round(expectedTime));
  return expectedTime;
}

test('all five real adventure sessions complete the catalog journey with persistent unlocks and spendable rewards', () => {
  const disk = storage();
  let store = new ProgressStore(disk, () => NOW);
  let collected = 0;
  let stairs = 0;
  const completedRuns: { session: StairSession; run: ReturnType<typeof metadata> }[] = [];
  for (const [index, stage] of ADVENTURE_STAGES.entries()) {
    assert.equal(store.isStageUnlocked('integration-player', stage.id), true);
    const next = ADVENTURE_STAGES[index + 1];
    if (next) assert.equal(store.isStageUnlocked('integration-player', next.id), false);
    const run = metadata('adventure', stage.id);
    const session = new StairSession(stage.seed, 'practice', {
      world: stage.worldId, goal: stage.goal, mistakeLimit: 3,
      companion: store.get('integration-player').equippedCompanion,
      starOffset: store.get('integration-player').totalStairs % 10,
    });
    assert.equal(session.goal, stage.goal);
    assert.equal(session.getProgress().worldId, stage.worldId);
    assert.equal(session.getProgress().mistakesLeft, 3);
    climb(store, session, run, stage.seed, stage.goal);
    assert.equal(session.reason, 'finished');
    assert.equal(session.getResult().score, stage.goal);
    assert.equal(session.getResult().inputs.length, stage.goal);
    assert.equal(session.getProgress().worldId, stage.worldId, 'the adventure keeps its selected world throughout');
    assert.equal(store.get('integration-player').completedStages.includes(stage.id), false, 'step saves do not claim the finish bonus');
    const clear = save(store, session, run, true);
    assert.ok(clear.progress.completedStages.includes(stage.id));
    assert.ok(clear.earnedStars >= stage.reward);
    assert.equal(clear.stageUnlocked, next?.id);
    stairs += stage.goal;
    collected += session.getResult().collected;
    assert.equal(clear.progress.totalStairs, stairs);
    assert.equal(clear.progress.runCount, index + 1);
    const endAgain = save(store, session, run, true);
    assert.equal(endAgain.earnedStars, 0);
    assert.deepEqual(endAgain.progress, clear.progress);
    session.advance(1000);
    assert.equal(session.act('climb'), 'blocked');
    assert.equal(session.score, stage.goal);
    completedRuns.push({ session, run });
    store = new ProgressStore(disk, () => NOW);
    assert.ok(store.get('integration-player').completedStages.includes(stage.id), 'stage unlock survives a browser reload');
    if (next) assert.equal(store.isStageUnlocked('integration-player', next.id), true);
  }
  const beforeReplay = store.get('integration-player');
  assert.equal(stairs, 405);
  assert.equal(beforeReplay.totalStairs, 405);
  assert.equal(beforeReplay.bestRun, 150);
  assert.equal(beforeReplay.bestCombo, 150);
  assert.equal(beforeReplay.daily.best, 0, 'adventure results cannot become today’s course record');
  assert.deepEqual(beforeReplay.completedStages, ADVENTURE_STAGES.map(stage => stage.id));
  const stairRewards = Math.floor(stairs / 10);
  const stageRewards = ADVENTURE_STAGES.reduce((sum, stage) => sum + stage.reward, 0);
  const badgeRewards = ACHIEVEMENTS.filter(badge => beforeReplay.achievements.includes(badge.id)).reduce((sum, badge) => sum + badge.reward, 0);
  const missionRewards = DAILY_MISSIONS.filter(mission => beforeReplay.daily.missionIds.includes(mission.id)).reduce((sum, mission) => sum + mission.reward, 0);
  assert.equal(collected, stairRewards, 'rendered star collectibles include the previous run remainder');
  assert.equal(beforeReplay.stars, stairRewards + stageRewards + badgeRewards + missionRewards);
  assert.equal(beforeReplay.stars, 295);
  for (const { session, run } of completedRuns) assert.equal(save(store, session, run, true).earnedStars, 0);
  assert.deepEqual(store.get('integration-player'), beforeReplay, 'replaying every final save leaves all statistics and rewards intact');
  const companion = COMPANIONS.find(friend => friend.id === 'satellite')!;
  const purchased = store.purchase('integration-player', companion.id);
  assert.equal(purchased.ok, true, 'the full journey earns enough stars for the most expensive friend');
  assert.equal(purchased.stored, true);
  assert.equal(purchased.progress.equippedCompanion, companion.id);
  assert.equal(purchased.progress.stars, beforeReplay.stars - companion.cost);
  assert.equal(purchased.progress.totalStairs, beforeReplay.totalStairs);
  assert.equal(store.purchase('integration-player', companion.id).progress.stars, purchased.progress.stars);
  assert.equal(new ProgressStore(disk, () => NOW).get('integration-player').equippedCompanion, companion.id);
});

test('a real 150-step daily session shares its dated route, stops at the goal and keeps its record separate', () => {
  const disk = storage();
  const store = new ProgressStore(disk, () => NOW);
  const seed = dailySeed(DATE);
  const daily = new StairSession(seed, 'challenge', { goal: 150 });
  const anotherPlayer = new StairSession(dailySeed(seoulDateKey(new Date('2026-10-03T14:59:59Z'))), 'challenge', { goal: 150 });
  assert.deepEqual(daily.steps, anotherPlayer.steps, 'all players get the same stairs through the Korean calendar day');
  assert.notDeepEqual(daily.steps, new StairSession(dailySeed('2026-10-04'), 'challenge', { goal: 150 }).steps);
  const dailyRun = metadata('daily');
  const elapsed = climb(store, daily, dailyRun, seed, 150);
  assert.equal(daily.reason, 'finished');
  assert.equal(daily.getResult().inputs.at(-1)?.at, elapsed);
  assert.equal(validateRun(seed, daily.getResult().inputs, elapsed), 150, 'daily challenge retains server-compatible timing and turning rules');
  const finish = save(store, daily, dailyRun, true);
  assert.equal(finish.progress.daily.best, 150);
  assert.equal(finish.progress.dailyBestEver, 150);
  assert.ok(finish.progress.achievements.includes('daily-150'));
  daily.advance(60_000);
  assert.equal(daily.act('climb'), 'blocked');
  assert.equal(daily.score, 150);
  const practiceSeed = 65198;
  const practice = new StairSession(practiceSeed, 'practice', { starOffset: store.get('integration-player').totalStairs % 10 });
  const practiceRun = metadata('practice');
  climb(store, practice, practiceRun, practiceSeed, 170);
  save(store, practice, practiceRun, true);
  const challengeSeed = 85911;
  const challenge = new StairSession(challengeSeed, 'challenge', { goal: 180, starOffset: store.get('integration-player').totalStairs % 10 });
  const challengeRun = metadata('challenge');
  climb(store, challenge, challengeRun, challengeSeed, 180);
  save(store, challenge, challengeRun, true);
  assert.equal(store.get('integration-player').bestRun, 180);
  assert.equal(store.get('integration-player').daily.best, 150);
  assert.equal(store.get('integration-player').totalStairs, 500);
  assert.equal(store.get('integration-player').daily.missionIds.length, 3);
  const best = store.get('integration-player');
  assert.equal(save(store, daily, dailyRun, true).earnedStars, 0);
  assert.deepEqual(store.get('integration-player'), best);
  assert.equal(new ProgressStore(disk, () => NOW).get('integration-player').daily.best, 150);
});

test('three actual adventure mistakes end the run without an unlock while keeping successful stairs and stars', () => {
  const disk = storage();
  const store = new ProgressStore(disk, () => NOW);
  const stage = ADVENTURE_STAGES[0];
  const session = new StairSession(stage.seed, 'practice', { world: stage.worldId, goal: stage.goal, mistakeLimit: 3 });
  const run = metadata('adventure', stage.id);
  climb(store, session, run, stage.seed, 12);
  const savedBeforeMistakes = store.get('integration-player');
  for (let mistake = 1; mistake <= 3; mistake++) {
    const next = session.getProgress().nextAction;
    session.advance(150);
    assert.equal(session.act(next === 'climb' ? 'turn' : 'climb'), 'mistake');
    const checkpoint = save(store, session, run);
    assert.equal(checkpoint.earnedStars, 0);
    assert.equal(checkpoint.progress.totalStairs, 12);
    assert.equal(session.getProgress().mistakesLeft, 3 - mistake);
    assert.equal(session.reason, mistake < 3 ? null : 'wrong');
  }
  const result = session.getResult();
  assert.equal(result.mistakes, 3);
  assert.equal(result.maxCombo, 12);
  assert.equal(result.inputs.length, 12, 'wrong inputs cannot become successful stairs');
  const finished = save(store, session, run, true);
  assert.equal(finished.progress.stars, savedBeforeMistakes.stars);
  assert.equal(finished.progress.totalStairs, 12);
  assert.equal(finished.progress.bestCombo, 12);
  assert.deepEqual(finished.progress.completedStages, []);
  assert.equal(store.isStageUnlocked('integration-player', ADVENTURE_STAGES[1].id), false);
  assert.equal(session.act(session.getProgress().nextAction), 'blocked');
  assert.equal(save(new ProgressStore(disk, () => NOW), session, run, true).earnedStars, 0);
  assert.equal(finished.progress.stars, 6, 'one collected star and the five-star first-step achievement survive the failed adventure');
});
