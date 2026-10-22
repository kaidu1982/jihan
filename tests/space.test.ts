import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSpaceMission, SPACE_DURATION_MS, SpaceSession } from '../src/space-session';

const options = (seed = 7123, level = 0) => ({ seed, level, character: 'comet' });

test('space rescue missions are deterministic and each planet has its own route', () => {
  assert.deepEqual(makeSpaceMission(123, 1), makeSpaceMission(123, 1));
  assert.notDeepEqual(makeSpaceMission(123, 0), makeSpaceMission(123, 1));
  assert.notDeepEqual(makeSpaceMission(123, 1), makeSpaceMission(123, 2));
  assert.notDeepEqual(makeSpaceMission(123), makeSpaceMission(456));
  for (const seed of [0, 1, 7123, 0xffffffff, NaN]) {
    for (const level of [0, 1, 2]) {
      const { objects, waves } = makeSpaceMission(seed, level);
      assert.equal(waves.length, 12);
      assert.ok(waves[0].arrivalAt >= 6000);
      let previous = 1;
      for (const [index, wave] of waves.entries()) {
        assert.ok(Math.abs(wave.safeLane - previous) <= 1);
        assert.ok(!wave.meteorLanes.includes(wave.safeLane));
        const friends = objects.filter(object => object.wave === index && object.kind === 'friend');
        assert.equal(friends.length, 1);
        assert.equal(friends[0].lane, wave.safeLane);
        assert.ok(objects.filter(object => object.wave === index && object.kind === 'star').every(object => object.lane === wave.safeLane));
        previous = wave.safeLane;
      }
    }
  }
});

test('the visible star trail is a reachable route to every friend on all planets', () => {
  for (const seed of [1, 7123, 0xffffffff]) {
    for (const level of [0, 1, 2]) {
      const run = new SpaceSession(options(seed, level));
      while (!run.finished) {
        const next = run.nextFriend;
        if (next && next.arrivalAt - run.elapsed < 2800) {
          if (run.targetLane < next.lane) run.act('right');
          else if (run.targetLane > next.lane) run.act('left');
        }
        run.advance(16);
      }
      assert.equal(run.bumps, 0);
      assert.equal(run.rescued, 12);
      assert.equal(run.stars, 24);
      assert.equal(run.getStatus().won, true);
      assert.equal(run.getStatus().progress, 1);
    }
  }
});

test('space interpolation sweeps crossings and collision recovery never ends the journey', () => {
  const run = new SpaceSession(options());
  const first = run.waves[0];
  const meteorLane = first.meteorLanes[0];
  while (run.targetLane > meteorLane) run.act('left');
  while (run.targetLane < meteorLane) run.act('right');
  run.advance(first.arrivalAt);
  assert.equal(run.bumps, 1);
  assert.equal(run.shielded, true);
  assert.equal(run.finished, false);
  assert.match(run.getStatus().feedback ?? '', /보호막/);
  run.advance(1801);
  assert.equal(run.shielded, false);
  run.advance(100_000);
  assert.equal(run.finished, true);
  assert.equal(run.elapsed, SPACE_DURATION_MS);
  assert.ok(run.getStatus().summary.includes('우주 정거장 도착'));
});

test('one rescue crossing awards a friend once and cannot be harvested after passing', () => {
  const run = new SpaceSession(options());
  const firstFriend = run.objects.find(object => object.kind === 'friend')!;
  while (run.targetLane > firstFriend.lane) run.act('left');
  while (run.targetLane < firstFriend.lane) run.act('right');
  run.advance(firstFriend.arrivalAt + 1);
  assert.equal(firstFriend.outcome, 'collected');
  assert.equal(run.rescued, 1);
  run.act('left'); run.act('right'); run.advance(100);
  assert.equal(run.rescued, 1);
  assert.equal(run.objects.filter(object => object.kind === 'friend' && object.outcome === 'collected').length, 1);

  const missed = new SpaceSession(options());
  const missedFriend = missed.objects.find(object => object.kind === 'friend')!;
  const away = missedFriend.lane === 0 ? 2 : 0;
  while (missed.targetLane > away) missed.act('left');
  while (missed.targetLane < away) missed.act('right');
  missed.advance(missedFriend.arrivalAt + 1);
  assert.equal(missedFriend.outcome, 'missed');
  while (missed.targetLane > missedFriend.lane) missed.act('left');
  while (missed.targetLane < missedFriend.lane) missed.act('right');
  missed.advance(500);
  assert.equal(missed.rescued, 0);
});

test('large active frames produce the same rewards and impacts as small frames', () => {
  const big = new SpaceSession(options());
  const small = new SpaceSession(options());
  big.act('left'); small.act('left');
  big.advance(10_000);
  for (let i = 0; i < 625; i++) small.advance(16);
  assert.equal(big.stars, small.stars);
  assert.equal(big.rescued, small.rescued);
  assert.equal(big.bumps, small.bumps);
  assert.equal(big.lane, small.lane);
  assert.deepEqual(big.objects.map(object => object.outcome), small.objects.map(object => object.outcome));
});

test('the ship interpolates, stays inside the field, ignores invalid time, and freezes on finish', () => {
  const run = new SpaceSession(options());
  run.act('left');
  run.advance(50);
  assert.ok(run.lane > 0 && run.lane < 1);
  for (let i = 0; i < 12; i++) run.act('left');
  run.advance(1000);
  assert.equal(run.targetLane, 0); assert.equal(run.lane, 0);
  for (let i = 0; i < 12; i++) run.act('right');
  run.advance(1000);
  assert.equal(run.targetLane, 2); assert.equal(run.lane, 2);
  const before = run.getStatus();
  for (const value of [NaN, Infinity, -1, 0]) run.advance(value);
  assert.deepEqual(run.getStatus(), before);
  run.advance(SPACE_DURATION_MS);
  const finished = run.getStatus();
  assert.equal(finished.label, '0초');
  run.act('left'); run.advance(100_000);
  assert.deepEqual(run.getStatus(), finished);
  assert.equal(run.lane, 2);
});

test('an unsuccessful rescue mission still arrives with an honest result', () => {
  const run = new SpaceSession(options());
  for (const object of run.objects) if (object.kind === 'friend') object.lane = 0;
  run.advance(SPACE_DURATION_MS);
  assert.equal(run.finished, true);
  assert.equal(run.getStatus().won, false);
  assert.equal(run.rescued, 0);
  assert.match(run.getStatus().summary, /친구 0명/);
  assert.match(run.getStatus().summary, /다음 탐험/);
});
