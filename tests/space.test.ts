import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSpaceMission, SPACE_DURATION_MS, SPACE_SIGNAL_CHARGES, SPACE_SIGNAL_RANGE_MS, SpaceSession } from '../src/space-session';
import space from '../src/space';

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
  for (const seed of [0, 1, 2, 42, 7123, 104729, 0xffffffff]) {
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
      assert.equal(run.stars, 32);
      assert.equal(run.combo, 12);
      assert.equal(run.bestCombo, 12);
      assert.equal(run.comboBonusStars, 8);
      assert.equal(run.getStatus().won, true);
      assert.equal(run.getStatus().progress, 1);
      assert.equal(run.signalsRemaining, SPACE_SIGNAL_CHARGES);
      assert.ok(run.getStatus().objectives?.every(objective => objective.done));
    }
  }
});

test('three consecutive rescues include signals and award exactly two team stars once', () => {
  const run = new SpaceSession(options());
  const friends = run.objects.filter(object => object.kind === 'friend');
  for (let index = 0; index < 3; index++) {
    const friend = friends[index];
    while (run.targetLane > friend.lane) run.act('left');
    while (run.targetLane < friend.lane) run.act('right');
    run.advance(friend.arrivalAt - run.elapsed - 500);
    if (index === 1) run.act('signal');
    run.advance(501);
    assert.equal(run.combo, index + 1);
  }
  assert.equal(run.rescued, 3);
  assert.equal(run.signalledRescues, 1);
  assert.equal(run.comboBonusStars, 2);
  assert.equal(run.bestCombo, 3);
  assert.equal(run.stars, 8);
  assert.match(run.getStatus().feedback ?? '', /별 \+2/);
  assert.match(run.getStatus().detail, /3명 연속/);
  assert.match(run.getStatus().summary, /최고 3명 연속/);
  const reward = run.stars;
  run.act('signal'); run.advance(100);
  assert.equal(run.stars, reward);
  assert.equal(run.comboBonusStars, 2);
});

test('missing a friend breaks the team chain while collected stars and the record remain', () => {
  const run = new SpaceSession(options());
  const friends = run.objects.filter(object => object.kind === 'friend');
  // Make a clear test lane independent of the seeded visual route.
  for (const object of run.objects) {
    if (object.kind === 'meteor') object.lane = 0;
    else object.lane = 1;
  }
  run.advance(friends[2].arrivalAt + 1);
  assert.equal(run.combo, 3);
  assert.equal(run.comboBonusStars, 2);
  const savedStars = run.stars;
  friends[3].lane = 0;
  run.advance(friends[3].arrivalAt - run.elapsed + 1);
  assert.equal(friends[3].outcome, 'missed');
  assert.equal(run.combo, 0);
  assert.equal(run.bestCombo, 3);
  assert.ok(run.stars >= savedStars);
  run.advance(friends[6].arrivalAt - run.elapsed + 1);
  assert.equal(run.combo, 3);
  assert.equal(run.comboBonusStars, 4);
  assert.equal(run.bestCombo, 3);
});

test('a meteor hit breaks a signalled rescue chain, but the earned team bonus is permanent', () => {
  const run = new SpaceSession(options());
  for (const object of run.objects) {
    if (object.kind === 'meteor') object.lane = 0;
    else object.lane = 1;
  }
  const friends = run.objects.filter(object => object.kind === 'friend');
  run.advance(friends[2].arrivalAt + 1);
  assert.equal(run.comboBonusStars, 2);
  run.advance(friends[3].arrivalAt - run.elapsed - 500);
  run.act('signal');
  const meteor = run.objects.find(object => object.kind === 'meteor' && object.wave === 3)!;
  meteor.lane = 1;
  run.advance(501);
  assert.equal(run.rescued, 4);
  assert.equal(run.combo, 0);
  assert.equal(run.bestCombo, 4);
  assert.equal(run.bumps, 1);
  assert.equal(run.comboBonusStars, 2);
  run.advance(SPACE_DURATION_MS);
  const record = [run.combo, run.bestCombo, run.comboBonusStars, run.stars, run.rescued];
  run.act('signal'); run.act('left'); run.advance(100_000);
  assert.deepEqual([run.combo, run.bestCombo, run.comboBonusStars, run.stars, run.rescued], record);
});

