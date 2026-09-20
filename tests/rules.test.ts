import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeSteps, validateRun, normalizeName, type InputEvent, type Direction } from '../functions/src/shared/rules.js';
import { insertScore, type ScoreEntry } from '../functions/src/shared/leaderboard.js';
import { signToken, verifyToken, createApi } from '../functions/src/api.js';
import { FileScoreStore } from '../functions/src/store.js';

function entry(index: number, score = index): ScoreEntry { return { playerKey: `player-${index}`, score, name: `친구${index}`, achievedAt: index, runId: `run-${index}` }; }
function trace(seed: number, length: number): InputEvent[] {
  const steps = makeSteps(seed, length + 1);
  let facing: Direction = 1;
  return steps.slice(1).map((step, i) => {
    const action = step.direction === facing ? 'climb' : 'turn'; facing = step.direction;
    return { action, at: i * 100 + 100 };
  });
}

test('same seed reproduces stairs and all steps stay inside the mobile playfield', () => {
  for (let seed = 0; seed < 40; seed++) {
    const steps = makeSteps(seed, 500);
    assert.deepEqual(steps, makeSteps(seed, 500));
    for (let i = 1; i < steps.length; i++) {
      assert.ok(Math.abs(steps[i].x) <= 3);
      assert.equal(steps[i].x - steps[i - 1].x, steps[i].direction);
    }
  }
});
test('server reconstructs a valid 100-step run rather than trusting a submitted score', () => {
  assert.equal(validateRun(42, trace(42, 100), 11_000), 100);
});
test('incorrect turn, impossible speed, out-of-order events and expired energy are rejected', () => {
  assert.throws(() => validateRun(42, [{ action: 'turn', at: 100 }], 1000));
  assert.throws(() => validateRun(42, [{ action: 'climb', at: 100 }, { action: 'climb', at: 110 }], 1000));
  assert.throws(() => validateRun(42, [{ action: 'climb', at: 200 }, { action: 'climb', at: 100 }], 1000));
  assert.throws(() => validateRun(42, [{ action: 'climb', at: 7000 }], 8000));
  assert.throws(() => validateRun(42, [{ action: 'climb', at: 4000 }], 500));
});
test('names support Korean but reject markup, control characters and excessive length', () => {
  assert.equal(normalizeName('  지한이  '), '지한이');
  for (const name of ['', '<img>', 'a\u0000b', '이름이너무길어서입력할수없어요']) assert.throws(() => normalizeName(name));
});
test('only the highest 100 records survive insertion', () => {
  let rows: ScoreEntry[] = [];
  for (let i = 1; i <= 150; i++) rows = insertScore(rows, entry(i));
  assert.equal(rows.length, 100);
  assert.equal(rows[0].score, 150);
  assert.equal(rows[99].score, 51);
  assert.deepEqual(insertScore(rows, entry(999, 1)), rows);
});
test('one best result per character, including duplicate and lower resubmissions', () => {
  const before = [entry(1, 50), entry(2, 30)];
  assert.deepEqual(insertScore(before, entry(1, 25)), before);
  assert.deepEqual(insertScore(before, { ...entry(1, 50), achievedAt: 999 }), before);
  const after = insertScore(before, entry(2, 70));
  assert.equal(after.length, 2); assert.equal(after[0].playerKey, 'player-2');
});
test('ties retain the record registered earlier and do not evict it at rank 100', () => {
  const rows = Array.from({ length: 100 }, (_, i) => entry(i, 100));
  assert.deepEqual(insertScore(rows, entry(100, 100)), rows);
});
test('signed sessions detect altered payloads and incorrect signing keys', () => {
  const signed = signToken({ kind: 'guest', value: 5 }, 'test-secret');
  assert.deepEqual(verifyToken(signed, 'test-secret'), { kind: 'guest', value: 5 });
  assert.throws(() => verifyToken(signed, 'wrong-secret'));
  assert.throws(() => verifyToken(`e30.${signed.split('.')[1]}`, 'test-secret'));
});
test('concurrent local submissions persist exactly the top 100 without a run archive', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jihan-store-'));
  try {
    const path = join(directory, 'board.json');
    const store = new FileScoreStore(path);
    await Promise.all(Array.from({ length: 180 }, (_, i) => store.update(rows => insertScore(rows, entry(i)))));
    const rows = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(rows.length, 100); assert.equal(rows[0].score, 179); assert.equal(rows[99].score, 80);
    await store.update(values => values.filter(row => row.playerKey !== 'player-179'));
    assert.equal((await store.read()).length, 99);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('API stores verified scores, binds tickets to the guest, hides identifiers, and deletes only owned records', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jihan-api-'));
  const store = new FileScoreStore(join(directory, 'board.json'));
  const secret = 'a-test-only-secret-never-used-in-production';
  const app = createApi({ store, secret, production: false });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  let cookie = '';
  async function post(path: string, body: unknown, suppliedCookie = cookie) {
    return fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: suppliedCookie }, body: JSON.stringify(body) });
  }
  try {
    const initial = await fetch(`${base}/leaderboard`);
    assert.equal(initial.headers.get('set-cookie'), null, 'public reads cannot race and overwrite a new guest cookie');
    const id = randomUUID();
    const startResponse = await post('start', { profileId: id, name: '테스트친구' });
    const ticket = await startResponse.json();
    assert.equal(startResponse.status, 200);
    cookie = startResponse.headers.get('set-cookie')!.split(';')[0];
    const wrongGuest = await post('score', { token: ticket.token, inputs: trace(ticket.seed, 3) }, '');
    assert.equal(wrongGuest.status, 400);
    const valid = await post('score', { token: ticket.token, inputs: trace(ticket.seed, 3), score: 9999999 });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { score: 3, rank: 1 });
    await post('score', { token: ticket.token, inputs: trace(ticket.seed, 3) });
    assert.equal((await store.read()).length, 1);
    const incorrect = await post('score', { token: ticket.token, inputs: [{ action: 'turn', at: 100 }] });
    assert.equal(incorrect.status, 400, 'invalid play is a client validation error, not a server failure');
    const publicRows = await (await fetch(`${base}/leaderboard`)).json();
    assert.equal(publicRows.entries[0].name, '테스트친구');
    assert.equal(publicRows.entries[0].playerKey, undefined);
    assert.equal(publicRows.entries[0].runId, undefined);
    await post('profile/delete', { profileId: id }, '');
    assert.equal((await store.read()).length, 1);
    await post('profile/delete', { profileId: id });
    assert.equal((await store.read()).length, 0);
    const forged = await post('score', { token: ticket.token.replace(/.$/, '!'), inputs: [] });
    assert.equal(forged.status, 400);
    const crossSite = await fetch(`${base}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
    assert.equal(crossSite.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
