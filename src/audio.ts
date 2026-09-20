import type { Mode } from '../functions/src/shared/rules';

export const MUSIC = {
  challenge: { url: '/audio/cloud-steps-128-v1.m4a', title: '통통 구름', duration: 60 },
  practice: { url: '/audio/cloud-steps-104-v1.m4a', title: '포근한 구름', duration: 960 / 13 },
} as const;
type Tone = 'step' | 'turn' | 'end' | 'record';
export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'muted' | 'unavailable';
type Dependencies = {
  createContext?: () => AudioContext;
  fetchFile?: (url: string) => Promise<Response>;
  onStatus?: (status: MusicStatus) => void;
};

export class GameAudio {
  private context?: AudioContext;
  private effectsGain?: GainNode;
  private source?: AudioBufferSourceNode;
  private sourceGain?: GainNode;
  private voices = new Set<OscillatorNode>();
  private buffers = new Map<Mode, Promise<AudioBuffer>>();
  private musicEnabled = true;
  private effectsEnabled = true;
  private wanted = false;
  private mode: Mode = 'challenge';
  private offset = 0;
  private startedAt = 0;
  private loopDuration = MUSIC.challenge.duration as number;
  private revision = 0;
  private currentStatus: MusicStatus = 'idle';
  constructor(private dependencies: Dependencies = {}) {}
  get status(): MusicStatus { return this.currentStatus; }
  private report(status: MusicStatus): void {
    if (this.currentStatus !== status) { this.currentStatus = status; this.dependencies.onStatus?.(status); }
  }

  /** Call synchronously from a tap, before awaiting the score API or loading a file. */
  unlock(): void {
    if (!this.musicEnabled && !this.effectsEnabled) return;
    try {
      if (!this.context) {
        this.context = (this.dependencies.createContext || (() => new AudioContext()))();
        this.effectsGain = this.context.createGain();
        this.effectsGain.gain.value = this.effectsEnabled ? .85 : 0;
        this.effectsGain.connect(this.context.destination);
        this.context.onstatechange = () => {
          if (this.context?.state === 'running') void this.syncMusic();
          else if (this.source) { this.halt(); this.report('paused'); }
        };
      }
      if (this.context.state !== 'running') void this.context.resume().then(() => this.syncMusic()).catch(() => this.report('unavailable'));
      else void this.syncMusic();
    } catch { this.report('unavailable'); }
  }
  setPreferences(music: boolean, effects: boolean): void {
    this.musicEnabled = music; this.effectsEnabled = effects;
    if (this.effectsGain && this.context) this.effectsGain.gain.setValueAtTime(effects ? .85 : 0, this.context.currentTime);
    if (!effects) this.stopEffects();
    if (!music) { this.halt(); this.report('muted'); }
    else if (this.wanted) void this.syncMusic();
    else this.report(this.offset ? 'paused' : 'idle');
  }
  prepare(mode: Mode): void {
    if (this.musicEnabled && this.context) void this.buffer(mode).catch(() => undefined);
  }
  playMusic(mode: Mode): void {
    this.halt(); this.offset = 0; this.mode = mode; this.wanted = true;
    if (!this.musicEnabled) this.report('muted');
    else void this.syncMusic();
  }
  pause(): void {
    this.wanted = false; this.halt(); this.stopEffects();
    this.report(this.musicEnabled ? 'paused' : 'muted');
  }
  resume(): void {
    this.wanted = true; this.unlock();
    if (this.musicEnabled) void this.syncMusic();
  }
  stop(): void {
    this.wanted = false; this.halt(); this.stopEffects(); this.offset = 0;
    this.report(this.musicEnabled ? 'idle' : 'muted');
  }
  private buffer(mode: Mode): Promise<AudioBuffer> {
    let task = this.buffers.get(mode);
    if (!task) {
      const context = this.context!;
      const fetchFile = this.dependencies.fetchFile || ((url: string) => fetch(url, { cache: 'force-cache', signal: AbortSignal.timeout(15000) }));
      task = fetchFile(MUSIC[mode].url).then(async response => {
        if (!response.ok) throw new Error('Music download failed');
        return context.decodeAudioData(await response.arrayBuffer());
      }).catch(error => { this.buffers.delete(mode); throw error; });
      this.buffers.set(mode, task);
    }
    return task;
  }
  private async syncMusic(): Promise<void> {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.wanted || !this.musicEnabled || this.source) return;
    const revision = ++this.revision;
    const mode = this.mode;
    this.report('loading');
    try {
      const buffer = await this.buffer(mode);
      if (revision !== this.revision || !this.wanted || !this.musicEnabled || context.state !== 'running') return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      this.loopDuration = Math.min(MUSIC[mode].duration, buffer.duration);
      this.offset %= this.loopDuration;
      source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = this.loopDuration;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(.26, context.currentTime + .18);
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      this.startedAt = context.currentTime;
      this.source = source; this.sourceGain = gain;
      source.start(context.currentTime, this.offset);
      this.report('playing');
    } catch {
      if (revision === this.revision && this.wanted) this.report('unavailable');
    }
  }
  private halt(): void {
    this.revision++;
    const context = this.context, source = this.source, gain = this.sourceGain;
    this.source = undefined; this.sourceGain = undefined;
    if (!context || !source) return;
    this.offset = (this.offset + Math.max(0, context.currentTime - this.startedAt)) % this.loopDuration;
    try {
      gain!.gain.cancelScheduledValues(context.currentTime);
      gain!.gain.setValueAtTime(gain!.gain.value, context.currentTime);
      gain!.gain.linearRampToValueAtTime(0, context.currentTime + .025);
      source.stop(context.currentTime + .03);
    } catch { source.disconnect(); gain?.disconnect(); }
  }
  private stopEffects(): void {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices.clear();
  }
  tone(kind: Tone, score = 0): void {
    if (!this.effectsEnabled) return;
    this.unlock();
    const audio = this.context;
    if (!audio || audio.state !== 'running') return;
    try {
      const now = audio.currentTime;
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880];
      const notes = kind === 'record' ? [523.25, 659.25, 783.99, 1046.5] : [kind === 'end' ? 220 : kind === 'turn' ? 392 : pentatonic[score % 5]];
      notes.forEach((frequency, i) => {
        if (this.voices.size >= 12) return;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const time = now + i * .11;
        const duration = kind === 'record' || kind === 'end' ? .24 : .12;
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, time);
        if (kind === 'end') oscillator.frequency.exponentialRampToValueAtTime(130, time + .2);
        gain.gain.setValueAtTime(.0001, time);
        gain.gain.exponentialRampToValueAtTime(.09, time + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
        oscillator.connect(gain); gain.connect(this.effectsGain!);
        oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        this.voices.add(oscillator);
        oscillator.start(time); oscillator.stop(time + duration + .01);
      });
    } catch { /* Audio remains optional; a failed device must not block a game. */ }
  }
}
