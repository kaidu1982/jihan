import assert from 'node:assert/strict';
import test from 'node:test';
import { KartSession, makeKartCourse, type KartObject, type KartDifficulty } from '../src/kart-session';

function setStraightCourse(run: KartSession, items: { kind: KartObject['kind']; distance: number }[]): void {
  run.objects.splice(0, run.objects.length, ...items.map((item, id) => ({ ...item, id, row: id, lane: 1, resolved: false })));
}
const starTrail = (start: number, count: number): { kind: 'star'; distance: number }[] =>
  Array.from({ length: count }, (_, index) => ({ kind: 'star', distance: start + index * 20 }));

test('easy drive is genuinely slower with one obstacle and two open lanes in every spaced row', () => {
  assert.deepEqual(makeKartCourse(71342), makeKartCourse(71342, 'normal'));
  const regular = new KartSession(71342), easy = new KartSession(71342, 'easy');
  assert.equal(regular.getProgress().difficulty, 'normal');
  assert.ok(easy.speed < regular.speed * .8);
  for (const seed of [0, 1, 71342, 0xffffffff, NaN]) {
    const { rows } = makeKartCourse(seed, 'easy');
    let previousLane = 1;
    for (const [index, row] of rows.entries()) {
      assert.equal(row.obstacleLanes.length, 1);
      assert.ok(!row.obstacleLanes.includes(row.safeLane));
      assert.ok(Math.abs(previousLane - row.safeLane) <= 1);
      if (index > 0) assert.ok(row.distance - rows[index - 1].distance > 450);
      previousLane = row.safeLane;
    }
  }
});

test('both drives have a reachable star route, pause without advancing, and finish once at 60 active seconds', () => {
  for (const difficulty of ['easy', 'normal'] satisfies KartDifficulty[]) {
    for (const seed of [1, 71342]) {
      const run = new KartSession(seed, difficulty);
      while (!run.finished) {
        const nextRow = run.rows.find(row => row.distance + 100 > run.distance)!;
        if (nextRow.distance - run.distance < 330) {
          if (run.targetLane > nextRow.safeLane) run.move(-1);
          else if (run.targetLane < nextRow.safeLane) run.move(1);
        }
        if (run.elapsed > 10_000 && run.elapsed < 10_020) {
          run.setPaused(true); const before = run.getProgress(), distance = run.distance;
          run.advance(60_000); run.move(-1);
          assert.deepEqual(run.getProgress(), before); assert.equal(run.distance, distance);
          run.setPaused(false);
        }
        run.advance(16);
      }
      assert.equal(run.bumps, 0); assert.ok(run.stars >= 40);
      assert.deepEqual(run.getResult(), { stars: run.stars, bumps: 0, elapsed: 60, difficulty, saves: 0, magnetStars: 0, magnetUses: 0 });
      const result = run.getResult(); assert.deepEqual(run.advance(60_000), []); assert.deepEqual(run.getResult(), result);
    }
  }
});

test('ten unique stars create one shield that blocks one impact, then later impacts still slow gently', () => {
  const run = new KartSession(71342);
  setStraightCourse(run, [...starTrail(100, 10), { kind: 'cone', distance: 500 }, { kind: 'hay', distance: 850 }]);
  const events = run.advance(5000);
  assert.equal(events.filter(event => event.kind === 'star').length, 10);
  assert.equal(events.filter(event => event.shieldEarned).length, 1);
  assert.equal(events.filter(event => event.kind === 'block').length, 1);
  assert.equal(events.filter(event => event.kind === 'bump').length, 1);
  assert.equal(run.saves, 1); assert.equal(run.bumps, 1); assert.equal(run.shield, false);
  assert.equal(run.slowed, true); assert.equal(run.finished, false);
  assert.equal(new Set(events.map(event => event.object.id)).size, events.length);
  run.advance(60_000); const result = run.getResult();
  assert.equal(result.elapsed, 60); assert.equal(result.saves, 1);
  assert.deepEqual(run.advance(60_000), []); assert.deepEqual(run.getResult(), result);
});

test('a full shield does not stack, a resolved star cannot recharge it, and a fresh ten-star milestone can', () => {
  const run = new KartSession(71342);
  setStraightCourse(run, [...starTrail(100, 20), { kind: 'cone', distance: 700 }, { kind: 'hay', distance: 1050 }, ...starTrail(1400, 10), { kind: 'puddle', distance: 1950 }]);
  const events = run.advance(14_000);
  assert.equal(run.stars, 30);
  assert.equal(events.filter(event => event.shieldEarned).length, 2, 'star 20 does not bank a second shield');
  assert.equal(run.saves, 2); assert.equal(run.bumps, 1);
  assert.equal(run.shield, false);
  assert.deepEqual(run.advance(100), []);
  assert.equal(run.stars, 30); assert.equal(run.shield, false);
});

test('shield protection is frame-independent and freezes during pauses', () => {
  const longFrame = new KartSession(71342), smallFrames = new KartSession(71342);
  const items = [...starTrail(100, 10), { kind: 'cone' as const, distance: 500 }];
  setStraightCourse(longFrame, items); setStraightCourse(smallFrames, items);
  longFrame.advance(2000); for (let index = 0; index < 200; index++) smallFrames.advance(10);
  assert.equal(longFrame.shield, true); assert.equal(smallFrames.shield, true);
  longFrame.setPaused(true); const before = longFrame.getProgress(); longFrame.advance(60_000);
  assert.deepEqual(longFrame.getProgress(), before); longFrame.setPaused(false);
  const blockEvents = longFrame.advance(1500); for (let index = 0; index < 150; index++) smallFrames.advance(10);
  assert.equal(blockEvents.filter(event => event.kind === 'block').length, 1);
  assert.equal(longFrame.saves, smallFrames.saves); assert.equal(longFrame.saves, 1);
  assert.equal(longFrame.bumps, 0); assert.equal(longFrame.slowed, false);
  assert.ok(Math.abs(longFrame.distance - smallFrames.distance) < .05);
});

test('a charged shield only blocks when the visible car reaches the obstacle lane', () => {
  const run = new KartSession(71342);
  setStraightCourse(run, [...starTrail(100, 10), { kind: 'cone', distance: 500 }]);
  run.objects[run.objects.length - 1].lane = 0;
  while (run.distance < 490) run.advance(1);
  assert.equal(run.shield, true);
  run.move(-1); run.advance(8);
  assert.equal(run.shield, true); assert.equal(run.saves, 0);
  run.advance(140);
  assert.equal(run.shield, false); assert.equal(run.saves, 1); assert.equal(run.bumps, 0);
});
