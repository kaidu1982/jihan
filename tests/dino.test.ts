import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DinoSession, DINO_AIR_JUMP_SPEED, DINO_COURSE_LENGTH, DINO_COURSE_LENGTHS, DINO_JUMP_SPEED, makeDinoCourse, needsDinoDoubleJump } from '../src/dino-session';
import dino from '../src/dino';

function run(seed: number, jump: boolean, step = 16): DinoSession {
  const session = new DinoSession({ seed, level: 0, character: 'sprout' });
  while (!session.finished && session.elapsed < 60_000) {
    const next = session.nextObstacle;
    if (jump && next && next.x - session.distance < 102 && next.x > session.distance && session.grounded) session.act('jump');
    session.advance(step);
  }
  return session;
}

test('seeded dinosaur course has a safe opening, separated reachable jumps, and bounded gaps', () => {
  assert.deepEqual(makeDinoCourse(42), makeDinoCourse(42));
  assert.notDeepEqual(makeDinoCourse(42), makeDinoCourse(43));
  for (let seed = 0; seed < 50; seed++) {
    const { obstacles } = makeDinoCourse(seed);
    assert.ok(obstacles[0].x >= 850);
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i];
      assert.ok(obstacle.width <= 80);
      if (i) assert.ok(obstacle.x - obstacles[i - 1].x >= 475);
      assert.ok(obstacle.x < DINO_COURSE_LENGTH - 400);
    }
  }
});

test('real seeded runs finish in 45–60 seconds; one well-timed jump clears every obstacle', () => {
  for (const seed of [0, 1, 2, 42, 1701, 982341]) {
    const session = run(seed, true);
    assert.equal(session.finished, true);
    assert.equal(session.mistakes, 0, `seed ${seed}`);
    assert.ok(session.elapsed >= 45_000 && session.elapsed <= 60_000);
    assert.ok(session.stars >= session.obstacles.length * 2);
    const status = session.getStatus();
    assert.equal(status.progress, 1);
    assert.equal(status.won, true);
    assert.equal(status.score, 900);
    assert.ok(status.summary.includes('완주'));
    assert.equal(session.clearedObstacles, session.obstacles.length);
    assert.ok(status.objectives?.every(objective => objective.done));
  }
});

test('missed jumps stumble and recover; even a no-input run can finish', () => {
  const session = run(42, false);
  assert.equal(session.finished, true);
  assert.ok(session.mistakes > 5);
  assert.ok(session.elapsed < 60_000);
  assert.equal(session.getStatus().won, true);
  assert.ok(session.stars > 0);
  assert.equal(session.getStatus().objectives?.find(objective => objective.id === 'leaps')?.done, false);
});

test('one extra airborne jump is available, a third is ignored, and landing restores both jumps', () => {
  const session = new DinoSession();
  assert.equal(session.jumpsRemaining, 2);
  session.act('jump'); session.advance(100);
  assert.ok(session.height > 0);
  // The first jump keeps the original ground jump physics.
  assert.ok(Math.abs(session.height - 45.75) < .001);
  assert.equal(session.jumpsRemaining, 1);
  session.act('jump');
  assert.equal(session.velocity, DINO_JUMP_SPEED);
  assert.equal(session.jumpsRemaining, 0);
  assert.match(session.getStatus().feedback ?? '', /두 번/);
  session.advance(100);
  const velocity = session.velocity;
  session.act('up');
  assert.equal(session.velocity, velocity);
  session.advance(1_200);
  assert.equal(session.height, 0);
  assert.equal(session.grounded, true);
  assert.equal(session.jumpsRemaining, 2);
  session.act('up'); session.advance(100); session.act('jump');
  assert.equal(session.velocity, DINO_JUMP_SPEED);
  assert.equal(session.jumpsRemaining, 0);
});

test('a second jump can save a descending dinosaur before a rock; missed gaps still recover', () => {
  const saved = new DinoSession();
  const missed = new DinoSession();
  const rock = saved.obstacles.find(obstacle => obstacle.kind === 'rock')!;
  for (const session of [saved, missed]) {
    session.distance = rock.x - rock.width / 2 - 14 - 25;
    session.height = 12; session.velocity = -80; session.jumpsUsed = 1;
  }
  saved.act('jump');
  saved.advance(500); missed.advance(500);
  assert.equal(saved.mistakes, 0);
  assert.equal(missed.mistakes, 1);
  assert.equal(saved.obstacles.find(obstacle => obstacle.id === rock.id)?.resolved, true);

  const session = new DinoSession();
  const gap = session.obstacles.find(obstacle => obstacle.kind === 'gap');
  assert.ok(gap);
  const gapSession = new DinoSession();
  gapSession.distance = gap.x - gap.width / 2 - 2;
  gapSession.advance(60);
  assert.equal(gapSession.mistakes, 1);
  assert.ok(gapSession.height > 0);
  assert.equal(gapSession.protected, true);
  assert.equal(gapSession.jumpsRemaining, 1);
  gapSession.advance(1_200);
  assert.equal(gapSession.grounded, true);
  assert.equal(gapSession.protected, false);
});

