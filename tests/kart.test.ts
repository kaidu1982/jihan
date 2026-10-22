import assert from 'node:assert/strict';
import test from 'node:test';
import { KartSession, KART_DURATION_MS, makeKartCourse } from '../src/kart-session';

test('seeded kart routes offer an adjacent, clear star path through every obstacle row', () => {
  assert.deepEqual(makeKartCourse(71342), makeKartCourse(71342));
  assert.notDeepEqual(makeKartCourse(71342), makeKartCourse(95126));
  for (const seed of [0, 1, 71342, 0xffffffff, NaN]) {
    const { objects, rows } = makeKartCourse(seed);
    assert.ok(rows[0].distance >= 750, 'the opening gives a new player time to look ahead');
    let previousLane = 1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      assert.ok(row.obstacleLanes.length >= 1 && row.obstacleLanes.length <= 2);
      assert.ok(!row.obstacleLanes.includes(row.safeLane));
      assert.ok(Math.abs(row.safeLane - previousLane) <= 1);
      if (i > 0) assert.ok(row.distance - rows[i - 1].distance >= 400);
      const stars = objects.filter(object => object.row === i && object.kind === 'star');
      assert.equal(stars.length, 3);
      assert.ok(stars.every(object => object.lane === row.safeLane));
      previousLane = row.safeLane;
    }
  }
});

test('a race finishes after exactly one minute of active simulation and cannot award extras', () => {
  const run = new KartSession(71342);
  run.advance(59_999);
  assert.equal(run.finished, false);
  assert.equal(run.getProgress().duration, 60);
  run.advance(50_000);
  assert.equal(run.finished, true);
  assert.equal(run.elapsed, KART_DURATION_MS);
  assert.equal(run.getProgress().elapsed, 60);
  assert.equal(run.getProgress().progress, 1);
  const result = run.getResult(), distance = run.distance, lane = run.lane;
  assert.deepEqual(run.advance(50_000), []);
  run.move(-1);
  assert.deepEqual(run.getResult(), result);
  assert.equal(run.distance, distance);
  assert.equal(run.lane, lane);
});

test('following the star trail is a reachable, collision-free route through a whole race', () => {
  for (const seed of [1, 71342, 0xffffffff]) {
    const run = new KartSession(seed);
    while (!run.finished) {
      const nextRow = run.rows.find(row => row.distance + 100 > run.distance)!;
      if (nextRow.distance - run.distance < 330) {
        if (run.targetLane > nextRow.safeLane) run.move(-1);
        else if (run.targetLane < nextRow.safeLane) run.move(1);
      }
      run.advance(16);
    }
    assert.equal(run.bumps, 0);
    assert.ok(run.stars >= 60, 'each successive safe lane remains reachable before its stars arrive');
  }
});

test('pausing freezes lane, distance, rewards, and the clock until explicitly resumed', () => {
  const run = new KartSession(71342);
  run.advance(2000);
  const before = run.getProgress(), distance = run.distance;
  run.setPaused(true);
  run.move(-1);
  assert.deepEqual(run.advance(60_000), []);
  assert.deepEqual(run.getProgress(), before);
  assert.equal(run.distance, distance);
  assert.equal(run.targetLane, 1);
  run.setPaused(false);
  run.move(1);
  run.advance(250);
  assert.equal(run.lane, 2);
  assert.ok(Math.abs(run.getProgress().elapsed - 2.25) < 1e-9);
  run.advance(57_750);
  assert.equal(run.getResult().elapsed, 60);
});

test('long active frames cannot tunnel through stars and each star is awarded once', () => {
  const oneFrame = new KartSession(71342), normalFrames = new KartSession(71342);
  const events = oneFrame.advance(5000);
  for (let i = 0; i < 500; i++) normalFrames.advance(10);
  assert.equal(oneFrame.stars, 3);
  assert.equal(events.filter(event => event.kind === 'star').length, 3);
  assert.equal(normalFrames.stars, oneFrame.stars);
  assert.equal(oneFrame.bumps, 0);
  assert.ok(Math.abs(normalFrames.distance - oneFrame.distance) < .05);
  assert.equal(new Set(events.map(event => event.object.id)).size, events.length);
  oneFrame.advance(100);
  assert.equal(oneFrame.stars, 3);
});

test('hitting an obstacle slows the kart gently, then restores speed without ending the race', () => {
  const run = new KartSession(71342);
  const obstacle = run.objects.find(object => object.kind !== 'star')!;
  run.move(obstacle.lane < 1 ? -1 : 1);
  const events = run.advance(4300);
  assert.equal(events.filter(event => event.kind === 'bump').length, 1);
  assert.equal(run.bumps, 1);
  assert.equal(run.slowed, true);
  assert.ok(run.speed < 120);
  assert.equal(run.finished, false);
  run.advance(1300);
  assert.equal(run.slowed, false);
  assert.ok(run.speed > 170);
  assert.equal(run.bumps, 1);
  run.advance(60_000);
  assert.equal(run.finished, true);
  assert.equal(run.getResult().elapsed, 60);
});

test('a lane command moves through real positions and cannot instantly collide in its target lane', () => {
  const run = new KartSession(71342);
  const obstacle = run.objects.find(object => object.kind !== 'star')!;
  while (run.distance < obstacle.distance - 10) run.advance(1);
  run.move(obstacle.lane < 1 ? -1 : 1);
  assert.equal(run.lane, 1);
  run.advance(8);
  assert.ok(Math.abs(run.lane - 1) < .05);
  assert.equal(run.bumps, 0, 'target lane does not replace the visible car position');
  run.advance(140);
  assert.equal(run.bumps, 1, 'actually moving into the obstacle still makes contact');
});

test('invalid timing and lane boundaries preserve a finite, reusable session', () => {
  const run = new KartSession(Infinity);
  for (const delta of [NaN, Infinity, -50, 0]) assert.deepEqual(run.advance(delta), []);
  assert.equal(run.elapsed, 0);
  run.move(-1); run.move(-1); run.move(-1); run.advance(300);
  assert.equal(run.lane, 0);
  run.move(1); run.move(1); run.move(1); run.advance(500);
  assert.equal(run.lane, 2);
  assert.equal(new KartSession(71342).getResult().stars, 0);
  assert.ok(Number.isFinite(run.distance));
});
