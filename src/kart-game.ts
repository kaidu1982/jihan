import Phaser from 'phaser';
import {
  KartSession, KART_VIEW_DISTANCE,
  type KartObject, type KartProgress, type KartResult, type KartTheme, type KartVehicle, type KartDifficulty,
} from './kart-session';

export type { KartProgress, KartResult, KartTheme, KartVehicle, KartDifficulty } from './kart-session';
type KartOptions = { theme: KartTheme; vehicle: KartVehicle; difficulty?: KartDifficulty };
type Callbacks = {
  update(progress: KartProgress): void;
  event(kind: 'star' | 'bump' | 'shield' | 'block' | 'magnet-ready' | 'magnet'): void;
  end(result: KartResult): void;
};
type Palette = {
  sky: number; skyBottom: number; sun: number; hill: number; farHill: number;
  grass: number; grassStripe: number; road: number; verge: number; line: number;
  tree: number; treeLight: number; trunk: number; flower: number; shadow: number;
};
const PALETTES: Record<KartTheme, Palette> = {
  meadow: {
    sky: 0x8fd7e7, skyBottom: 0xd8f0df, sun: 0xffdd79, hill: 0x9fce90, farHill: 0xb6d8b1,
    grass: 0x91c885, grassStripe: 0x88be7c, road: 0x697d7d, verge: 0xf4e8c7, line: 0xe7f2df,
    tree: 0x468d68, treeLight: 0x70b478, trunk: 0x8c7652, flower: 0xffe6a8, shadow: 0x315c56,
  },
  sunset: {
    sky: 0xf5ad91, skyBottom: 0xffdfb1, sun: 0xffedb1, hill: 0xb4a3a3, farHill: 0xd3b0ae,
    grass: 0xc1b787, grassStripe: 0xb8ad7f, road: 0x777582, verge: 0xf7e6c9, line: 0xf9e4ca,
    tree: 0x877d8c, treeLight: 0xaf93a1, trunk: 0x8c6d67, flower: 0xffd0ad, shadow: 0x68556f,
  },
  snow: {
    sky: 0xafcedf, skyBottom: 0xf0f6f0, sun: 0xffedb6, hill: 0xc0d6de, farHill: 0xd9e6e5,
    grass: 0xe4efeb, grassStripe: 0xdbe8e5, road: 0x81959e, verge: 0xfefcf0, line: 0xf5f7ec,
    tree: 0x598f8b, treeLight: 0x81b0a5, trunk: 0x829695, flower: 0xc1d8df, shadow: 0x5c8190,
  },
};
const WIDTH = 420, HEIGHT = 570;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

function polygon(g: Phaser.GameObjects.Graphics, points: number[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha); g.beginPath(); g.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
  g.closePath(); g.fillPath();
}

function star(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha = 1): void {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .47 : radius;
    points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  polygon(g, points, color, alpha);
}

function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
  g.fillStyle(0xffffff, .55); g.fillEllipse(x, y + 6 * scale, 76 * scale, 19 * scale);
  g.fillCircle(x - 15 * scale, y, 13 * scale); g.fillCircle(x + 7 * scale, y - 7 * scale, 18 * scale);
  g.fillCircle(x + 26 * scale, y + 1 * scale, 11 * scale);
}

