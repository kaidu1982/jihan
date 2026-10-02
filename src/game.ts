import Phaser from 'phaser';
import { MAX_ENERGY, type Action, type Direction, type Mode } from '../functions/src/shared/rules';
import type { CompanionId, WorldId } from './content';
import { StairSession, type RunOptions, type RunProgress, type RunResult } from './game-session';
import { drawCompanion, drawWorld, star, WORLD_ART } from './world-renderer';

export type { RunOptions, RunProgress, RunResult } from './game-session';
type Callbacks = {
  update: (score: number, energy: number, facing: Direction) => void;
  end: (result: RunResult) => void;
  step: (action: Action, score: number) => void;
  progress?: (progress: RunProgress) => void;
};
const WIDTH = 420, HEIGHT = 570, STEP_X = 51, STEP_Y = 33;

export class StairScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private boy!: Phaser.GameObjects.Image;
  private caption!: Phaser.GameObjects.Text;
  private sparkles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];
  private session = new StairSession(246801, 'challenge');
  private companion: CompanionId = 'cloud';
  private running = false;
  private paused = false;
  private cameraOffset = 0;
  private displayedStep = 0;
  private hopFrom = 0;
  private hopStart = -1000;
  private visualTime = 0;
  private feedbackUntil = 0;
  private loaded = false;
  private reducedMotion = false;
  private motionQuery?: MediaQueryList;
  private readonly motionChanged = (event: MediaQueryListEvent): void => { this.reducedMotion = event.matches; if (event.matches) this.sparkles = []; };
  private readyCallback: () => void;
  private get width(): number { return this.scale.gameSize.width; }
  private get height(): number { return this.scale.gameSize.height; }
  private get baseY(): number { return this.height * .78; }
  private get stepX(): number { return Math.min(STEP_X, Math.max(24, (this.width - 110) / 6)); }
  constructor(private callbacks: Callbacks, ready: () => void) { super('stairs'); this.readyCallback = ready; }
  preload(): void { this.load.image('jihan', '/assets/jihan-climber.png'); }
  create(): void {
    this.art = this.add.graphics();
    this.boy = this.add.image(this.width / 2, this.baseY, 'jihan').setOrigin(.5, .96).setDisplaySize(122, 122);
    this.effects = this.add.graphics();
    this.caption = this.add.text(this.width / 2, 42, '', {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif', fontSize: '21px', fontStyle: 'bold',
      color: '#fffdf0', stroke: '#376b65', strokeThickness: 5, align: 'center',
    }).setOrigin(.5).setAlpha(0);
    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery?.matches ?? false;
    this.motionQuery?.addEventListener('change', this.motionChanged);
    this.events.once('shutdown', () => this.motionQuery?.removeEventListener('change', this.motionChanged));
    this.loaded = true;
    this.readyCallback();
  }
  startRun(seed: number, mode: Mode, options: RunOptions = {}): void {
    this.session = new StairSession(seed, mode, options);
    this.companion = options.companion ?? this.companion;
    this.resetVisuals(); this.running = true; this.paused = false;
    this.callbacks.update(0, 1, 1); this.emitProgress();
  }
  setCompanion(id: CompanionId): void { this.companion = id; }
  setPaused(value: boolean): void { this.paused = value; }
  isRunning(): boolean { return this.running; }
  getProgress(): RunProgress { return this.session.getProgress(); }
  stop(): void { this.running = false; }
  idle(options: { world?: WorldId; companion?: CompanionId } = {}): void {
    this.session = new StairSession(246801, 'challenge', options);
    this.companion = options.companion ?? this.companion;
    this.running = false; this.paused = false; this.resetVisuals(); this.emitProgress();
  }
  private resetVisuals(): void {
    this.cameraOffset = 0; this.displayedStep = 0; this.hopFrom = 0; this.hopStart = -1000;
    this.visualTime = 0; this.feedbackUntil = 0; this.sparkles = [];
    this.boy?.setAlpha(1); this.caption?.setAlpha(0);
  }
  private emitProgress(): void { this.callbacks.progress?.(this.session.getProgress()); }
  act(action: Action): void {
    if (!this.running || this.paused || !this.loaded) return;
    const previous = this.session.getProgress();
    const outcome = this.session.act(action);
    if (outcome === 'blocked') return;
    if (outcome === 'mistake') {
      if (!this.reducedMotion) this.cameras.main.shake(this.session.reason ? 130 : 90, this.session.reason ? .004 : .002);
      this.callbacks.step(action, -1);
      if (this.session.reason) this.boy.setAlpha(.6);
      else this.showFeedback(this.session.mistakeLimit ? '괜찮아, 다시 해 보자!' : '다음 계단을 살펴봐!');
      this.emitProgress();
      if (this.session.reason) this.finish();
      return;
    }
    this.hopFrom = this.displayedStep; this.hopStart = this.visualTime;
    this.callbacks.step(action, this.session.score);
    const progress = this.session.getProgress();
    if (this.session.reason === 'finished') { this.showFeedback('끝까지 올라왔어!'); this.celebrate(28); }
    else if (previous.worldId !== progress.worldId) { this.celebrate(22); }
    else if (progress.collected > previous.collected) { this.showFeedback(`별 +1  ·  ${progress.combo} 연속!`); this.celebrate(12); }
    else if (action === 'turn' && progress.combo % 5 === 0) this.showFeedback('멋진 방향 전환!');
    this.callbacks.update(this.session.score, this.session.mode === 'practice' ? 1 : this.session.energy / MAX_ENERGY, this.session.facing);
    this.emitProgress();
    if (this.session.reason) this.finish();
  }
  private showFeedback(text: string): void { this.caption.setText(text).setAlpha(1); this.feedbackUntil = this.visualTime + 1100; }
  private celebrate(count: number): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) this.sparkles.push({
      x: this.width / 2 + (Math.random() - .5) * 80, y: Math.max(120, this.baseY - 200),
      vx: (Math.random() - .5) * .17, vy: -.04 - Math.random() * .11,
      life: 1, color: [0xffd46c, 0xffffff, 0xf0b4c3, 0xacdfbb][i % 4],
    });
  }
  private finish(): void {
    if (!this.running) return;
    this.running = false;
    this.callbacks.end(this.session.getResult());
  }
  update(_time: number, delta: number): void {
    if (!this.loaded) return;
    const visualDelta = this.paused ? 0 : delta;
    this.visualTime += visualDelta;
    if (this.running && !this.paused) {
      this.session.advance(delta);
      if (this.session.reason) this.finish();
      this.callbacks.update(this.session.score, this.session.mode === 'practice' ? 1 : Math.max(0, this.session.energy / MAX_ENERGY), this.session.facing);
    }
    const hop = this.reducedMotion ? 1 : Phaser.Math.Clamp((this.visualTime - this.hopStart) / 125, 0, 1);
    this.displayedStep = Phaser.Math.Linear(this.hopFrom, this.session.score, Phaser.Math.Easing.Cubic.Out(hop));
    this.cameraOffset = Phaser.Math.Linear(this.cameraOffset, Math.max(0, this.displayedStep * STEP_Y - 40), this.reducedMotion ? 1 : Math.min(1, visualDelta / 85));
    this.draw(visualDelta, hop);
  }
  private draw(delta: number, hop: number): void {
    const g = this.art; g.clear(); this.effects.clear();
    const width = this.width, height = this.height, time = this.visualTime;
    const progress = this.session.getProgress(), p = WORLD_ART[progress.worldId];
    drawWorld(g, progress.worldId, width, height, time, this.cameraOffset, this.reducedMotion);
    const steps = this.session.steps, score = this.session.score;
    const first = Math.max(0, score - 5);
    for (let i = Math.min(steps.length - 1, score + 19, this.session.goal); i >= first; i--) {
      const x = width / 2 + steps[i].x * this.stepX;
      const y = this.baseY - i * STEP_Y + this.cameraOffset;
      if (y < -95 || y > height + 35) continue;
      const current = i === score, next = i === score + 1;
      const milestone = i > 0 && i % 50 === 0, goal = i === this.session.goal;
      const left = x - 37, right = x + 37;
      if ((milestone || goal) && i >= score) {
        g.lineStyle(4, p.glow, .8); g.beginPath(); g.moveTo(x - 33, y - 9); g.lineTo(x - 33, y - 39);
        g.arc(x, y - 39, 33, Math.PI, 0, false); g.lineTo(x + 33, y - 9); g.strokePath();
        star(g, x, y - 73, goal ? 12 : 9, p.glow);
      }
      g.fillStyle(p.shadow, .12); g.fillEllipse(x, y + 22, 80, 14);
      g.fillStyle(current ? 0xe6b44d : p.side); g.fillRoundedRect(left, y + 1, 74, 16, 5);
      g.fillStyle(current ? p.glow : (next && this.session.mode === 'practice' && this.running) ? 0xc3ef76 : p.step);
      g.fillRoundedRect(left, y - 8, 74, 16, 5);
      g.lineStyle(1.5, 0xffffff, .7); g.lineBetween(left + 7, y - 5, right - 7, y - 5);
      if (milestone || goal) { g.fillStyle(p.accent, .9); g.fillRoundedRect(left + 6, y + 5, 62, 4, 2); }
      if (progress.worldId === 'forest' && i % 3 === 0) { g.fillStyle(0x7faf63, .8); g.fillEllipse(left + 11, y - 6, 17, 5); }
      if (progress.worldId === 'snow') { g.fillStyle(0xffffff, .85); g.fillRoundedRect(left + 2, y - 10, 70, 6, 3); }
      if (progress.worldId === 'space' && i % 3 === 0) { g.fillStyle(0xb0e4df, .85); g.fillCircle(left + 11, y + 9, 2); g.fillCircle(right - 11, y + 9, 2); }
      if (i > score && (i + this.session.starOffset) % 10 === 0) {
        const bob = this.reducedMotion ? 0 : Math.sin(time * .004 + i) * 3;
        g.fillStyle(p.glow, .18); g.fillCircle(x, y - 38 + bob, 17); star(g, x, y - 38 + bob, 11, p.glow);
      }
      if (next && this.session.mode === 'practice' && this.running) {
        g.lineStyle(2, 0x517d49, .8); g.lineBetween(x - 5, y, x, y + 3); g.lineBetween(x, y + 3, x + 6, y - 3);
      }
    }
    const index = Math.floor(this.displayedStep), fraction = this.displayedStep - index;
    const a = steps[index] || steps[score], b = steps[index + 1] || a;
    const x = width / 2 + Phaser.Math.Linear(a.x, b.x, fraction) * this.stepX;
    const y = this.baseY - this.displayedStep * STEP_Y + this.cameraOffset - 5 - Math.sin(hop * Math.PI) * (this.reducedMotion ? 0 : 20);
    this.boy.setPosition(x, y).setFlipX(this.session.facing === -1);
    this.boy.setAngle(hop < 1 ? Math.sin(hop * Math.PI) * 5 * this.session.facing : 0);
    if (!this.reducedMotion && hop < 1 && score > 0) {
      const radius = 21 + hop * 22;
      this.effects.lineStyle(2, p.glow, (1 - hop) * .65); this.effects.strokeEllipse(x, y + 5, radius * 2, radius * .36);
    }
    const companionX = Phaser.Math.Clamp(x - this.session.facing * 65, 36, width - 36);
    drawCompanion(this.effects, this.companion, companionX, y - 72, time, this.reducedMotion);
    for (const s of this.sparkles) {
      s.life -= delta / 900; s.x += s.vx * delta; s.y += s.vy * delta; s.vy += delta * .00014;
      if (s.life > 0) star(this.effects, s.x, s.y, 4 * s.life + 1, s.color, s.life);
    }
    this.sparkles = this.sparkles.filter(s => s.life > 0);
    this.caption.setPosition(width / 2, height - 27);
    const remaining = this.feedbackUntil - time;
    this.caption.setAlpha(remaining <= 0 ? 0 : this.reducedMotion ? 1 : Math.min(1, remaining / 300));
  }
}

export function createGame(parent: HTMLElement, callbacks: Callbacks): Promise<{ game: Phaser.Game; scene: StairScene }> {
  return new Promise(resolve => {
    const scene = new StairScene(callbacks, () => resolve({ game, scene }));
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent, width: WIDTH, height: HEIGHT,
      backgroundColor: '#bcebf2', transparent: false, scene,
      scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false },
      fps: { target: 60, forceSetTimeOut: false },
      banner: false, audio: { noAudio: true },
    });
  });
}
