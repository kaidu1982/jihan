import assert from 'node:assert/strict';
import test from 'node:test';
import { StairSession } from '../src/game-session';
import { STAIRS_LESSON, lessonCue } from '../src/stairs-lesson';
import { INITIAL_ENERGY, MAX_STEPS, MIN_STEP_MS, validateRun } from '../functions/src/shared/rules';

test('the lesson teaches climbs before a turn and graduates on exactly twelve steps', () => {
  const run = new StairSession(STAIRS_LESSON.seed, 'practice', STAIRS_LESSON.options);
  const actions: string[] = [];
  for (let i = 0; i < STAIRS_LESSON.goal; i++) {
    const cue = lessonCue(run.getProgress());
    assert.equal(cue.step, i + 1);
    assert.equal(cue.action, run.getProgress().nextAction);
    assert.ok(cue.instruction.includes(cue.action === 'turn' ? '방향 바꾸기' : '오르기'));
    assert.equal(cue.chapter.startsWith(i < 3 ? '1.' : i === 3 ? '2.' : '3.'), true);
    actions.push(cue.action!);
    run.advance(100);
    assert.equal(run.act(cue.action!), 'step');
    assert.equal(run.reason, i === 11 ? 'finished' : null);
  }
  assert.deepEqual(actions.slice(0, 4), ['climb', 'climb', 'climb', 'turn']);
  assert.ok(actions.slice(4).includes('turn'));
  assert.ok(actions.slice(4).includes('climb'));
  assert.equal(run.score, 12);
  assert.equal(lessonCue(run.getProgress()).action, undefined);
  assert.equal(lessonCue(run.getProgress()).instruction, '조작 교실 졸업! 🎓');
  run.advance(100);
  assert.equal(run.act(run.getProgress().nextAction), 'blocked');
  assert.equal(run.score, 12);
});

test('lesson waiting and repeated errors never lose the route, time, or the next lesson instruction', () => {
  const run = new StairSession(STAIRS_LESSON.seed, 'practice', STAIRS_LESSON.options);
  const expected = lessonCue(run.getProgress());
  for (let i = 0; i < 12; i++) {
    run.advance(INITIAL_ENERGY * 20);
    assert.equal(run.act(run.getProgress().nextAction === 'climb' ? 'turn' : 'climb'), 'mistake');
    assert.deepEqual(lessonCue(run.getProgress()), expected);
    assert.equal(run.score, 0);
    assert.equal(run.energy, INITIAL_ENERGY);
    assert.equal(run.reason, null);
    assert.equal(run.getProgress().mistakesLeft, undefined);
  }
  run.advance(100);
  assert.equal(run.act('climb'), 'step');
  assert.equal(lessonCue(run.getProgress()).step, 2);
});

test('starting a regular game after a lesson restores the timed, server-verifiable rules and full goal', () => {
  const lesson = new StairSession(STAIRS_LESSON.seed, 'practice', STAIRS_LESSON.options);
  for (let i = 0; i < 12; i++) { lesson.advance(100); lesson.act(lesson.getProgress().nextAction); }
  const challenge = new StairSession(STAIRS_LESSON.seed, 'challenge');
  assert.equal(challenge.goal, MAX_STEPS);
  assert.equal(challenge.score, 0);
  for (let i = 0; i < 20; i++) {
    challenge.advance(MIN_STEP_MS + 20);
    assert.equal(challenge.act(challenge.getProgress().nextAction), 'step');
  }
  assert.equal(challenge.reason, null);
  assert.equal(validateRun(STAIRS_LESSON.seed, challenge.getResult().inputs, challenge.activeTime), 20);
  challenge.advance(INITIAL_ENERGY);
  assert.equal(challenge.reason, 'time');
});

test('the lesson never shows or collects stars and a subsequent normal run restores star collection', () => {
  const lesson = new StairSession(STAIRS_LESSON.seed, 'practice', { ...STAIRS_LESSON.options, starOffset: 9 });
  assert.equal(lesson.collectStars, false);
  for (let i = 0; i < 12; i++) {
    lesson.advance(100);
    lesson.act(lesson.getProgress().nextAction);
    assert.equal(lesson.getProgress().collected, 0);
    assert.equal(lesson.getResult().collected, 0);
  }
  assert.equal(lesson.reason, 'finished');
  for (const mode of ['practice', 'challenge'] as const) {
    const regular = new StairSession(STAIRS_LESSON.seed, mode);
    assert.equal(regular.collectStars, true);
    for (let i = 0; i < 20; i++) {
      regular.advance(100);
      regular.act(regular.getProgress().nextAction);
      assert.equal(regular.getProgress().collected, Math.floor((i + 1) / 10));
      assert.equal(regular.getResult().collected, Math.floor((i + 1) / 10));
    }
  }
});