export class KartScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private caption!: Phaser.GameObjects.Text;
  private session = new KartSession();
  private options: KartOptions = { theme: 'meadow', vehicle: 'kart' };
  private mode: 'idle' | 'running' | 'finished' | 'stopped' = 'idle';
  private paused = false;
  private loaded = false;
  private visualTime = 0;
  private feedbackUntil = 0;
  private finishTime = 0;
  private reducedMotion = false;
  private motionQuery?: MediaQueryList;
  private particles: { x: number; y: number; vx: number; vy: number; life: number; color: number; confetti: boolean }[] = [];
  private readonly motionChanged = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    if (event.matches) this.particles = [];
  };
  private get width(): number { return this.scale.gameSize.width; }
  private get height(): number { return this.scale.gameSize.height; }
  private get horizon(): number { return this.height * .215; }
  private get playerY(): number { return this.height * .80; }

  constructor(private callbacks: Callbacks, private ready: () => void) { super('mini-kart'); }

  create(): void {
    this.art = this.add.graphics();
    this.effects = this.add.graphics();
    this.caption = this.add.text(this.width / 2, this.height - 26, '', {
      fontFamily: '"Pretendard", "Apple SD Gothic Neo", sans-serif',
      fontSize: '18px', fontStyle: 'bold', color: '#fffbe8',
      stroke: '#425e62', strokeThickness: 5, align: 'center',
    }).setOrigin(.5).setAlpha(0);
    this.motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery?.matches ?? false;
    this.motionQuery?.addEventListener('change', this.motionChanged);
    this.events.once('shutdown', () => this.motionQuery?.removeEventListener('change', this.motionChanged));
    this.loaded = true;
    this.ready();
  }

  startRun(options: KartOptions & { seed?: number }): void {
    this.options = options;
    this.session = new KartSession(options.seed ?? Math.floor(Math.random() * 0xffffffff), options.difficulty);
    this.mode = 'running'; this.paused = false;
    this.resetVisuals();
    this.callbacks.update(this.session.getProgress());
  }

  move(direction: -1 | 1): void {
    if (!this.loaded || this.paused || this.mode !== 'running') return;
    this.session.move(direction);
  }

  useMagnet(): void {
    if (!this.loaded || this.paused || this.mode !== 'running' || !this.session.useMagnet()) return;
    this.feedback('별 자석! 5초 동안 3차선의 별을 모아요');
    this.callbacks.event('magnet');
    this.callbacks.update(this.session.getProgress());
  }

  setPaused(value: boolean): void { this.paused = value; this.session.setPaused(value); }

  idle(options: KartOptions): void {
    this.options = options;
    this.session = new KartSession(73129, options.difficulty);
    this.mode = 'idle'; this.paused = false;
    this.resetVisuals();
    this.callbacks.update(this.session.getProgress());
  }

  stop(): void { this.mode = 'stopped'; this.paused = false; this.session.setPaused(true); }

  private resetVisuals(): void {
    this.visualTime = 0; this.feedbackUntil = 0; this.finishTime = 0; this.particles = [];
    this.caption?.setAlpha(0);
  }

  update(_time: number, delta: number): void {
    if (!this.loaded) return;
    // A browser coming back from sleep should not skip the child's whole race.
    const activeDelta = this.paused || document.hidden || this.mode === 'stopped'
      ? 0 : clamp(Number.isFinite(delta) ? delta : 0, 0, 100);
    this.visualTime += activeDelta;
    if (this.mode === 'running' && activeDelta > 0) {
      const events = this.session.advance(activeDelta);
      for (const event of events) {
        this.callbacks.event(event.kind);
        const position = this.project(event.object.distance - this.session.distance, event.object.lane);
        if (event.kind === 'star') {
          this.burst(position.x, position.y - 10, 7, false, event.attracted ? 0xa0f2ff : undefined);
          if (event.magnetEarned) {
            this.callbacks.event('magnet-ready');
            this.feedback('별 15개! 별 자석 버튼을 눌러 봐요');
          } else if (event.shieldEarned) {
            this.callbacks.event('shield');
            this.feedback('별 10개! 방울 보호막 준비!');
          } else if (this.session.stars % 5 === 0) this.feedback(`별 ${this.session.stars}개! 멋지다!`);
        } else if (event.kind === 'block') {
          this.feedback('톡! 보호막이 지켜줬어!');
          this.burst(position.x, position.y, 11, false, 0xa5f0ef);
        } else {
          this.feedback('괜찮아! 계속 달려 보자');
          this.burst(position.x, position.y, 5, false, 0xf7e6bd);
        }
      }
      this.callbacks.update(this.session.getProgress());
      if (this.session.finished) {
        this.mode = 'finished'; this.finishTime = this.visualTime;
        this.feedback('도착! 끝까지 잘 달렸어!');
        this.burst(this.width / 2, this.height * .36, 42, true);
        this.callbacks.end(this.session.getResult());
      }
    }
    this.draw(activeDelta);
  }

  private feedback(message: string): void {
    this.caption?.setText(message).setAlpha(1);
    this.feedbackUntil = this.visualTime + 1600;
  }

  private burst(x: number, y: number, count: number, confetti: boolean, color?: number): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) this.particles.push({
      x, y, vx: (Math.random() - .5) * (confetti ? .34 : .15),
      vy: -.04 - Math.random() * (confetti ? .23 : .12),
      life: 1, color: color ?? [0xffda74, 0xfff4d0, 0xf7a591, 0xa2d6ce][i % 4], confetti,
    });
  }

  private roadHalfWidth(y: number): number {
    const t = (y - this.horizon) / (this.height - this.horizon);
    return this.width * (.061 + .338 * t);
  }

  private project(distance: number, lane: number): { x: number; y: number; scale: number } {
    const t = 1 - distance / KART_VIEW_DISTANCE;
    const y = this.horizon + (this.playerY - this.horizon) * t * t;
    const half = this.roadHalfWidth(y);
    return { x: this.width / 2 + (lane - 1) * half * 2 / 3, y, scale: half / (this.width * .31) };
  }

  private draw(delta: number): void {
    const g = this.art, fx = this.effects;
    g.clear(); fx.clear();
    const p = PALETTES[this.options.theme];
    const distance = this.mode === 'idle' ? (this.reducedMotion ? 0 : this.visualTime * .027) : this.session.distance;
    this.drawLandscape(g, p);
    this.drawRoad(g, p, distance);
    this.drawScenery(g, p, distance);
    const visible = this.session.objects.filter(object => !object.resolved && object.distance - distance < KART_VIEW_DISTANCE && object.distance - distance > -190);
    for (const object of [...visible].sort((a, b) => b.distance - a.distance)) this.drawObject(g, object, distance, p);
    if (this.mode === 'idle') this.drawStartingLine(g, distance, p);
    if (this.session.getProgress().progress > .88 || this.mode === 'finished') this.drawFinish(g, p);
    const player = this.project(0, this.session.lane);
    const bounce = this.reducedMotion || this.paused || this.mode === 'stopped' ? 0 : Math.sin(this.visualTime * .014) * 1.2;
    const bank = this.reducedMotion ? 0 : (this.session.targetLane - this.session.lane) * -.12;
    if (this.session.magnetActive) {
      // The band marks the actual contact strip, across all three lanes.
      const near = this.project(-24, 1).y, far = this.project(24, 1).y;
      const nearHalf = this.roadHalfWidth(near), farHalf = this.roadHalfWidth(far);
      polygon(g, [this.width / 2 - nearHalf, near, this.width / 2 + nearHalf, near,
        this.width / 2 + farHalf, far, this.width / 2 - farHalf, far], 0x87edfa, .45);
      const pulse = this.reducedMotion || this.paused ? 1 : .86 + Math.sin(this.visualTime * .006) * .14;
      for (const lane of [0, 1, 2]) {
        const target = this.project(0, lane);
        g.lineStyle(2, 0xcaffff, .9); g.strokeEllipse(target.x, target.y, 56 * target.scale * pulse, 20 * target.scale);
        g.lineStyle(2, 0x9cf6ff, .65); g.lineBetween(target.x, target.y, player.x, player.y - 12);
      }
    }
    if (this.session.shield) {
      const shimmer = this.reducedMotion || this.paused ? 1 : .94 + Math.sin(this.visualTime * .003) * .06;
      g.fillStyle(0xa6f2ef, .22); g.fillEllipse(player.x, player.y - 9, 77 * player.scale * shimmer, 99 * player.scale * shimmer);
      g.lineStyle(2.5, 0xe4ffff, .92); g.strokeEllipse(player.x, player.y - 9, 77 * player.scale * shimmer, 99 * player.scale * shimmer);
      star(g, player.x + 28 * player.scale, player.y - 37 * player.scale, 6 * player.scale, 0xf2ffff);
    }
    g.fillStyle(p.shadow, .20); g.fillEllipse(player.x + 2, player.y + 18, 49 * player.scale, 22 * player.scale);
    g.save(); g.translateCanvas(player.x, player.y - 7 + bounce); g.rotateCanvas(bank); g.scaleCanvas(player.scale, player.scale);
    if (this.session.slowed) { g.fillStyle(0xffedbb, .23); g.fillEllipse(0, 5, 62, 83); }
    this.drawVehicle(g, this.options.vehicle); g.restore();
    if (this.session.slowed) {
      for (let i = 0; i < 3; i++) {
        const phase = this.reducedMotion ? i / 3 : modulo(this.visualTime / 550 + i / 3, 1);
        g.fillStyle(0xfff6df, (1 - phase) * .65);
        g.fillCircle(player.x + (i - 1) * 9, player.y + 27 + phase * 22, 3 + phase * 4);
      }
    }
    for (const particle of this.particles) {
      particle.life -= delta / (particle.confetti ? 1900 : 650);
      particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += delta * .00016;
      if (particle.life <= 0) continue;
      if (particle.confetti) {
        fx.save(); fx.translateCanvas(particle.x, particle.y); fx.rotateCanvas(particle.life * 9);
        fx.fillStyle(particle.color, Math.min(1, particle.life * 2)); fx.fillRoundedRect(-3, -5, 6, 10, 2); fx.restore();
      } else star(fx, particle.x, particle.y, 2 + 5 * particle.life, particle.color, particle.life);
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
    this.caption.setPosition(this.width / 2, this.height - 24);
    const remaining = this.feedbackUntil - this.visualTime;
    this.caption.setAlpha(remaining <= 0 ? 0 : this.reducedMotion ? 1 : Math.min(1, remaining / 260));
    if (this.mode === 'finished' && this.visualTime - this.finishTime < 3000 && this.reducedMotion) {
      for (let i = 0; i < 9; i++) star(fx, this.width * (.14 + i * .09), this.height * (.35 + (i % 3) * .035), 5 + i % 3, p.sun);
    }
  }

  private drawLandscape(g: Phaser.GameObjects.Graphics, p: Palette): void {
    const w = this.width, h = this.height, horizon = this.horizon;
    g.fillGradientStyle(p.sky, p.sky, p.skyBottom, p.skyBottom);
    g.fillRect(0, 0, w, horizon + 42);
    g.fillStyle(p.sun, .16); g.fillCircle(w * .79, h * .086, 43);
    g.fillStyle(p.sun, .8); g.fillCircle(w * .79, h * .086, 26);
    cloud(g, w * .17, h * .080, .78); cloud(g, w * .55, h * .042, .48);
    if (this.options.theme === 'snow') {
      polygon(g, [0, horizon + 25, w * .17, horizon - 47, w * .36, horizon + 25], p.farHill);
      polygon(g, [w * .48, horizon + 20, w * .74, horizon - 57, w, horizon + 20], p.farHill);
      polygon(g, [w * .091, horizon - 13, w * .17, horizon - 47, w * .259, horizon - 9, w * .21, horizon - 18, w * .16, horizon - 11, w * .13, horizon - 20], 0xf5f8f0);
      polygon(g, [w * .64, horizon - 28, w * .74, horizon - 57, w * .87, horizon - 20, w * .78, horizon - 31, w * .72, horizon - 20], 0xf5f8f0);
    } else {
      g.fillStyle(p.farHill); g.fillEllipse(w * .13, horizon + 9, w * .78, h * .15);
      g.fillEllipse(w * .80, horizon + 9, w * .90, h * .15);
    }
    g.fillStyle(p.hill); g.fillEllipse(w * .09, horizon + 38, w * .78, h * .16);
    g.fillEllipse(w * .91, horizon + 33, w * .87, h * .16);
    g.fillStyle(p.grass); g.fillRect(0, horizon + 18, w, h - horizon);
    // Little distant tree groups bring the horizon into the same world as the road.
    for (let i = 0; i < 8; i++) {
      const x = i < 4 ? w * (.05 + i * .085) : w * (.68 + (i - 4) * .085);
      g.fillStyle(p.tree, .65); g.fillEllipse(x, horizon + 15 - i % 2 * 3, 12 + i % 3 * 4, 23 + i % 3 * 5);
      g.fillStyle(p.trunk, .7); g.fillRect(x - 1, horizon + 18, 2, 9);
    }
  }

  private drawRoad(g: Phaser.GameObjects.Graphics, p: Palette, distance: number): void {
    const w = this.width, h = this.height, horizon = this.horizon;
    const top = this.roadHalfWidth(horizon), bottom = this.roadHalfWidth(h), center = w / 2;
    // Soft alternating grass bands share the same perspective and scroll as the road.
    for (let i = 0; i < 14; i++) {
      const z = modulo(i * 135 - distance, 1890) - 250;
      if (z > KART_VIEW_DISTANCE) continue;
      const near = this.project(z, 1).y, far = this.project(z + 66, 1).y;
      if (far < horizon || near < horizon || far > h) continue;
      g.fillStyle(p.grassStripe, .65); g.fillRect(0, far, w, near - far);
    }
    polygon(g, [center - top - 5, horizon, center + top + 5, horizon, center + bottom + 10, h, center - bottom - 10, h], p.verge);
    polygon(g, [center - top, horizon, center + top, horizon, center + bottom, h, center - bottom, h], p.road);
    // A faint lighter center gives the road a soft, illustrated surface.
    polygon(g, [center - top * .77, horizon, center + top * .77, horizon, center + bottom * .83, h, center - bottom * .83, h], 0xffffff, .035);
    for (let i = 0; i < 16; i++) {
      const z = modulo(i * 112 - distance, 1792) - 220;
      if (z > KART_VIEW_DISTANCE) continue;
      const near = this.project(z, 1), far = this.project(z + 48, 1);
      if (far.y < horizon || far.y > h) continue;
      for (const divider of [-1 / 3, 1 / 3]) {
        const nearHalf = this.roadHalfWidth(near.y), farHalf = this.roadHalfWidth(far.y);
        const thickness = Math.max(1, near.scale * 2);
        polygon(g, [center + nearHalf * divider - thickness, near.y, center + nearHalf * divider + thickness, near.y,
          center + farHalf * divider + thickness * .5, far.y, center + farHalf * divider - thickness * .5, far.y], p.line, .8);
      }
    }
    for (const direction of [-1, 1]) {
      g.lineStyle(1.7, p.line, .72); g.lineBetween(center + direction * (top - 3), horizon, center + direction * (bottom - 7), h);
    }
  }

  private drawScenery(g: Phaser.GameObjects.Graphics, p: Palette, distance: number): void {
    const items = Array.from({ length: 27 }, (_, i) => ({
      index: i, z: modulo(i * 131 - distance, 1768) - 180,
    })).filter(item => item.z < KART_VIEW_DISTANCE).sort((a, b) => b.z - a.z);
    for (const { index: i, z } of items) {
      const position = this.project(z, 1), direction = i % 2 ? 1 : -1;
      const half = this.roadHalfWidth(position.y);
      const x = this.width / 2 + direction * (half + (26 + i % 3 * 18) * position.scale);
      const y = position.y, s = position.scale;
      if (y < this.horizon || y > this.height + 100) continue;
      g.save(); g.translateCanvas(x, y); g.scaleCanvas(s, s);
      if (i % 5 === 1) this.drawFence(g, p);
      else if (i % 4 === 2) this.drawFlowers(g, p, i);
      else this.drawTree(g, p, i);
      g.restore();
    }
    // Tiny flower clusters fill the verge without hiding the playable lanes.
    for (let i = 0; i < 13; i++) {
      const z = modulo(i * 143 - distance, 1859) - 130;
      if (z > KART_VIEW_DISTANCE) continue;
      const position = this.project(z, 1), side = i % 2 ? 1 : -1;
      const x = this.width / 2 + side * (this.roadHalfWidth(position.y) + 14 * position.scale);
      const s = position.scale;
      g.fillStyle(this.options.theme === 'snow' ? 0xf9fcf4 : p.treeLight, .8); g.fillEllipse(x, position.y, 16 * s, 6 * s);
      g.fillStyle(p.flower, .94); g.fillCircle(x - 3 * s, position.y - 3 * s, 2.8 * s); g.fillCircle(x + 4 * s, position.y - 5 * s, 2 * s);
    }
  }

  private drawTree(g: Phaser.GameObjects.Graphics, p: Palette, index: number): void {
    g.fillStyle(p.shadow, .13); g.fillEllipse(7, 4, 49, 16);
    g.fillStyle(p.trunk); g.fillRoundedRect(-4, -32, 8, 35, 3);
    if (this.options.theme === 'snow' || index % 3 === 0) {
      polygon(g, [-24, -20, 0, -69, 24, -20], p.tree);
      polygon(g, [-20, -36, 0, -79, 20, -36], p.treeLight);
      if (this.options.theme === 'snow') {
        polygon(g, [-21, -27, 0, -69, 21, -27, 9, -33, 0, -27, -8, -34], 0xf4f9ef);
        polygon(g, [-16, -45, 0, -79, 16, -45, 5, -49, -1, -44, -8, -50], 0xf4f9ef);
      }
    } else {
      g.fillStyle(p.tree); g.fillCircle(1, -43, 24); g.fillCircle(-13, -35, 17); g.fillCircle(17, -36, 15);
      g.fillStyle(p.treeLight); g.fillCircle(-7, -52, 20); g.fillCircle(13, -48, 15);
      g.fillStyle(0xffffff, .11); g.fillEllipse(-11, -58, 17, 11);
      if (this.options.theme === 'sunset') {
        g.fillStyle(0xf7be96, .5); g.fillCircle(-14, -47, 3); g.fillCircle(11, -58, 2.5);
      }
    }
  }

  private drawFlowers(g: Phaser.GameObjects.Graphics, p: Palette, index: number): void {
    g.fillStyle(p.shadow, .10); g.fillEllipse(3, 3, 40, 11);
    g.fillStyle(this.options.theme === 'snow' ? 0xf8fbf3 : p.treeLight);
    g.fillEllipse(0, -4, 40, 18); g.fillCircle(-8, -8, 10); g.fillCircle(7, -10, 12);
    for (let i = 0; i < 4; i++) {
      const x = -14 + i * 9, y = -8 - (i + index) % 2 * 6;
      g.fillStyle(i % 2 ? p.flower : 0xfff5d7); g.fillCircle(x - 2, y, 3); g.fillCircle(x + 2, y, 3);
      g.fillCircle(x, y - 2, 3); g.fillCircle(x, y + 2, 3); g.fillStyle(0xd6a964); g.fillCircle(x, y, 1.6);
    }
  }

  private drawFence(g: Phaser.GameObjects.Graphics, p: Palette): void {
    g.fillStyle(p.shadow, .1); g.fillEllipse(1, 4, 52, 9);
    g.fillStyle(p.verge); g.fillRoundedRect(-24, -22, 48, 5, 1.5); g.fillRoundedRect(-24, -12, 48, 5, 1.5);
    g.fillRoundedRect(-21, -28, 6, 30, 2); g.fillRoundedRect(15, -28, 6, 30, 2);
    g.fillStyle(0xffffff, .6); g.fillRect(-20, -26, 2, 25); g.fillRect(16, -26, 2, 25);
  }

  private drawObject(g: Phaser.GameObjects.Graphics, object: KartObject, distance: number, p: Palette): void {
    const z = object.distance - distance, position = this.project(z, object.lane);
    const s = position.scale, x = position.x, y = position.y;
    g.save(); g.translateCanvas(x, y); g.scaleCanvas(s, s);
    g.fillStyle(p.shadow, .18); g.fillEllipse(2, 7, object.kind === 'puddle' ? 43 : 31, 12);
    if (object.kind === 'star') {
      const bob = this.reducedMotion ? 0 : Math.sin(this.visualTime * .005 + object.id) * 2.2;
      g.fillStyle(0xffe39b, .15); g.fillCircle(0, -13 + bob, 18);
      star(g, 0, -13 + bob, 13, 0xdca34c); star(g, 0, -15 + bob, 12, 0xffdc75);
      star(g, -2, -17 + bob, 7, 0xffefb4, .85);
    } else if (object.kind === 'cone') {
      g.fillStyle(0xe9b88a); g.fillRoundedRect(-18, 0, 36, 10, 4);
      polygon(g, [-13, 2, -4, -28, 4, -28, 13, 2], 0xf2a16e);
      polygon(g, [-10.4, -7, -8, -15, 8, -15, 10.4, -7], 0xffedce);
      g.fillStyle(0xffffff, .24); g.fillRoundedRect(-4, -25, 3, 19, 1);
    } else if (object.kind === 'hay') {
      g.fillStyle(0xbf965c); g.fillRoundedRect(-18, -19, 36, 26, 6);
      g.fillStyle(0xe2c17d); g.fillRoundedRect(-18, -23, 36, 25, 6);
      g.lineStyle(1, 0xf4dea3, .8);
      for (let i = 0; i < 4; i++) g.lineBetween(-13, -18 + i * 5, 13, -18 + i * 5);
      g.lineStyle(3, 0xb48d55, .8); g.lineBetween(-8, -22, -8, 3); g.lineBetween(8, -22, 8, 3);
      g.fillStyle(0xffe7b1, .4); g.fillRoundedRect(-15, -22, 27, 4, 2);
    } else {
      g.fillStyle(0x4e909e); g.fillEllipse(0, 1, 48, 20); g.fillEllipse(-10, -3, 27, 16); g.fillEllipse(11, -3, 25, 15);
      g.lineStyle(2, 0xa8d9db, .8); g.beginPath(); g.arc(0, -1, 11, Math.PI * .15, Math.PI * .85); g.strokePath();
      g.fillStyle(0xdaf0e6, .8); g.fillEllipse(-11, -5, 10, 3);
    }
    g.restore();
  }

  private drawVehicle(g: Phaser.GameObjects.Graphics, vehicle: KartVehicle): void {
    const wheels = (): void => {
      g.fillStyle(0x344e59); g.fillRoundedRect(-26, -24, 10, 18, 3); g.fillRoundedRect(16, -24, 10, 18, 3);
      g.fillRoundedRect(-27, 15, 11, 19, 3); g.fillRoundedRect(16, 15, 11, 19, 3);
      g.fillStyle(0x6d8790); g.fillRoundedRect(-25, -21, 3, 11, 1); g.fillRoundedRect(22, -21, 3, 11, 1);
      g.fillRoundedRect(-25, 18, 3, 12, 1); g.fillRoundedRect(22, 18, 3, 12, 1);
    };
    if (vehicle === 'space') {
      g.fillStyle(0x9de5d7, .65); g.fillEllipse(-12, 35, 11, 18); g.fillEllipse(12, 35, 11, 18);
      polygon(g, [-14, -15, -30, 24, -9, 16], 0xe4e3f4); polygon(g, [14, -15, 30, 24, 9, 16], 0xe4e3f4);
      g.fillStyle(0x8f83b5); g.fillRoundedRect(-18, -28, 36, 61, { tl: 18, tr: 18, bl: 11, br: 11 });
      g.fillStyle(0xc7bde7); g.fillRoundedRect(-16, -33, 32, 56, { tl: 17, tr: 17, bl: 12, br: 12 });
      g.fillStyle(0x4c7e94); g.fillRoundedRect(-11, -17, 22, 27, { tl: 11, tr: 11, bl: 7, br: 7 });
      g.fillStyle(0xa7dcd9); g.fillRoundedRect(-8, -14, 16, 19, 7);
      g.fillStyle(0xf4f5df, .78); g.fillEllipse(-4, -9, 5, 11);
      g.fillStyle(0xf7d58c); g.fillRoundedRect(-5, 16, 10, 10, 3); star(g, 0, 21, 3, 0xfff3c9);
      g.fillStyle(0x797498); g.fillRoundedRect(-17, 28, 10, 8, 2); g.fillRoundedRect(7, 28, 10, 8, 2);
      return;
    }
    wheels();
    if (vehicle === 'firetruck') {
      g.fillStyle(0xb35e55); g.fillRoundedRect(-20, -32, 40, 68, 7);
      g.fillStyle(0xe98770); g.fillRoundedRect(-20, -35, 40, 64, 7);
      g.fillStyle(0xf5b095); g.fillRoundedRect(-17, -33, 34, 6, 3);
      g.fillStyle(0xf9e6c6); g.fillRoundedRect(-18, -20, 36, 25, 4);
      g.fillStyle(0x5c8a94); g.fillRoundedRect(-14, -17, 28, 17, 3);
      g.fillStyle(0xc4e7df, .8); g.fillRoundedRect(-11, -15, 10, 4, 2);
      g.fillStyle(0xfdf0d5); g.fillRoundedRect(-16, -27, 32, 7, 3);
      g.fillStyle(0xeb8a7c); g.fillRoundedRect(-14, -26, 12, 5, 2);
      g.fillStyle(0x88bfd1); g.fillRoundedRect(2, -26, 12, 5, 2);
      g.fillStyle(0xc56e5e); g.fillRoundedRect(-15, 8, 30, 18, 3);
      g.lineStyle(3, 0xf5dfb7); g.lineBetween(-10, 6, -10, 25); g.lineBetween(10, 6, 10, 25);
      g.lineStyle(2, 0xf5dfb7);
      for (let y = 9; y < 25; y += 5) g.lineBetween(-10, y, 10, y);
      g.fillStyle(0xffedbd); g.fillRoundedRect(-18, -34, 7, 5, 2); g.fillRoundedRect(11, -34, 7, 5, 2);
      g.fillStyle(0x57717a); g.fillRoundedRect(-19, 30, 38, 5, 2);
      return;
    }
    if (vehicle === 'dino') {
      g.fillStyle(0x548c68); g.fillRoundedRect(-20, -29, 40, 61, 14);
      g.fillStyle(0x91c777); g.fillRoundedRect(-20, -35, 40, 61, { tl: 18, tr: 18, bl: 13, br: 13 });
      g.fillStyle(0xb7db8e); g.fillRoundedRect(-19, -37, 38, 20, 10);
      g.fillStyle(0xfff3d3); g.fillCircle(-10, -26, 6); g.fillCircle(10, -26, 6);
      g.fillStyle(0x3d6160); g.fillCircle(-10, -28, 2.4); g.fillCircle(10, -28, 2.4);
      g.fillStyle(0x70a761); g.fillCircle(-5, -34, 1.6); g.fillCircle(5, -34, 1.6);
      g.fillStyle(0x466b64); g.fillRoundedRect(-12, -13, 24, 23, 8);
      g.fillStyle(0x94c5bc); g.fillRoundedRect(-9, -10, 18, 15, 6);
      g.fillStyle(0xd9e9b0); g.fillEllipse(0, 19, 22, 12);
      polygon(g, [-6, 27, 0, 41, 6, 27], 0x84b96e);
      for (let i = 0; i < 3; i++) polygon(g, [-18, 1 + i * 8, -26, 5 + i * 8, -18, 9 + i * 8], 0xe5b37c);
      for (let i = 0; i < 3; i++) polygon(g, [18, 1 + i * 8, 26, 5 + i * 8, 18, 9 + i * 8], 0xe5b37c);
      return;
    }
    g.fillStyle(0xb96150); g.fillRoundedRect(-19, -29, 38, 63, 12);
    g.fillStyle(0xed9b78); g.fillRoundedRect(-19, -34, 38, 61, { tl: 13, tr: 13, bl: 10, br: 10 });
    g.fillStyle(0xffd59b); g.fillRoundedRect(-16, -32, 32, 7, 3);
    g.fillStyle(0xffe4ab); g.fillRoundedRect(-5, -27, 10, 15, 3);
    g.fillStyle(0xfff0ce); g.fillRoundedRect(-17, -29, 7, 6, 2); g.fillRoundedRect(10, -29, 7, 6, 2);
    g.fillStyle(0x4c7077); g.fillRoundedRect(-13, -11, 26, 30, 9);
    g.fillStyle(0x83afb0); g.fillRoundedRect(-10, -9, 20, 16, 5);
    // A tiny helmeted driver makes this feel like the same child's little arcade.
    g.fillStyle(0x3a5c65); g.fillCircle(0, 5, 10);
    g.fillStyle(0xf9d6a0); g.fillCircle(0, 4, 8.5);
    g.fillStyle(0x759b96); g.fillRoundedRect(-8, -5, 16, 9, { tl: 8, tr: 8, bl: 2, br: 2 });
    g.fillStyle(0xffedc6); g.fillRoundedRect(-2, -5, 4, 8, 1);
    g.fillStyle(0x46616a); g.fillCircle(-3, 8, 1); g.fillCircle(3, 8, 1);
    g.fillStyle(0xf8d08c); g.fillRoundedRect(-17, 23, 34, 7, 3);
    g.fillStyle(0x58737a); g.fillRoundedRect(-21, 31, 42, 5, 2);
  }

  private drawStartingLine(g: Phaser.GameObjects.Graphics, distance: number, p: Palette): void {
    const z = modulo(170 - distance, 1350) - 90;
    if (z > 450) return;
    const at = this.project(z, 1), half = this.roadHalfWidth(at.y);
    g.fillStyle(p.line, .75); g.fillRect(this.width / 2 - half + 8, at.y, half * 2 - 16, Math.max(2, 5 * at.scale));
  }

  private drawFinish(g: Phaser.GameObjects.Graphics, p: Palette): void {
    const progress = this.session.getProgress().progress;
    const remaining = (1 - progress) / .12;
    const z = this.mode === 'finished' ? -55 : Math.max(0, remaining * 940);
    const at = this.project(z, 1), half = this.roadHalfWidth(at.y), cell = half * 2 / 12;
    if (at.y > this.height) return;
    for (let row = 0; row < 2; row++) for (let column = 0; column < 12; column++) {
      g.fillStyle((row + column) % 2 ? 0x4a626a : 0xfff5d9);
      g.fillRect(this.width / 2 - half + column * cell, at.y + row * cell * .42, cell + .5, cell * .42 + .5);
    }
    const postHeight = 70 * at.scale;
    for (const side of [-1, 1]) {
      const x = this.width / 2 + side * (half + 7 * at.scale);
      g.fillStyle(0xf9edcf); g.fillRoundedRect(x - 3 * at.scale, at.y - postHeight, 6 * at.scale, postHeight + 5, 2 * at.scale);
      polygon(g, [x, at.y - postHeight, x + side * 25 * at.scale, at.y - postHeight + 7 * at.scale, x, at.y - postHeight + 16 * at.scale], 0xeaa581);
      star(g, x, at.y - postHeight - 5 * at.scale, 5 * at.scale, p.sun);
    }
  }
}

export function createKartGame(parent: HTMLElement, callbacks: Callbacks): Promise<{ game: Phaser.Game; scene: KartScene }> {
  return new Promise(resolve => {
    const scene = new KartScene(callbacks, () => resolve({ game, scene }));
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent, width: WIDTH, height: HEIGHT, backgroundColor: '#bce5e6', scene,
      scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false },
      fps: { target: 60, forceSetTimeOut: false },
      banner: false, audio: { noAudio: true },
    });
  });
}
