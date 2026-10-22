import assert from 'node:assert/strict';
import test from 'node:test';
import { KartSession, KART_MAGNET_MS, type KartObject } from '../src/kart-session';

type Item = { kind: KartObject['kind']; lane: number; distance: number };
const stars = (count: number, distance = 100, lane = 1): Item[] =>
  Array.from({ length: count }, (_, index) => ({ kind: 'star', lane, distance: distance + index * 20 }));
function course(run: KartSession, items: Item[]): void {
  run.objects.splice(0, run.objects.length, ...items.map((item, id) => ({ ...item, id, row: id, resolved: false })));
  run.objects.sort((a, b) => a.distance - b.distance || a.id - b.id);
}
function chargedRun(items: Item[] = []): KartSession {
  const run = new KartSession(71342);
  course(run, [...stars(15), ...items]);
  run.advance(2500);
  assert.equal(run.stars, 15); assert.equal(run.magnetCharged, true);
  return run;
}

test('fourteen stars are not a charge, and the fifteenth unique star makes exactly one charge', () => {
  const run = new KartSession(71342);
  course(run, [...stars(14), { kind: 'star', lane: 1, distance: 500 }]);
  run.advance(2000);
  assert.equal(run.stars, 14); assert.equal(run.magnetCharged, false); assert.equal(run.useMagnet(), false);
  const events = run.advance(1000);
  assert.equal(run.stars, 15); assert.equal(run.magnetCharged, true);
  assert.equal(events.filter(event => event.magnetEarned).length, 1);
});

test('fifteen unique stars charge at most one magnet, and repeated activation never stacks time', () => {
  const run = new KartSession(71342);
  course(run, stars(45));
  assert.equal(run.useMagnet(), false);
  const events = run.advance(6000);
  assert.equal(run.stars, 45);
  assert.equal(events.filter(event => event.magnetEarned).length, 1, 'milestones while full do not bank magnets');
  assert.equal(run.useMagnet(), true);
  assert.equal(run.magnetCharged, false);
  assert.ok(Math.abs(run.getProgress().magnetSeconds - KART_MAGNET_MS / 1000) < 1e-8);
  for (let index = 0; index < 30; index++) assert.equal(run.useMagnet(), false);
  assert.equal(run.magnetUses, 1);
  assert.ok(Math.abs(run.getProgress().magnetSeconds - 5) < 1e-8);
  assert.deepEqual(run.advance(10), []);
  assert.equal(run.stars, 45, 'resolved stars do not charge again');
});

test('an active magnet collects all three lanes but counts only additional stars and keeps obstacle collisions local', () => {
  const run = chargedRun([
    { kind: 'star', lane: 0, distance: 600 },
    { kind: 'cone', lane: 0, distance: 625 },
    { kind: 'star', lane: 1, distance: 650 },
    { kind: 'star', lane: 2, distance: 700 },
    { kind: 'hay', lane: 1, distance: 850 },
    { kind: 'star', lane: 0, distance: 1700 },
  ]);
  assert.equal(run.useMagnet(), true);
  const events = run.advance(8000);
  assert.equal(run.stars, 18);
  assert.equal(run.magnetStars, 2, 'a same-lane star is not claimed as an extra magnet reward');
  assert.equal(events.filter(event => event.attracted).length, 2);
  assert.equal(run.saves, 1, 'the actual-lane obstacle still consumes the existing shield');
  assert.equal(run.bumps, 0);
  assert.equal(run.objects.find(object => object.kind === 'cone')!.resolved, false, 'off-lane obstacle is not pulled in');
  assert.equal(run.objects.find(object => object.distance === 1700)!.resolved, false, 'expired magnets do not collect distant-lane stars');
  assert.equal(run.magnetActive, false);
  assert.equal(run.getProgress().magnetSeconds, 0);
  assert.equal(new Set(events.map(event => event.object.id)).size, events.length);
});

test('a fresh fifteen-star milestone can refill during use, while active use remains locked', () => {
  const run = chargedRun(stars(15, 600, 0));
  assert.equal(run.useMagnet(), true);
  const events = run.advance(2600);
  assert.equal(run.stars, 30); assert.equal(run.magnetStars, 15);
  assert.equal(events.filter(event => event.magnetEarned).length, 1);
  assert.equal(run.magnetCharged, true); assert.equal(run.magnetActive, true);
  assert.equal(run.useMagnet(), false);
  run.advance(2500);
  assert.equal(run.magnetActive, false); assert.equal(run.useMagnet(), true);
  assert.equal(run.magnetUses, 2); assert.equal(run.magnetCharged, false);
});

test('pause freezes magnet duration, movement, and rewards, and prevents spending a charge', () => {
  const run = chargedRun([{ kind: 'star', lane: 0, distance: 600 }]);
  run.setPaused(true); assert.equal(run.useMagnet(), false);
  run.setPaused(false); assert.equal(run.useMagnet(), true);
  run.advance(1000); run.setPaused(true);
  const before = run.getProgress(), distance = run.distance;
  assert.deepEqual(run.advance(60_000), []); assert.equal(run.useMagnet(), false);
  assert.deepEqual(run.getProgress(), before); assert.equal(run.distance, distance);
  run.setPaused(false); run.advance(1000);
  assert.ok(Math.abs(run.getProgress().magnetSeconds - 3) < 1e-7);
  assert.equal(run.magnetUses, 1);
});

test('long active frames preserve the magnetic swept route and finish once at exactly sixty seconds', () => {
  const items: Item[] = Array.from({ length: 19 }, (_, index) => ({ kind: 'star', lane: index % 3, distance: 600 + index * 70 }));
  const longFrame = chargedRun(items), smallFrames = chargedRun(items);
  assert.equal(longFrame.useMagnet(), true); assert.equal(smallFrames.useMagnet(), true);
  const events = longFrame.advance(7000);
  for (let index = 0; index < 700; index++) smallFrames.advance(10);
  assert.equal(longFrame.stars, smallFrames.stars); assert.equal(longFrame.magnetStars, smallFrames.magnetStars);
  assert.equal(longFrame.magnetCharged, smallFrames.magnetCharged);
  assert.ok(Math.abs(longFrame.distance - smallFrames.distance) < .05);
  assert.equal(new Set(events.map(event => event.object.id)).size, events.length);
  longFrame.advance(60_000); const result = longFrame.getResult(), distance = longFrame.distance;
  assert.equal(result.elapsed, 60); assert.equal(result.magnetUses, 1);
  assert.equal(longFrame.getProgress().magnetSeconds, 0); assert.equal(longFrame.useMagnet(), false);
  assert.deepEqual(longFrame.advance(60_000), []); assert.deepEqual(longFrame.getResult(), result); assert.equal(longFrame.distance, distance);
});

test('a magnet used near the finish cannot collect after the sixty-second finish or from invalid frames', () => {
  const run = new KartSession(71342);
  course(run, []); run.advance(58_000);
  course(run, stars(15, run.distance + 25)); run.advance(1800);
  assert.equal(run.magnetCharged, true); assert.equal(run.useMagnet(), true);
  const before = run.getProgress();
  for (const delta of [NaN, Infinity, -1, 0]) assert.deepEqual(run.advance(delta), []);
  assert.deepEqual(run.getProgress(), before);
  run.advance(60_000);
  assert.equal(run.finished, true); assert.equal(run.elapsed, 60_000);
  assert.equal(run.getProgress().magnetSeconds, 0); assert.equal(run.useMagnet(), false);
  assert.equal(run.getResult().magnetUses, 1);
});
