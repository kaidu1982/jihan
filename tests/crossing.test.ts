import test from 'node:test';
import assert from 'node:assert/strict';
import { CrossingSession, makeCrossingCourse, CROSSING_MOVE_MS } from '../src/crossing-session';

test('crossing villages reproduce traffic and separate roads with safe checkpoint grass', () => {
  assert.deepEqual(makeCrossingCourse(91), makeCrossingCourse(91));
  assert.notDeepEqual(makeCrossingCourse(91), makeCrossingCourse(92));
  for (let level = 0; level < 3; level++) {
    const run = new CrossingSession({ seed: 91, level, character: 'chick' });
    assert.equal(run.rows[0].kind, 'grass'); assert.equal(run.rows[1].kind, 'grass'); assert.equal(run.rows.at(-1)!.kind, 'finish');
    assert.ok(run.rows.every(row => row.gap - row.width > 4));
  }
});
test('every village offers a reachable collision-free path when watching traffic', () => {
  for (const level of [0, 1, 2]) for (const seed of [1, 91, 0xffffffff]) {
    const run = new CrossingSession({ seed, level, character: 'chick' });
    while (!run.finished && run.elapsed < 180_000) {
      const row = run.rows[run.row + 1];
      const clear = [0, 75, 145, 200].every(offset => run.cars(row, run.elapsed + offset).every(car => Math.abs(car - run.column) > row.width / 2 + .35));
      if (clear) { run.act('up'); run.advance(CROSSING_MOVE_MS + 1); }
      else run.advance(80);
    }
    assert.equal(run.finished, true); assert.equal(run.mistakes, 0); assert.equal(run.getStatus().progress, 1);
  }
});
test('an impact returns to the last grass without ending the game or losing collected stars', () => {
  const run = new CrossingSession(91); run.act('up'); run.advance(150);
  assert.equal(run.stars, 2);
  run.act('up'); run.advance(150);
  const road = run.rows[2];
  if (run.mistakes === 0) run.advance(12000);
  assert.ok(run.mistakes >= 1); assert.equal(run.row, 1); assert.equal(run.column, 3); assert.equal(run.finished, false); assert.equal(run.stars, 2);
  run.advance(2000); assert.equal(run.mistakes, 1); assert.equal(run.rows[run.row].kind, 'grass'); assert.ok(road.kind === 'road');
});
test('movement interpolates; boundaries, invalid deltas, and returning to coins never grant extras', () => {
  const run = new CrossingSession(91);
  run.act('up'); run.advance(70); assert.ok(run.visualRow > 0 && run.visualRow < 1);
  run.advance(80); assert.equal(run.row, 1); assert.equal(run.stars, 2);
  run.act('down'); run.advance(150); run.act('up'); run.advance(150); assert.equal(run.stars, 2);
  run.act('down'); run.advance(150); run.act('down'); assert.equal(run.row, 0);
  const elapsed = run.elapsed; for (const delta of [-1, NaN, Infinity, 0]) run.advance(delta); assert.equal(run.elapsed, elapsed);
});
test('finished villages freeze traffic, controls, and the one-time completion reward', () => {
  const run = new CrossingSession(91);
  while (!run.finished && run.elapsed < 180_000) {
    const row = run.rows[run.row + 1];
    if ([0, 100, 200].every(offset => run.cars(row, run.elapsed + offset).every(car => Math.abs(car - run.column) > row.width / 2 + .4))) { run.act('up'); run.advance(150); }
    else run.advance(80);
  }
  assert.equal(run.finished, true); const before = run.getStatus(), elapsed = run.elapsed;
  run.advance(50000); run.act('down'); assert.deepEqual(run.getStatus(), before); assert.equal(run.elapsed, elapsed); assert.ok(run.stars >= 5);
});
