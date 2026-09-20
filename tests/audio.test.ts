import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio, MUSIC } from '../src/audio.js';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
class Parameter {
  value = 0;
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
}
class Source {
  gain = new Parameter(); frequency = new Parameter();
  onended?: () => void;
  buffer?: unknown; loop = false; loopStart = 0; loopEnd = 0;
  starts: number[][] = []; stops = 0;
  connect() {} disconnect() {}
  start(...values: number[]) { this.starts.push(values); }
  stop() { this.stops++; }
}
class Context {
  state = 'running'; currentTime = 0; destination = {};
  onstatechange?: () => void;
  sources: Source[] = []; oscillators: Source[] = [];
  createGain() { return new Source(); }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createOscillator() { const source = new Source(); this.oscillators.push(source); return source; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({ duration: 80 }); }
}
function rig(fetchFile: (url: string) => Promise<Response> = async () => new Response(new Uint8Array(4))) {
  const context = new Context();
  const audio = new GameAudio({ createContext: () => context as unknown as AudioContext, fetchFile });
  audio.unlock();
  return { context, audio };
}

test('a late music download cannot start after pause or after returning home', async () => {
  let resolve!: (response: Response) => void;
  const { context, audio } = rig(() => new Promise(r => { resolve = r; }));
  audio.playMusic('challenge'); audio.pause();
  resolve(new Response(new Uint8Array(4))); await flush();
  assert.equal(context.sources.length, 0);
  audio.resume(); await flush();
  assert.equal(context.sources.length, 1);
  audio.tone('record');
  audio.stop(); audio.unlock(); await flush();
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].stops, 1);
  assert.ok(context.oscillators.every(voice => voice.stops === 2));
});
test('rapid retry and mode switching create one music source with the final selected track', async () => {
  const pending: Array<() => void> = [];
  const requested: string[] = [];
  const { context, audio } = rig(url => { requested.push(url); return new Promise(resolve => pending.push(() => resolve(new Response(new Uint8Array(4))))); });
  audio.playMusic('challenge'); audio.playMusic('challenge'); audio.playMusic('practice');
  pending.forEach(resolve => resolve()); await flush();
  assert.equal(requested.length, 2);
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loopEnd, MUSIC.practice.duration);
  assert.equal(audio.status, 'playing');
});
test('pause and mute preserve position; a new game resets it without overlapping sources', async () => {
  const { context, audio } = rig();
  audio.playMusic('challenge'); await flush();
  context.currentTime = 12; audio.pause();
  context.currentTime = 20; audio.resume(); await flush();
  assert.equal(context.sources[1].starts[0][1], 12);
  context.currentTime = 25; audio.setPreferences(false, true);
  context.currentTime = 30; audio.setPreferences(true, true); await flush();
  assert.equal(context.sources[2].starts[0][1], 17);
  audio.playMusic('challenge'); await flush();
  assert.equal(context.sources[3].starts[0][1], 0);
  assert.deepEqual(context.sources.map(source => source.stops), [1,1,1,0]);
});
test('music and effects can be muted separately, including already scheduled effects', async () => {
  const { context, audio } = rig();
  audio.setPreferences(false, true); audio.playMusic('challenge'); audio.tone('record'); await flush();
  assert.equal(context.sources.length, 0);
  assert.equal(context.oscillators.length, 4);
  audio.setPreferences(true, false); await flush();
  assert.equal(context.sources.length, 1);
  assert.ok(context.oscillators.every(voice => voice.stops === 2));
  audio.tone('step');
  assert.equal(context.oscillators.length, 4);
});
test('a failed download is retryable and leaves effects available', async () => {
  let attempt = 0;
  const { context, audio } = rig(async () => ++attempt === 1 ? new Response('', { status: 503 }) : new Response(new Uint8Array(4)));
  audio.playMusic('challenge'); await flush();
  assert.equal(audio.status, 'unavailable');
  audio.tone('step'); await flush();
  assert.equal(context.oscillators.length, 1);
  assert.equal(audio.status, 'playing');
});
test('old muted settings stay muted after adding music and profile records are preserved', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let data = JSON.stringify({ sound: false, profiles: [{ id: 'old', name: '지한', best: 111, practiceBest: 5 }], activeId: 'old' });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => data } });
  try {
    const { loadSaved } = await import('../src/storage.js');
    let saved = loadSaved();
    assert.equal(saved.music, false); assert.equal(saved.sound, false);
    assert.equal(saved.profiles[0].best, 111);
    data = JSON.stringify({ sound: false, music: true });
    saved = loadSaved();
    assert.equal(saved.music, true); assert.equal(saved.sound, false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
