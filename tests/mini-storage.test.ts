import test from 'node:test';
import assert from 'node:assert/strict';
import { MiniProgressStore, deleteMiniProgress, MINI_STORAGE_KEY } from '../src/mini-storage';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
test('completed runs persist once and keep all four games and players independent', () => {
  const storage = memory(), store = new MiniProgressStore(storage);
  store.award('지한이', 'dino', 'first', 20, 900);
  assert.equal(store.award('지한이', 'dino', 'first', 20, 900).duplicate, true);
  store.award('지한이', 'space', 'space', 3, 5);
  store.award('친구', 'dino', 'friend', 7, 200);
  const reloaded = new MiniProgressStore(storage);
  assert.equal(reloaded.get('지한이', 'dino').wallet, 20);
  assert.equal(reloaded.get('지한이', 'dino').runs, 1);
  assert.equal(reloaded.get('지한이', 'space').best, 5);
  assert.equal(reloaded.get('친구', 'dino').wallet, 7);
  assert.equal(reloaded.get('지한이', 'crossing').runs, 0);
});
test('character unlocks spend earned stars once and maze records keep the fewest steps', () => {
  const store = new MiniProgressStore(memory());
  assert.equal(store.chooseCharacter('지한이', 'dino', 'blue', 15), 'insufficient');
  store.award('지한이', 'dino', 'first', 20, 100);
  assert.equal(store.chooseCharacter('지한이', 'dino', 'blue', 15), 'purchased');
  assert.equal(store.chooseCharacter('지한이', 'dino', 'blue', 15), 'selected');
  assert.equal(store.get('지한이', 'dino').wallet, 5);
  store.award('지한이', 'maze', 'a', 5, 30);
  store.award('지한이', 'maze', 'b', 5, 20);
  store.award('지한이', 'maze', 'c', 5, 40);
  assert.equal(store.get('지한이', 'maze').best, 20);
  const copy = store.get('지한이', 'dino'); copy.owned.push('fake');
  assert.equal(store.get('지한이', 'dino').owned.includes('fake'), false);
});
test('storage failure keeps in-memory rewards and receipts without double awards on recovery', () => {
  let blocked = true, raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (blocked) throw new Error('full'); raw = value; } };
  const store = new MiniProgressStore(storage);
  assert.equal(store.award('지한이', 'space', 'a', 12, 4).stored, false);
  blocked = false; store.selectStage('지한이', 'space', 1);
  assert.equal(store.award('지한이', 'space', 'a', 12, 4).duplicate, true);
  assert.equal(new MiniProgressStore(storage).get('지한이', 'space').wallet, 12);
});
test('corrupt saves normalize safely; deleting a character retains other names and games', () => {
  const storage = memory(); storage.setItem(MINI_STORAGE_KEY, '{broken');
  const store = new MiniProgressStore(storage);
  assert.equal(store.available, false);
  store.award('지한이', 'maze', 'a', 8, 20); store.award('지한이', 'space', 'b', 5, 2); store.award('친구', 'dino', 'c', 9, 500);
  assert.equal(deleteMiniProgress('지한이', storage), true);
  const reloaded = new MiniProgressStore(storage);
  assert.equal(reloaded.get('지한이', 'maze').runs, 0);
  assert.equal(reloaded.get('지한이', 'space').runs, 0);
  assert.equal(reloaded.get('친구', 'dino').wallet, 9);
});
