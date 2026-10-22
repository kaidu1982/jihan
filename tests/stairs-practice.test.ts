import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_ENERGY, MAX_STEPS, MIN_STEP_MS, validateRun } from '../functions/src/shared/rules';
import { StairSession } from '../src/game-session';
import { STAIRS_LESSON } from '../src/stairs-lesson';
import { PracticeGoalStore, PRACTICE_GOALS, nextPracticeGoal, practiceGoalLabel, practiceRunOptions } from '../src/stairs-practice';

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
function climb(run: StairSession, count: number) {
  for (let i = 0; i < count; i++) {
    run.advance(MIN_STEP_MS + 20);
    assert.equal(run.act(run.getProgress().nextAction), 'step');
  }
}

test('each short practice finishes at its own goal, permits mistakes, and freezes its result', () => {
  for (const goal of [20, 50, 100] as const) {
    const run = new StairSession(73129, 'practice', practiceRunOptions(goal));
    for (let i = 0; i < 5; i++) {
      run.advance(INITIAL_ENERGY * 5);
      assert.equal(run.act(run.getProgress().nextAction === 'climb' ? 'turn' : 'climb'), 'mistake');
      assert.equal(run.reason, null);
    }
    climb(run, goal - 1);
    assert.equal(run.reason, null);
    climb(run, 1);
    assert.equal(run.reason, 'finished');
    assert.equal(run.score, goal);
    assert.equal(run.collected, goal / 10);
    const result = run.getResult();
    run.advance(100_000);
    assert.equal(run.act(run.getProgress().nextAction), 'blocked');
    assert.deepEqual(run.getResult(), result);
  }
});

test('endless practice keeps the original safety cap and stays open past the short goals', () => {
  assert.deepEqual(PRACTICE_GOALS, [20, 50, 100, 'endless']);
  assert.equal(practiceGoalLabel('endless'), '끝없이');
  const run = new StairSession(40, 'practice', practiceRunOptions('endless'));
  assert.equal(run.goal, MAX_STEPS);
  climb(run, 101);
  assert.equal(run.reason, null);
  assert.equal(nextPracticeGoal(20), 50);
  assert.equal(nextPracticeGoal(50), 100);
  assert.equal(nextPracticeGoal(100), undefined);
  assert.equal(nextPracticeGoal('endless'), undefined);
});

test('goal choices persist by normalized name while existing profiles and scores stay untouched', () => {
  const storage = memoryStorage();
  const legacy = JSON.stringify({ profiles: [{ id: 'old', name: '지한이', best: 123, practiceBest: 456 }], activeId: 'old', sound: false });
  storage.data.set('jihan-stairs-v1', legacy);
  const goals = new PracticeGoalStore(storage);
  assert.equal(goals.get('지한이'), 20);
  assert.equal(goals.select(' 지한이 ', 100), true);
  assert.equal(goals.select('친구', 'endless'), true);
  assert.equal(goals.select('가', 50), true);
  const reloaded = new PracticeGoalStore(storage);
  assert.equal(reloaded.get('지한이'), 100);
  assert.equal(reloaded.get(' 친구 '), 'endless');
  assert.equal(reloaded.get('가'), 50);
  assert.equal(reloaded.get('새 친구'), 20);
  assert.equal(storage.data.get('jihan-stairs-v1'), legacy);
  assert.equal(reloaded.delete('지한이'), true);
  assert.equal(new PracticeGoalStore(storage).get('지한이'), 20);
  assert.equal(new PracticeGoalStore(storage).get('친구'), 'endless');
});

test('damaged or unavailable goal storage falls back safely and preserves the current choice in memory', () => {
  const storage = memoryStorage();
  storage.data.set('jihan-stairs-practice-v1', '{bad');
  assert.equal(new PracticeGoalStore(storage).get('지한이'), 20);
  storage.data.set('jihan-stairs-practice-v1', JSON.stringify({ 'name:지한이': -1, 'name:친구': 50, 'not-a-name': 100, 'name:새친구': '100' }));
  const sanitized = new PracticeGoalStore(storage);
  assert.equal(sanitized.get('지한이'), 20);
  assert.equal(sanitized.get('친구'), 50);
  assert.equal(sanitized.get('새친구'), 20);
  const blocked = new PracticeGoalStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  assert.equal(blocked.select('지한이', 50), false);
  assert.equal(blocked.get('지한이'), 50);
  assert.equal(blocked.select('', 20), false);
});

test('leaving the lesson restores practice stars and starting a challenge keeps server-verifiable rules', () => {
  const lesson = new StairSession(STAIRS_LESSON.seed, 'practice', STAIRS_LESSON.options);
  climb(lesson, 12);
  assert.equal(lesson.reason, 'finished');
  assert.equal(lesson.collected, 0);
  const practice = new StairSession(73129, 'practice', practiceRunOptions(20));
  climb(practice, 20);
  assert.equal(practice.reason, 'finished');
  assert.equal(practice.collected, 2);
  const challenge = new StairSession(73129, 'challenge');
  assert.equal(challenge.goal, MAX_STEPS);
  climb(challenge, 25);
  assert.equal(challenge.reason, null);
  assert.equal(validateRun(73129, challenge.getResult().inputs, challenge.activeTime), 25);
  challenge.advance(INITIAL_ENERGY);
  assert.equal(challenge.reason, 'time');
});
