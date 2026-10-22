import test from 'node:test';
import assert from 'node:assert/strict';
import { CrossingSession, makeCrossingCourse, CROSSING_MOVE_MS, CROSSING_TRAIN_CLEAR_MS, CROSSING_TRAIN_WARNING_MS, CROSSING_TRAIN_PASS_MS, CROSSING_WALK_MS, CROSSING_FLASH_MS, CROSSING_TRAFFIC_MS, CROSSING_COLUMNS } from '../src/crossing-session';

/** Look across the entire road block before leaving its safe grass checkpoint. */
function clearSegment(run: CrossingSession, endRow: number): boolean {
  for (let row = run.row; row < endRow; row++) {
    for (let offset = 8; offset <= 152; offset += 8) {
      const time = Math.min(offset, 150), visualRow = row + Math.min(1, time / CROSSING_MOVE_MS);
      for (const lane of run.rows) {
        if (Math.abs(visualRow - lane.index) > .32) continue;
        if (run.hazards(lane, run.elapsed + (row - run.row) * 150 + time)
          .some(hazard => Math.abs(hazard.center - run.column) < hazard.width / 2 + .27)) return false;
      }
    }
  }
  return true;
}
function walkTo(run: CrossingSession, endRow = run.goal): void {
  while (!run.finished && run.row < endRow && run.elapsed < 180_000) {
    const next = run.rows.find(row => row.index > run.row && (row.kind === 'grass' || row.kind === 'finish'))!;
    const nextRow = Math.min(next.index, endRow);
    const coin = run.coins.find(item => item.row === nextRow);
    if (coin) while (run.column !== coin.column) { run.act(run.column < coin.column ? 'right' : 'left'); run.advance(150); }
    while (!clearSegment(run, nextRow) && run.elapsed < 180_000) run.advance(80);
    for (let count = nextRow - run.row; count > 0; count--) { run.act('up'); run.advance(150); }
  }
}
function signalTime(run: CrossingSession, phase: 'clear' | 'warning' | 'passing', intoPhase = 0): number {
  const rail = run.rows.find(row => row.kind === 'rail')!;
  const clearEnds = CROSSING_TRAIN_CLEAR_MS - rail.phase * 550;
  return phase === 'clear' ? clearEnds - CROSSING_TRAIN_CLEAR_MS / 2
    : phase === 'warning' ? clearEnds + intoPhase : clearEnds + CROSSING_TRAIN_WARNING_MS + intoPhase;
}

test('crossing villages reproduce traffic and separate roads with safe checkpoint grass', () => {
  assert.deepEqual(makeCrossingCourse(91), makeCrossingCourse(91));
  assert.notDeepEqual(makeCrossingCourse(91), makeCrossingCourse(92));
  for (let level = 0; level < 3; level++) {
    const run = new CrossingSession({ seed: 91, level, character: 'chick' });
    assert.equal(run.rows[0].kind, 'grass'); assert.equal(run.rows[1].kind, 'grass'); assert.equal(run.rows.at(-1)!.kind, 'finish');
    assert.equal(run.rows[2].kind, 'crosswalk'); assert.equal(run.rows[3].kind, 'grass');
    assert.ok(run.rows.every(row => row.gap - row.width > 4));
    const railIndices = run.rows.filter(row => row.kind === 'rail').map(row => row.index);
    assert.deepEqual(railIndices, level === 0 ? [] : level === 1 ? [6] : [6, 14]);
    for (const index of railIndices) assert.equal(run.rows[index - 1].kind, 'grass');
  }
});
test('every village allows all three medals by watching actual cars and trains from grass checkpoints', () => {
  for (const level of [0, 1, 2]) for (const seed of [1, 91, 0xffffffff]) {
    const run = new CrossingSession({ seed, level, character: 'chick' });
    walkTo(run);
    assert.equal(run.finished, true); assert.equal(run.mistakes, 0); assert.equal(run.getStatus().progress, 1);
    assert.equal(run.getStatus().objectives?.length, 3);
    assert.equal(run.getStatus().objectives?.every(objective => objective.done), true);
  }
});
test('an impact returns to the last grass without ending the game or losing collected stars', () => {
  const run = new CrossingSession(91); walkTo(run, 4);
  const stars = run.stars, column = run.column;
  run.act('up'); run.advance(150);
  const road = run.rows[5];
  if (run.mistakes === 0) run.advance(12000);
  assert.ok(run.mistakes >= 1); assert.equal(run.row, 4); assert.equal(run.column, column); assert.equal(run.finished, false); assert.equal(run.stars, stars);
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
  walkTo(run);
  assert.equal(run.finished, true); const before = run.getStatus(), elapsed = run.elapsed;
  run.advance(50000); run.act('down'); assert.deepEqual(run.getStatus(), before); assert.equal(run.elapsed, elapsed); assert.ok(run.stars >= 5);
});

