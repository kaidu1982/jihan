import assert from 'node:assert/strict';
import test from 'node:test';
import { StairSession, worldForScore } from '../src/game-session';
import { INITIAL_ENERGY, MAX_STEPS, MIN_STEP_MS, validateRun } from '../functions/src/shared/rules';

function climb(session: StairSession, count: number, interval = 90): void {
  for (let i = 0; i < count; i++) {
    session.advance(interval);
    assert.equal(session.act(session.getProgress().nextAction), 'step');
  }
}

test('new worlds and stars follow distance while a fixed adventure world stays fixed', () => {
  assert.deepEqual([0, 49, 50, 100, 150, 200, 249, 250].map(worldForScore), ['meadow', 'meadow', 'sunset', 'forest', 'snow', 'space', 'space', 'meadow']);
  const endless = new StairSession(48291, 'practice');
  climb(endless, 50);
  assert.equal(endless.getProgress().worldId, 'sunset');
  assert.equal(endless.getProgress().collected, 5);
  const adventure = new StairSession(48291, 'practice', { world: 'snow', goal: 80, mistakeLimit: 3 });
  climb(adventure, 51);
  assert.equal(adventure.getProgress().worldId, 'snow');
});

test('adventure grants three mistakes and leaves path and collected stars intact', () => {
  const run = new StairSession(75189, 'practice', { goal: 25, mistakeLimit: 3 });
  climb(run, 11);
  const before = run.getProgress();
  for (let i = 0; i < 3; i++) {
    run.advance(100);
    assert.equal(run.act(before.nextAction === 'climb' ? 'turn' : 'climb'), 'mistake');
    assert.equal(run.score, 11);
    assert.equal(run.getProgress().collected, 1);
    assert.equal(run.getProgress().nextAction, before.nextAction);
    assert.equal(run.getProgress().mistakesLeft, 2 - i);
    assert.equal(run.reason, i === 2 ? 'wrong' : null);
  }
  assert.equal(run.getResult().maxCombo, 11);
  assert.equal(run.getResult().mistakes, 3);
  assert.equal(run.getProgress().combo, 0);
  assert.equal(run.act(before.nextAction), 'blocked');
});

test('practice errors remain harmless, reset current combo, and preserve best combo', () => {
  const run = new StairSession(76283, 'practice');
  climb(run, 12);
  for (let i = 0; i < 6; i++) {
    run.advance(100);
    run.act(run.getProgress().nextAction === 'climb' ? 'turn' : 'climb');
  }
  assert.equal(run.reason, null);
  assert.equal(run.getProgress().mistakesLeft, undefined);
  climb(run, 4);
  assert.equal(run.getProgress().combo, 4);
  assert.equal(run.getProgress().maxCombo, 12);
});

test('goals finish immediately on the last correct step and cannot award extra steps', () => {
  const run = new StairSession(41962, 'practice', { goal: 20, mistakeLimit: 3 });
  climb(run, 19);
  assert.equal(run.reason, null);
  climb(run, 1);
  assert.equal(run.reason, 'finished');
  assert.equal(run.getResult().collected, 2);
  run.advance(500);
  assert.equal(run.act(run.getProgress().nextAction), 'blocked');
  assert.equal(run.score, 20);
  assert.equal(run.getResult().inputs.length, 20);
});

test('star collectibles include the previous run remainder without double awards', () => {
  const run = new StairSession(41962, 'practice', { starOffset: 6 });
  assert.equal(run.getProgress().collected, 0);
  climb(run, 4);
  assert.equal(run.getProgress().collected, 1);
  climb(run, 6);
  assert.equal(run.getProgress().collected, 1);
  climb(run, 4);
  assert.equal(run.getProgress().collected, 2);
  assert.equal(run.getResult().collected, 2);
  assert.equal(new StairSession(1, 'practice', { starOffset: Infinity }).starOffset, 0);
  assert.equal(new StairSession(1, 'practice', { starOffset: -3 }).starOffset, 0);
});

test('challenge still produces identical server-verifiable timestamps through the maximum step', () => {
  const seed = 382761, run = new StairSession(seed, 'challenge');
  climb(run, MAX_STEPS, MIN_STEP_MS + 15);
  assert.equal(run.reason, 'finished');
  const result = run.getResult();
  assert.equal(result.score, MAX_STEPS);
  assert.equal(validateRun(seed, result.inputs, run.activeTime), MAX_STEPS);
  assert.equal(result.inputs[0].at, 70);
  assert.equal(result.inputs.at(-1)?.at, MAX_STEPS * 70);
  assert.equal(result.maxCombo, MAX_STEPS);
});

test('challenge input throttling, wrong turns and timeout retain their original rules', () => {
  const run = new StairSession(17395, 'challenge');
  assert.equal(run.act('climb'), 'step');
  assert.equal(run.act('climb'), 'blocked');
  run.advance(MIN_STEP_MS - 1);
  assert.equal(run.act('climb'), 'blocked');
  run.advance(1);
  assert.equal(run.act('turn'), 'mistake');
  assert.equal(run.reason, 'wrong');
  assert.equal(validateRun(17395, run.getResult().inputs, run.activeTime), 1);
  const timed = new StairSession(17395, 'challenge');
  timed.advance(INITIAL_ENERGY);
  assert.equal(timed.reason, 'time');
  assert.equal(timed.act('climb'), 'blocked');
});

test('new sessions reset all progress and cap unsafe optional goals', () => {
  const old = new StairSession(17395, 'practice', { goal: 10 }); climb(old, 10);
  const fresh = new StairSession(17395, 'practice', { goal: Infinity });
  assert.equal(fresh.goal, MAX_STEPS);
  assert.equal(fresh.getProgress().score, 0);
  assert.equal(fresh.getProgress().collected, 0);
  assert.equal(fresh.getProgress().maxCombo, 0);
  assert.equal(fresh.reason, null);
  assert.equal(new StairSession(1, 'practice', { goal: MAX_STEPS + 10 }).goal, MAX_STEPS);
});
