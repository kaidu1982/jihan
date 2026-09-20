import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getPlatformProxy } from 'wrangler';
import { D1ScoreStore } from '../worker/store.js';
import { insertScore } from '../functions/src/shared/leaderboard.js';

test('D1 resolves competing revisions, keeps exactly 100 best scores, and does not write losing runs', async () => {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: 'wrangler.jsonc', persist: false, remoteBindings: false });
  try {
    const db = proxy.env.DB;
    const sql = await readFile('migrations/0001_leaderboard.sql', 'utf8');
    for (const statement of sql.split(';').filter(value => value.trim())) await db.prepare(statement).run();
    const store = new D1ScoreStore(db);
    const entry = (i: number, score = i) => ({ playerKey: `test-${i}`, name: `친구${i}`, score, achievedAt: i, runId: `run-${i}` });
    await store.update(() => Array.from({ length: 100 }, (_, i) => entry(100 - i)));
    await Promise.all(Array.from({ length: 24 }, (_, i) => new D1ScoreStore(db).update(rows => insertScore(rows, entry(101 + i)))));
    const rows = await store.read();
    assert.equal(rows.length, 100);
    assert.deepEqual(rows.map(row => row.score), Array.from({ length: 100 }, (_, i) => 124 - i));
    const before = await db.prepare('SELECT revision FROM leaderboards').first('revision');
    await store.update(rows => insertScore(rows, entry(999, 1)));
    await store.update(rows => insertScore(rows, entry(124, 123)));
    assert.equal(await db.prepare('SELECT revision FROM leaderboards').first('revision'), before);
    await store.update(rows => rows.filter(row => row.playerKey !== 'test-124'));
    assert.equal((await store.read()).length, 99);
    assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM leaderboards').first('n'), 1);
    assert.equal(await db.prepare('SELECT json_array_length(entries) AS n FROM leaderboards').first('n'), 99);
  } finally { await proxy.dispose(); }
});