test('train signals repeat a long clear period, two-second warning, and a moving train pass', () => {
  const run = new CrossingSession({ seed: 91, level: 2, character: 'chick' }), rail = run.rows[6];
  const clear = signalTime(run, 'clear'), warning = signalTime(run, 'warning'), passing = signalTime(run, 'passing');
  assert.equal(run.trainState(run.rows[5]), undefined);
  assert.equal(run.trainState(rail, clear)?.phase, 'clear');
  assert.equal(run.trainState(rail, warning + 1)?.phase, 'warning');
  assert.ok(Math.abs(run.trainState(rail, warning)?.remainingMs! - 2000) < 1e-6);
  assert.deepEqual(run.hazards(rail, warning + 1000), []);
  assert.equal(run.trainState(rail, passing + 1)?.phase, 'passing');
  const a = run.trainState(rail, passing + 100)!, b = run.trainState(rail, passing + 1100)!;
  assert.ok(a.center! > b.center!);
  assert.equal(run.hazards(rail, passing + 600)[0].kind, 'train');
  assert.equal(run.hazards(rail, passing + 600)[0].center, run.trainState(rail, passing + 600)?.center);
  assert.equal(run.trainState(rail, passing + CROSSING_TRAIN_PASS_MS + 1)?.phase, 'clear');
  assert.ok(run.trainState(rail, passing + CROSSING_TRAIN_PASS_MS + 1)!.remainingMs > 5500);
  assert.deepEqual(run.trainState(rail, warning + 250), new CrossingSession({ seed: 91, level: 2, character: 'chick' }).trainState(rail, warning + 250));
});

test('warning alone is harmless; actual passing train impact returns to the grass checkpoint with stars intact', () => {
  const run = new CrossingSession({ seed: 91, level: 1, character: 'chick' });
  walkTo(run, 5);
  assert.equal(run.row, 5); assert.equal(run.mistakes, 0);
  const stars = run.stars, rail = run.rows[6], checkpointColumn = run.column;
  const cycle = CROSSING_TRAIN_CLEAR_MS + CROSSING_TRAIN_WARNING_MS + CROSSING_TRAIN_PASS_MS;
  let warning = signalTime(run, 'warning', 100);
  while (warning <= run.elapsed) warning += cycle;
  run.advance(warning - run.elapsed);
  assert.match(run.getStatus().detail, /기차가 곧 와요/);
  run.act('up'); run.advance(150);
  assert.equal(run.row, 6); assert.equal(run.mistakes, 0);
  assert.equal(run.trainState(rail)?.phase, 'warning');
  assert.match(run.getStatus().detail, /멈추지 말고 풀밭으로/);
  run.advance(2500);
  assert.equal(run.mistakes, 1); assert.equal(run.row, 5); assert.equal(run.column, checkpointColumn);
  assert.equal(run.stars, stars); assert.equal(run.protected, true); assert.equal(run.finished, false);
  run.advance(2000);
  assert.equal(run.mistakes, 1); assert.equal(run.protected, false);
  assert.equal(run.rows[run.row].kind, 'grass');
});

test('red signal status changes while waiting safely and an empty part of a passing rail is not a phantom hit', () => {
  const run = new CrossingSession({ seed: 91, level: 1, character: 'chick' });
  walkTo(run, 5);
  const cycle = CROSSING_TRAIN_CLEAR_MS + CROSSING_TRAIN_WARNING_MS + CROSSING_TRAIN_PASS_MS;
  let passing = signalTime(run, 'passing'); while (passing <= run.elapsed) passing += cycle;
  run.advance(passing - run.elapsed);
  assert.match(run.getStatus().detail, /기차가 지나가요/);
  const stars = run.stars;
  run.advance(CROSSING_TRAIN_PASS_MS);
  assert.equal(run.row, 5); assert.equal(run.stars, stars); assert.equal(run.mistakes, 0);
  assert.match(run.getStatus().detail, /초록불/);
  // At the end of the next pass the train has left the current column, so crossing is safe.
  run.advance(cycle - 200);
  assert.equal(run.trainState(run.rows[6])?.phase, 'passing');
  assert.ok(run.hazards(run.rows[6]).every(hazard => Math.abs(hazard.center - run.column) > hazard.width / 2 + .22));
  run.act('up'); run.advance(150);
  assert.equal(run.row, 6); assert.equal(run.mistakes, 0);
});

test('the careful crossing medal needs completion and no more than two mistakes', () => {
  const run = new CrossingSession(91);
  assert.equal(run.getStatus().objectives?.find(item => item.id === 'careful')?.done, false);
  run.mistakes = 3;
  walkTo(run);
  assert.equal(run.finished, true);
  assert.equal(run.getStatus().objectives?.find(item => item.id === 'finish')?.done, true);
  assert.equal(run.getStatus().objectives?.find(item => item.id === 'star-path')?.done, true);
  assert.equal(run.getStatus().objectives?.find(item => item.id === 'careful')?.done, false);
});

