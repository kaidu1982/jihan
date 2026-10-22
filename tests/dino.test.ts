import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DinoSession, DINO_COURSE_LENGTH, DINO_JUMP_SPEED, makeDinoCourse } from '../src/dino-session';
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
    session.advance(60_000);
    const status = session.getStatus();
    assert.equal(status.finished, true);
    assert.equal(status.won, true);
    assert.equal(typeof status.label, 'string');
    assert.equal(typeof status.detail, 'string');
  }
});