test('shielded meteor contact also breaks a chain without adding a second impact', () => {
  const run = new SpaceSession(options());
  for (const object of run.objects) object.lane = object.kind === 'meteor' ? 0 : 1;
  const first = run.nextFriend!;
  const meteor = run.objects.find(object => object.kind === 'meteor' && object.wave === 0)!;
  meteor.lane = 1;
  run.shieldUntil = first.arrivalAt + 100;
  run.advance(first.arrivalAt + 1);
  assert.equal(run.rescued, 1);
  assert.equal(meteor.outcome, 'shielded');
  assert.equal(run.combo, 0);
  assert.equal(run.bestCombo, 1);
  assert.equal(run.bumps, 0);
  assert.equal(run.comboBonusStars, 0);
});

test('a nearby adjacent-lane friend responds to one real signal and cannot be rescued twice', () => {
  const run = new SpaceSession(options());
  const friend = run.nextFriend!;
  const adjacent = friend.lane === 1 ? 0 : 1;
  while (run.targetLane > adjacent) run.act('left');
  while (run.targetLane < adjacent) run.act('right');
  run.advance(friend.arrivalAt - SPACE_SIGNAL_RANGE_MS);
  assert.equal(run.signalTarget, friend);
  assert.match(run.getStatus().detail, /지금 구조 가능/);
  const starsBefore = run.stars;
  run.act('signal');
  assert.equal(run.rescued, 1);
  assert.equal(run.signalledRescues, 1);
  assert.equal(run.signalsRemaining, 2);
  assert.equal(friend.outcome, 'collected');
  assert.equal(run.stars, starsBefore);
  assert.equal(run.signalRescue?.variant, friend.variant);
  run.act('signal');
  assert.equal(run.rescued, 1);
  assert.equal(run.signalsRemaining, 2);
  run.advance(SPACE_SIGNAL_RANGE_MS + 500);
  run.act('signal');
  assert.equal(run.rescued, 1);
  assert.equal(run.signalsRemaining, 2);
});

test('signals have finite time and lane range, with useful feedback and no wasted charge', () => {
  const run = new SpaceSession(options());
  const friend = run.nextFriend!;
  run.act('signal');
  assert.equal(run.rescued, 0);
  assert.equal(run.signalsRemaining, 3);
  assert.match(run.getStatus().feedback ?? '', /가까이/);
  // Force a two-lane separation to test the rescue radius independently of route luck.
  friend.lane = 0;
  run.act('right');
  run.advance(friend.arrivalAt - SPACE_SIGNAL_RANGE_MS / 2);
  assert.equal(run.lane, 2);
  assert.equal(run.signalTarget, undefined);
  run.act('signal');
  assert.equal(friend.outcome, 'pending');
  assert.equal(run.signalsRemaining, 3);
  run.advance(SPACE_SIGNAL_RANGE_MS);
  assert.equal(friend.outcome, 'missed');
  run.act('left'); run.act('left'); run.advance(600);
  run.act('signal');
  assert.equal(run.rescued, 0);
  assert.equal(run.signalsRemaining, 3);
});

test('only three successful signals are available and exhausted signals cannot collect a friend', () => {
  const run = new SpaceSession(options());
  const friends = run.objects.filter(object => object.kind === 'friend');
  for (let index = 0; index < 4; index++) {
    const friend = friends[index];
    run.advance(friend.arrivalAt - run.elapsed - 500);
    assert.equal(run.signalTarget, friend);
    const before = run.rescued;
    run.act('signal');
    if (index < 3) {
      assert.equal(run.rescued, before + 1);
      assert.equal(friend.outcome, 'collected');
    } else {
      assert.equal(run.rescued, before);
      assert.equal(friend.outcome, 'pending');
      assert.match(run.getStatus().feedback ?? '', /다 썼어/);
    }
  }
  assert.equal(run.signalledRescues, 3);
  assert.equal(run.signalsRemaining, 0);
});

test('the space definition exposes the rescue control on touch and Space key', () => {
  const signal = space.controls.find(control => control.action === 'signal');
  assert.equal(signal?.label, '구조 신호');
  assert.ok(signal?.keys.includes('Space'));
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
  run.act('left'); run.act('signal'); run.advance(100_000);
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
  assert.equal(run.getStatus().objectives?.find(objective => objective.id === 'rescue')?.done, false);
  assert.equal(run.getStatus().objectives?.find(objective => objective.id === 'captain')?.done, false);
});