test('pedestrian signals begin with time to cross and repeat green, flashing, then vehicle phases', () => {
  for (const seed of [1, 91, 0xffffffff]) {
    const run = new CrossingSession(seed), row = run.rows[2];
    const offset = row.phase * 250;
    assert.equal(run.signalState(run.rows[1]), undefined);
    assert.equal(run.signalState(row)?.phase, 'walk');
    assert.ok(run.signalState(row)!.remainingMs > 5500);
    const flashStart = CROSSING_WALK_MS - offset, trafficStart = flashStart + CROSSING_FLASH_MS;
    const cycle = CROSSING_WALK_MS + CROSSING_FLASH_MS + CROSSING_TRAFFIC_MS;
    assert.equal(run.signalState(row, flashStart - 1)?.phase, 'walk');
    assert.equal(run.signalState(row, flashStart + 1)?.phase, 'flashing');
    assert.equal(run.signalState(row, trafficStart - 1)?.phase, 'flashing');
    assert.equal(run.signalState(row, trafficStart + 1)?.phase, 'traffic');
    assert.equal(run.signalState(row, trafficStart + CROSSING_TRAFFIC_MS - 1)?.phase, 'traffic');
    assert.equal(run.signalState(row, trafficStart + CROSSING_TRAFFIC_MS + 1)?.phase, 'walk');
    for (const time of [0, flashStart + 10, trafficStart + 1000]) {
      const a = run.signalState(row, time)!, b = run.signalState(row, time + cycle)!;
      assert.equal(a.phase, b.phase);
      assert.ok(Math.abs(a.remainingMs - b.remainingMs) < 1e-6);
      if (a.center !== undefined) assert.ok(Math.abs(a.center - b.center!) < 1e-6);
      assert.deepEqual(a, new CrossingSession(seed).signalState(row, time));
    }
    assert.deepEqual(run.hazards(row, flashStart - 1), []);
    assert.deepEqual(run.hazards(row, trafficStart - 1), []);
  }
});

test('crosswalk traffic enters and leaves beyond the canvas and every hazard matches its moving car', () => {
  const run = new CrossingSession(91), row = run.rows[2];
  const start = CROSSING_WALK_MS + CROSSING_FLASH_MS - row.phase * 250;
  const entry = run.signalState(row, start + .01)!, exit = run.signalState(row, start + CROSSING_TRAFFIC_MS - .01)!;
  assert.ok(38 + (entry.center! - row.width / 2) * 49 > 420, 'the full car enters from beyond the right edge');
  assert.ok(38 + (exit.center! + row.width / 2) * 49 < 0, 'the full car leaves beyond the left edge');
  let previous = entry.center!;
  for (let offset = 100; offset < CROSSING_TRAFFIC_MS; offset += 100) {
    const state = run.signalState(row, start + offset)!;
    assert.ok(state.center! < previous);
    assert.ok(previous - state.center! < .25, 'the car moves continuously rather than jumping between columns');
    assert.equal(run.hazards(row, start + offset).length, 1);
    assert.deepEqual(run.cars(row, start + offset), [state.center]);
    assert.deepEqual(run.hazards(row, start + offset)[0], { kind: 'car', center: state.center, width: row.width });
    previous = state.center!;
  }
  assert.ok(entry.center! > CROSSING_COLUMNS);
});

test('flashing is physically clear, while a vehicle signal collides only when its actual car arrives', () => {
  const run = new CrossingSession(91), crossing = run.rows[2];
  walkTo(run, 1);
  const stars = run.stars;
  const flashStart = CROSSING_WALK_MS - crossing.phase * 250;
  run.advance(flashStart + 100 - run.elapsed);
  assert.match(run.getStatus().detail, /깜빡여요/);
  run.act('up'); run.advance(150);
  assert.equal(run.row, 2); assert.equal(run.mistakes, 0);
  assert.match(run.getStatus().detail, /멈추지 말고 다음 풀밭/);
  run.act('down'); run.advance(150);
  const trafficStart = flashStart + CROSSING_FLASH_MS;
  run.advance(trafficStart + 1 - run.elapsed);
  assert.match(run.getStatus().detail, /차량 신호/);
  run.act('up'); run.advance(150);
  assert.equal(run.row, 2); assert.equal(run.mistakes, 0, 'a red light alone is not an impact');
  run.advance(3200);
  assert.equal(run.mistakes, 1); assert.equal(run.row, 1); assert.equal(run.column, 3);
  assert.equal(run.stars, stars); assert.equal(run.finished, false);
  run.advance(2000);
  assert.equal(run.mistakes, 1, 'waiting on checkpoint grass stays safe');
});

test('crosswalk signals, cars and progress stay frozen after reaching the village', () => {
  const run = new CrossingSession(91);
  walkTo(run);
  const row = run.rows[2], signal = run.signalState(row), cars = run.cars(row), status = run.getStatus();
  run.advance(CROSSING_WALK_MS + CROSSING_FLASH_MS + CROSSING_TRAFFIC_MS);
  run.act('down');
  assert.deepEqual(run.signalState(row), signal);
  assert.deepEqual(run.cars(row), cars);
  assert.deepEqual(run.getStatus(), status);
});