test('eggs award once, ignored invalid deltas do not change state, and finished run freezes', () => {
  const session = new DinoSession();
  const initial = session.getStatus();
  for (const delta of [0, -1, NaN, Infinity]) session.advance(delta);
  assert.deepEqual(session.getStatus(), initial);
  session.advance(2_400);
  assert.equal(session.stars, 1);
  session.advance(50);
  assert.equal(session.stars, 1);
  session.advance(60_000);
  assert.equal(session.finished, true);
  const final = session.getStatus();
  session.act('jump'); session.advance(4_000);
  assert.deepEqual(session.getStatus(), final);
  assert.equal(session.distance, DINO_COURSE_LENGTH);
});

test('substeps prevent tunnelling on long frames and match small-frame active time', () => {
  const long = new DinoSession();
  long.advance(60_000);
  const short = run(1701, false, 1000 / 120);
  assert.equal(long.mistakes, short.mistakes);
  assert.equal(long.stars, short.stars);
  assert.ok(Math.abs(long.elapsed - short.elapsed) < 1);
  assert.equal(long.distance, short.distance);
});

test('all dinosaur stages and costumes have a playable session and shell definition', () => {
  assert.equal(dino.id, 'dino');
  assert.equal(dino.stages?.length, 3);
  assert.equal(dino.characters?.length, 3);
  assert.equal(dino.characters?.[0].cost, 0);
  assert.ok(dino.controls.some(control => control.action === 'jump' && control.keys.includes('Space')));
  for (let level = 0; level < 3; level++) {
    const session = dino.create({ seed: level, level, character: dino.characters![level].id });
    session.advance(60_000); session.advance(5_000);
    const status = session.getStatus();
    assert.equal(status.finished, true);
    assert.equal(status.won, true);
    assert.equal(typeof status.label, 'string');
    assert.equal(typeof status.detail, 'string');
  }
});

test('later dinosaur stages change the course, add reachable double-jump heights, and keep a gentle opening', () => {
  assert.deepEqual(makeDinoCourse(42), makeDinoCourse(42, 0));
  for (let level = 1; level <= 2; level++) {
    assert.deepEqual(makeDinoCourse(42, level), makeDinoCourse(42, level));
    assert.notDeepEqual(makeDinoCourse(42, level), makeDinoCourse(42, level - 1));
    const course = makeDinoCourse(42, level);
    const high = course.obstacles.filter(obstacle => obstacle.height > 110);
    assert.ok(high.length >= 5);
    assert.ok(high.every(obstacle => obstacle.height > DINO_JUMP_SPEED ** 2 / (2 * 1_250)));
    assert.ok(course.eggs.some(egg => egg.height > 200));
    assert.ok(course.obstacles[0].x >= 880);
    assert.ok(course.obstacles.every((obstacle, index) => !index || obstacle.x - course.obstacles[index - 1].x >= 520));
    assert.ok(course.obstacles.at(-1)!.x < DINO_COURSE_LENGTHS[level] - 450);
  }
});

test('seeded routes on every later stage allow collision-free double jumps and all three medals', () => {
  for (const level of [1, 2]) {
    for (const seed of [0, 1, 2, 42, 1701, 982341, 0xffffffff, ...Array.from({ length: 15 }, (_, index) => index * 104729)]) {
      const session = new DinoSession({ seed, level, character: 'sprout' });
      while (!session.finished && session.elapsed < 65_000) {
        const obstacle = session.nextObstacle;
        if (obstacle && obstacle.x > session.distance) {
          const distance = obstacle.x - session.distance;
          const double = needsDinoDoubleJump(obstacle);
          if (session.grounded && distance < (double ? 190 : 110)) session.act('jump');
          else if (double && session.jumpsUsed === 1 && distance < 120) session.act('jump');
        }
        session.advance(16);
      }
      assert.equal(session.finished, true, `${level}:${seed} completion`);
      assert.equal(session.mistakes, 0, `${level}:${seed} collision`);
      assert.equal(session.clearedObstacles, session.obstacles.length);
      assert.equal(session.stars, session.eggs.length, `${level}:${seed} eggs`);
      assert.ok(session.elapsed >= 50_000 && session.elapsed < 65_000);
      assert.ok(session.getStatus().objectives?.every(objective => objective.done));
    }
  }
});

