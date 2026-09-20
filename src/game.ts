import Phaser from 'phaser';
import { INITIAL_ENERGY, MAX_ENERGY, MAX_STEPS, MIN_STEP_MS, makeSteps, stepEnergy, type Action, type Direction, type InputEvent, type Mode, type Step } from '../functions/src/shared/rules';

export type RunResult = { score: number; inputs: InputEvent[]; reason: 'wrong' | 'time' | 'finished'; mode: Mode };
type Callbacks = { update: (score: number, energy: number, facing: Direction) => void; end: (result: RunResult) => void; step: (action: Action, score: number) => void };
const WIDTH = 420, HEIGHT = 570, STEP_X = 51, STEP_Y = 33;

export class StairScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private boy!: Phaser.GameObjects.Image;
  private sparkles: { x: number; y: number; life: number; color: number }[] = [];
  private steps: Step[] = [];
  private score = 0;
  private facing: Direction = 1;
  private mode: Mode = 'challenge';
  private energy = INITIAL_ENERGY;
  private activeTime = 0;
  private lastInput = -1000;
  private inputs: InputEvent[] = [];
  private running = false;
  private paused = false;
  private cameraOffset = 0;
  private displayedStep = 0;
  private hopFrom = 0;
  private hopStart = -1000;
  private loaded = false;
  private readyCallback: () => void;
  private get width(): number { return this.scale.gameSize.width; }
  private get height(): number { return this.scale.gameSize.height; }
  private get baseY(): number { return this.height * .78; }
  constructor(private callbacks: Callbacks, ready: () => void) { super('stairs'); this.readyCallback = ready; }
  preload(): void { this.load.image('jihan', '/assets/jihan-climber.png'); }
  create(): void {
    this.art = this.add.graphics();
    this.boy = this.add.image(this.width / 2, this.baseY, 'jihan').setOrigin(.5, .96).setDisplaySize(122, 122);
    this.steps = makeSteps(246801);
    this.loaded = true;
    this.readyCallback();
  }
  startRun(seed: number, mode: Mode): void {
    this.steps = makeSteps(seed);
    this.score = 0; this.facing = 1; this.mode = mode; this.energy = INITIAL_ENERGY;
    this.activeTime = 0; this.lastInput = -1000; this.inputs = [];
    this.cameraOffset = 0; this.displayedStep = 0; this.hopFrom = 0; this.hopStart = -1000;
    this.running = true; this.paused = false; this.boy.setAlpha(1); this.sparkles = [];
    this.callbacks.update(0, 1, 1);
  }
  setPaused(value: boolean): void { this.paused = value; }
  isRunning(): boolean { return this.running; }
  stop(): void { this.running = false; }
  idle(): void {
    this.running = false; this.paused = false; this.score = 0; this.displayedStep = 0;
    this.hopFrom = 0; this.hopStart = -1000; this.cameraOffset = 0; this.facing = 1;
    this.steps = makeSteps(246801); this.boy?.setAlpha(1);
  }
  act(action: Action): void {
    if (!this.running || this.paused || !this.loaded || this.activeTime - this.lastInput < MIN_STEP_MS) return;
    if (this.score >= MAX_STEPS) { this.finish('finished'); return; }
    const nextFacing: Direction = action === 'turn' ? (this.facing === 1 ? -1 : 1) : this.facing;
    this.lastInput = this.activeTime;
    if (this.steps[this.score + 1].direction !== nextFacing) {
      if (this.mode === 'practice') {
        this.cameras.main.shake(90, .002);
        this.callbacks.step(action, -1);
        return;
      }
      this.boy.setAlpha(.6); this.cameras.main.shake(130, .004); this.finish('wrong'); return;
    }
    this.facing = nextFacing;
    this.hopFrom = this.displayedStep;
    this.score++;
    this.hopStart = this.time.now;
    this.inputs.push({ action, at: Math.round(this.activeTime) });
    this.energy = Math.min(MAX_ENERGY, this.energy + stepEnergy(this.score));
    this.callbacks.step(action, this.score);
    if (this.score % 10 === 0) {
      for (let i = 0; i < 14; i++) this.sparkles.push({ x: this.width / 2 + (Math.random() - .5) * 180, y: this.baseY - 170 + Math.random() * 100, life: 1, color: i % 2 ? 0xffd46c : 0xffffff });
    }
    this.callbacks.update(this.score, this.mode === 'practice' ? 1 : this.energy / MAX_ENERGY, this.facing);
  }
  private finish(reason: RunResult['reason']): void {
    if (!this.running) return;
    this.running = false;
    this.callbacks.end({ score: this.score, inputs: [...this.inputs], reason, mode: this.mode });
  }
  update(time: number, delta: number): void {
    if (!this.loaded) return;
    if (this.running && !this.paused) {
      this.activeTime += delta;
      if (this.mode === 'challenge') {
        this.energy -= delta;
        if (this.energy <= 0) this.finish('time');
      }
      this.callbacks.update(this.score, this.mode === 'practice' ? 1 : Math.max(0, this.energy / MAX_ENERGY), this.facing);
    }
    const hop = Phaser.Math.Clamp((time - this.hopStart) / 125, 0, 1);
    this.displayedStep = Phaser.Math.Linear(this.hopFrom, this.score, Phaser.Math.Easing.Cubic.Out(hop));
    this.cameraOffset = Phaser.Math.Linear(this.cameraOffset, Math.max(0, this.displayedStep * STEP_Y - 40), Math.min(1, delta / 85));
    this.draw(time, delta, hop);
  }
  private draw(time: number, delta: number, hop: number): void {
    const g = this.art; g.clear();
    const width = this.width, height = this.height;
    g.fillGradientStyle(0xaadfee, 0xbcebf2, 0xe5f4df, 0xe5f4df, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0xffedb0, .7); g.fillCircle(80, 115, 39);
    for (let i = 0; i < 7; i++) {
      const x = ((i * 143 + time * (.0015 + i * .0003)) % (width + 120)) - 60;
      const y = 55 + (i % 4) * 106 - (this.cameraOffset * .08 % 55);
      g.fillStyle(0xffffff, .48 + (i % 2) * .2);
      g.fillEllipse(x, y + 10, 100, 29); g.fillCircle(x - 15, y, 23); g.fillCircle(x + 17, y - 3, 29);
    }
    g.fillStyle(0x8dbfab, .35);
    g.fillTriangle(-80, height, 75, height - 165, width * .6, height);
    g.fillTriangle(width * .3, height, width - 100, height - 180, width + 80, height);
    g.fillStyle(0x80b794, .5); g.fillEllipse(width * .24, height + 30, width * 1.25, 190);
    g.fillStyle(0x5c9e83, .35); g.fillEllipse(width - 30, height + 40, width * 1.15, 160);
    const first = Math.max(0, this.score - 5);
    for (let i = Math.min(this.steps.length - 1, this.score + 19); i >= first; i--) {
      const x = width / 2 + this.steps[i].x * STEP_X;
      const y = this.baseY - i * STEP_Y + this.cameraOffset;
      if (y < -45 || y > height + 35) continue;
      const current = i === this.score;
      const next = i === this.score + 1;
      const left = x - 37, right = x + 37;
      g.fillStyle(0x3d7769, .12); g.fillEllipse(x, y + 22, 80, 14);
      g.fillStyle(current ? 0xe8b64b : 0x7aada0); g.fillRoundedRect(left, y + 1, 74, 16, 5);
      g.fillStyle(current ? 0xffd473 : (next && this.mode === 'practice' && this.running) ? 0xc3ef76 : 0xfbf9e9);
      g.fillRoundedRect(left, y - 8, 74, 16, 5);
      g.lineStyle(1.5, 0xffffff, .7); g.lineBetween(left + 7, y - 5, right - 7, y - 5);
      if (i > 0 && i % 10 === 0) { g.fillStyle(0xf1b645); g.fillCircle(x, y, 4); }
    }
    const index = Math.floor(this.displayedStep);
    const fraction = this.displayedStep - index;
    const a = this.steps[index] || this.steps[this.score];
    const b = this.steps[index + 1] || a;
    const x = width / 2 + Phaser.Math.Linear(a.x, b.x, fraction) * STEP_X;
    const y = this.baseY - this.displayedStep * STEP_Y + this.cameraOffset - 5 - Math.sin(hop * Math.PI) * 20;
    this.boy.setPosition(x, y).setFlipX(this.facing === -1);
    this.boy.setAngle(hop < 1 ? Math.sin(hop * Math.PI) * 5 * this.facing : 0);
    for (const s of this.sparkles) { s.life -= delta / 700; s.y -= delta * .07; if (s.life > 0) { g.fillStyle(s.color, s.life); g.fillCircle(s.x, s.y, 3 * s.life); } }
    this.sparkles = this.sparkles.filter(s => s.life > 0);
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
