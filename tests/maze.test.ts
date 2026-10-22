import assert from 'node:assert/strict';
import test from 'node:test';
import mazeDefinition from '../src/maze';
import { MazeSession, getMazePath, isMazePath, makeMaze, sameMazePoint, type MazePoint } from '../src/maze-session';
import type { MiniAction } from '../src/mini-types';

function direction(from: MazePoint, to: MazePoint): MiniAction {
  return to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up';
}

function walk(session: MazeSession, target: MazePoint): void {
  const route = getMazePath(session.maze, session.position, target);
  assert.ok(route.length, 'target has a reachable route');
  for (const next of route.slice(1)) session.act(direction(session.position, next));
}

test('all three seeded maze gardens have connected paths, reachable distinct goals, and route gems', () => {
  assert.deepEqual(makeMaze(312, 0), makeMaze(312, 0));
  assert.notDeepEqual(makeMaze(312, 0).tiles, makeMaze(913, 0).tiles);
  assert.deepEqual(makeMaze(NaN, NaN), makeMaze(NaN, NaN));
  for (let level = 0; level < 3; level++) for (const seed of [0, 1, 2, 3, 17, 127, 73129, 0xffffffff, NaN]) {
    const maze = makeMaze(seed, level);
    assert.equal(maze.size, 7 + level * 2);
    assert.equal(maze.gems.length, 3 + level);
    assert.ok(!sameMazePoint(maze.start, maze.key));
    assert.ok(!sameMazePoint(maze.key, maze.chest));
    assert.ok(!sameMazePoint(maze.start, maze.chest));
    assert.equal(maze.tiles[0], '#'.repeat(maze.size));
    assert.equal(maze.tiles[maze.size - 1], '#'.repeat(maze.size));
    for (let y = 0; y < maze.size; y++) for (let x = 0; x < maze.size; x++) {
      if (isMazePath(maze, { x, y })) assert.ok(getMazePath(maze, maze.start, { x, y }).length, `path ${x},${y} is reachable`);
      if (x === 0 || x === maze.size - 1) assert.equal(maze.tiles[y][x], '#');
    }
    const keyRoute = getMazePath(maze, maze.start, maze.key), treasureRoute = getMazePath(maze, maze.key, maze.chest);
    const completeRoute = [...keyRoute, ...treasureRoute];
    for (const gem of maze.gems) assert.ok(completeRoute.some(point => sameMazePoint(point, gem)), 'each gem lies on the complete treasure route');
    assert.equal(new Set(maze.gems.map(point => `${point.x},${point.y}`)).size, maze.gems.length);
    assert.ok(!getMazePath(maze, maze.start, maze.chest).some(point => sameMazePoint(point, maze.key)), 'chest can be found while still locked');
  }
});

test('garden walls give gentle feedback without spending steps or moving the explorer', () => {
  const run = new MazeSession({ seed: 312, level: 0, character: 'child' });
  const before = { ...run.position }, stars = run.stars;
  run.act('up'); run.act('left');
  assert.deepEqual(run.position, before);
  assert.equal(run.steps, 0);
  assert.equal(run.stars, stars);
  assert.match(run.getStatus().feedback!, /울타리/);
  assert.equal(run.getStatus().finished, false);
  run.act('jump');
  assert.equal(run.steps, 0);
});

test('the treasure chest stays locked until the actual key is collected', () => {
  for (let level = 0; level < 3; level++) {
    const run = new MazeSession({ seed: 312, level });
    walk(run, run.maze.chest);
    assert.equal(run.hasKey, false);
    assert.equal(run.finished, false);
    assert.match(run.getStatus().feedback!, /열쇠가 필요/);
    const starsAtLockedChest = run.stars;
    walk(run, run.maze.key);
    assert.equal(run.hasKey, true);
    assert.equal(run.finished, false);
    assert.ok(run.stars >= starsAtLockedChest);
    walk(run, run.maze.chest);
    assert.equal(run.finished, true);
    assert.equal(run.getStatus().won, true);
    assert.equal(run.getStatus().progress, 1);
  }
});

