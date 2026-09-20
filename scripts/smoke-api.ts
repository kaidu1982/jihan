import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { makeSteps, type Direction } from '../functions/src/shared/rules.js';
import { signToken } from '../functions/src/api.js';

const base = process.argv[2] || 'http://localhost:8787';
const secretFile = process.argv[3];
const profileId = randomUUID();
let cookie = '';
const post = (path: string, body: unknown, session = cookie) => fetch(`${base}/api/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: session }, body: JSON.stringify(body),
});
function trace(seed: number, length: number) {
  let facing: Direction = 1;
  return makeSteps(seed, length + 1).slice(1).map((step, i) => {
    const action = step.direction === facing ? 'climb' : 'turn';
    facing = step.direction;
    return { action, at: 100 + i * 60 };
  });
}
try {
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /지한/);
  const initial = await fetch(`${base}/api/leaderboard`);
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get('set-cookie'), null);
  const response = await post('start', { profileId, name: '배포확인' });
  assert.equal(response.status, 200);
  const ticket = await response.json() as { seed: number; token: string };
  const setCookie = response.headers.get('set-cookie')!;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  cookie = setCookie.split(';')[0];
  const body = { token: ticket.token, inputs: trace(ticket.seed, 3), score: 99999999 };
  assert.equal((await post('score', body, '')).status, 400);
  const submitted = await post('score', body);
  assert.equal(submitted.status, 200);
  assert.equal((await submitted.json()).score, 3);
  assert.equal((await post('score', body)).status, 200);
  const board = await (await fetch(`${base}/api/leaderboard?profileId=${profileId}`, { headers: { Cookie: cookie } })).json();
  assert.equal(board.entries.filter((row: { mine: boolean }) => row.mine).length, 1);
  assert.equal(board.entries.find((row: { mine: boolean }) => row.mine).score, 3);
  assert.equal(board.entries[0].playerKey, undefined);
  const bad = await post('score', { token: ticket.token, inputs: [{ action: 'turn', at: 100 }] });
  assert.equal(bad.status, 400);
  const crossSite = await fetch(`${base}/api/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
  assert.equal(crossSite.status, 403);
  if (secretFile) {
    // Operator-only synthetic old ticket avoids waiting five minutes to exercise max-size validation.
    // The running service has no test endpoint or alternate authentication path.
    const source = await readFile(secretFile, 'utf8');
    const secret = secretFile.endsWith('.json') ? JSON.parse(source).SESSION_SECRET : source.match(/^SESSION_SECRET=(.+)$/m)![1];
    const payload = JSON.parse(Buffer.from(ticket.token.split('.')[0], 'base64url').toString());
    const maximum = { ...payload, issuedAt: Date.now() - 310_000, runId: randomUUID() };
    const maxResponse = await post('score', { token: signToken(maximum, secret), inputs: trace(ticket.seed, 5000) });
    assert.equal(maxResponse.status, 200, 'maximum-length trace must fit the runtime limits');
    assert.equal((await maxResponse.json()).score, 5000);
  }
  console.log('PASS: static page, guest cookie, verified score, ownership, duplicates, invalid input, cross-site protection' + (secretFile ? ', 5000-step validation' : ''));
} finally {
  if (cookie) {
    const cleanup = await post('profile/delete', { profileId });
    assert.equal(cleanup.status, 200);
    const board = await (await fetch(`${base}/api/leaderboard?profileId=${profileId}`, { headers: { Cookie: cookie } })).json();
    assert.ok(board.entries.every((row: { mine: boolean }) => !row.mine));
    console.log('PASS: temporary test record removed');
  }
}