test('higher courses remain forgiving without input and freeze after finishing', () => {
  for (const level of [1, 2]) {
    const session = new DinoSession({ seed: 42, level, character: 'sprout' });
    session.advance(60_000); session.advance(5_000);
    assert.equal(session.finished, true);
    assert.ok(session.mistakes > 0);
    assert.ok(session.elapsed < 65_000);
    const finished = session.getStatus();
    session.act('jump'); session.advance(10_000);
    assert.deepEqual(session.getStatus(), finished);
  }
});

test('following the displayed cue clears later courses and earns all three medals', () => {
  for (const level of [1, 2]) for (const seed of [0, 42, 982341]) {
    const session = new DinoSession({ seed, level, character: 'sprout' });
    const shown = new Set<string>();
    while (!session.finished && session.elapsed < 65_000) {
      // Read the same public cue shown by both renderers; do not inspect obstacle timing.
      const cue = session.jumpCue;
      if (cue) {
        shown.add(cue.phase);
        assert.ok(session.getStatus().detail.includes(cue.text));
        if (cue.shouldJump) session.act('jump');
      }
      session.advance(16);
    }
    assert.deepEqual([...shown].sort(), ['again', 'jump', 'prepare', 'wait']);
    assert.equal(session.finished, true);
    assert.equal(session.mistakes, 0, `${level}:${seed}`);
    assert.equal(session.clearedObstacles, session.obstacles.length);
    assert.equal(session.stars, session.eggs.length);
    assert.ok(session.getStatus().objectives?.every(objective => objective.done));
    assert.equal(session.jumpCue, undefined);
  }
});

test('jump guidance waits for the reachable second-jump window and stops once airborne jumps are spent', () => {
  const session = new DinoSession({ seed: 42, level: 2, character: 'sprout' });
  const tall = session.obstacles.find(obstacle => obstacle.height > 110)!;
  for (const obstacle of session.obstacles) if (obstacle.x < tall.x) obstacle.resolved = true;
  session.distance = tall.x - 270;
  assert.equal(session.jumpCue?.phase, 'prepare');
  assert.equal(session.jumpCue?.shouldJump, false);
  session.distance = tall.x - 189;
  assert.equal(session.jumpCue?.phase, 'jump');
  session.act('jump'); session.advance(16);
  assert.equal(session.jumpCue?.phase, 'wait');
  assert.equal(session.jumpCue?.shouldJump, false);
  while (session.jumpCue?.phase === 'wait') session.advance(16);
  assert.equal(session.jumpCue?.phase, 'again');
  session.act('jump');
  assert.equal(session.jumpCue, undefined);
  const first = new DinoSession();
  first.distance = first.nextObstacle!.x - 100;
  assert.equal(first.jumpCue?.shouldJump, true);
  first.act('jump'); first.advance(16);
  assert.equal(first.jumpCue, undefined);
});

test('the displayed guide leaves 200–300ms reaction time on both jumps, including wide gaps', () => {
  for (const level of [0, 1, 2]) for (const seed of [0, 42, 982341]) for (const reaction of [150, 200, 300]) {
    const session = new DinoSession({ seed, level, character: 'sprout' });
    while (!session.finished && session.elapsed < 65_000) {
      if (session.jumpCue?.shouldJump) {
        session.advance(reaction);
        session.act('jump');
      }
      session.advance(16);
    }
    assert.equal(session.finished, true);
    assert.equal(session.mistakes, 0, `${level}:${seed}:${reaction}ms`);
    assert.equal(session.stars, session.eggs.length, `${level}:${seed}:${reaction}ms eggs`);
    assert.equal(session.clearedObstacles, session.obstacles.length);
    assert.ok(session.getStatus().objectives?.every(objective => objective.done));
  }
});

test('uneven first and second responses still clear high obstacles and landing restores both hops', () => {
  for (const level of [1, 2]) for (const seed of [0, 42, 982341]) {
    for (const firstReaction of [0, 150, 300]) for (const secondReaction of [0, 150, 300]) {
      const session = new DinoSession({ seed, level, character: 'sprout' });
      while (!session.finished && session.elapsed < 65_000) {
        const cue = session.jumpCue;
        if (cue?.shouldJump) {
          session.advance(cue.phase === 'again' ? secondReaction : firstReaction);
          session.act('jump');
        }
        session.advance(16);
      }
      assert.equal(session.mistakes, 0, `${level}:${seed}:${firstReaction}/${secondReaction}ms`);
      assert.equal(session.clearedObstacles, session.obstacles.length);
      assert.ok(session.getStatus().objectives?.every(objective => objective.done));
    }
    const landing = new DinoSession({ seed, level, character: 'sprout' });
    landing.act('jump'); landing.advance(150); landing.act('jump');
    assert.equal(landing.velocity, DINO_AIR_JUMP_SPEED);
    landing.advance(1_800);
    assert.equal(landing.grounded, true);
    assert.equal(landing.jumpsRemaining, 2);
  }
});
