import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteKartProgress, KART_STORAGE_KEY } from '../src/kart-storage';

test('deleting a shared character clears current and legacy kart records while retaining other drivers', () => {
  let raw = JSON.stringify({ version: 1, records: { 'old-id': { wallet: 9 }, 'name:지한이': { wallet: 24 }, 'name:친구': { wallet: 35 } } });
  const storage = { getItem: (key: string) => key === KART_STORAGE_KEY ? raw : null, setItem: (_key: string, value: string) => { raw = value; } };
  assert.equal(deleteKartProgress('old-id', '지한이', storage), true);
  assert.deepEqual(JSON.parse(raw), { version: 1, records: { 'name:친구': { wallet: 35 } } });
  assert.equal(deleteKartProgress('old-id', '지한이', storage), true);
});

test('blocked or corrupt kart storage reports deletion failure without replacing other data', () => {
  let writes = 0;
  const corrupt = { getItem: () => '{broken', setItem: () => { writes++; } };
  assert.equal(deleteKartProgress('id', '지한이', corrupt), false);
  assert.equal(writes, 0);
  const blocked = { getItem: () => JSON.stringify({ records: { 'name:지한이': {} } }), setItem: () => { throw new Error('full'); } };
  assert.equal(deleteKartProgress('id', '지한이', blocked), false);
  assert.equal(deleteKartProgress('id', '지한이', { getItem: () => null, setItem: () => { writes++; } }), true);
  assert.equal(writes, 0);
});