test('following key and chest routes completes every garden with each gem and reward exactly once', () => {
  for (const seed of [0, 1, 73129, 0xffffffff]) for (let level = 0; level < 3; level++) {
    const run = new MazeSession({ seed, level, character: 'fox' });
    const keyRoute = getMazePath(run.maze, run.position, run.maze.key);
    const chestRoute = getMazePath(run.maze, run.maze.key, run.maze.chest);
    walk(run, run.maze.key);
    assert.equal(run.hasKey, true);
    walk(run, run.maze.chest);
    assert.equal(run.steps, keyRoute.length + chestRoute.length - 2);
    assert.equal(run.getStatus().score, run.steps);
    assert.equal(run.collectedGems.size, 3 + level);
    assert.equal(run.getStatus().stars, 8 + level);
    assert.match(run.getStatus().summary, /완주/);
    const status = run.getStatus(), position = { ...run.position }, elapsed = run.elapsed;
    for (const action of ['left', 'right', 'up', 'down', 'hint'] as const) run.act(action);
    run.advance(999_999);
    assert.deepEqual(run.getStatus(), status);
    assert.deepEqual(run.position, position);
    assert.equal(run.elapsed, elapsed);
  }
});

test('returning to a gem cannot award it twice, and there is no time limit', () => {
  const run = new MazeSession({ seed: 312, level: 1 });
  const gem = run.maze.gems[0];
  walk(run, gem);
  const stars = run.stars;
  assert.ok(stars > 0);
  const previous = { ...run.previousPosition };
  walk(run, previous); walk(run, gem);
  assert.equal(run.stars, stars);
  const status = run.getStatus(), position = { ...run.position };
  run.advance(60 * 60 * 1000);
  assert.equal(run.finished, false);
  assert.equal(run.stars, status.stars);
  assert.equal(run.steps, status.score);
  assert.deepEqual(run.position, position);
});

test('free hints announce a valid next direction without changing steps, position, or rewards', () => {
  const run = new MazeSession({ seed: 312, level: 2, character: 'bunny' });
  const before = { ...run.position }, stars = run.stars;
  run.act('hint');
  assert.deepEqual(run.position, before);
  assert.equal(run.steps, 0);
  assert.equal(run.stars, stars);
  assert.deepEqual(run.hintPath, getMazePath(run.maze, before, run.maze.key).slice(0, 5));
  assert.match(run.getStatus().feedback!, /다음은 (오른쪽|왼쪽|위쪽|아래쪽)이에요/);
  assert.ok(run.hintPath.length > 1);
  run.act(direction(run.position, run.hintPath[1]));
  assert.equal(run.steps, 1);
  assert.ok(run.hintPath.every(point => isMazePath(run.maze, point)));
  walk(run, run.maze.key);
  run.act('hint');
  assert.deepEqual(run.hintPath, getMazePath(run.maze, run.position, run.maze.chest).slice(0, 5));
  run.advance(5001);
  assert.deepEqual(run.hintPath, []);
});

test('invalid frame durations leave every piece of maze state unchanged', () => {
  const run = new MazeSession({ seed: 0, level: NaN, character: 'unknown' });
  assert.equal(run.level, 0);
  assert.equal(run.character, 'child');
  run.act('hint');
  const before = JSON.stringify(run), status = run.getStatus();
  for (const delta of [NaN, Infinity, -Infinity, 0, -100]) run.advance(delta);
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(run.getStatus(), status);
  assert.deepEqual(getMazePath(run.maze, { x: 0, y: 0 }, run.maze.key), []);
});

test('the maze definition supplies complete stages, characters and every direction plus a free hint', () => {
  assert.equal(mazeDefinition.id, 'maze');
  assert.equal(mazeDefinition.scoreUnit, '걸음');
  assert.equal(mazeDefinition.stages!.length, 3);
  assert.equal(mazeDefinition.characters!.length, 3);
  assert.deepEqual(mazeDefinition.characters!.map(character => character.cost), [0, 10, 20]);
  for (const action of ['up', 'down', 'left', 'right', 'hint']) assert.ok(mazeDefinition.controls.some(control => control.action === action));
  assert.ok(mazeDefinition.create({ seed: 0, level: 0, character: 'child' }) instanceof MazeSession);
});
