import type { MiniAction, MiniOptions, MiniSession, MiniStatus } from './mini-types';

export const DINO_COURSE_LENGTH = 9_000;
export const DINO_SPEED = 190;
export const DINO_GRAVITY = 1_250;
export const DINO_JUMP_SPEED = 520;
export const DINO_AIR_JUMP_SPEED = 650;
export const DINO_COURSE_LENGTHS = [DINO_COURSE_LENGTH, 9_900, 10_640] as const;
const courseLevel = (level: number): number => Math.max(0, Math.min(2, Math.floor(level) || 0));
export type DinoObstacle = {
  id: number;
  x: number;
  width: number;
  height: number;
  kind: 'rock' | 'log' | 'gap';
  resolved: boolean;
  bumped: boolean;
};
export type DinoEgg = { id: number; x: number; height: number; collected: boolean };
export const needsDinoDoubleJump = (obstacle: DinoObstacle): boolean => obstacle.height > 110 || (obstacle.kind === 'gap' && obstacle.width > 80);
export type DinoJumpCue = {
  phase: 'prepare' | 'jump' | 'wait' | 'again';
  text: string;
  shouldJump: boolean;
};

/** Gentle gaps between obstacles leave time to land before the next double jump. */
export function makeDinoCourse(seed: number, level = 0): { obstacles: DinoObstacle[]; eggs: DinoEgg[] } {
  const stage = courseLevel(level);
  let state = ((Number.isFinite(seed) ? seed : 1701) + stage * 2654435761) >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const obstacles: DinoObstacle[] = [];
  const eggs: DinoEgg[] = [{ id: 0, x: 450, height: 25, collected: false }];
  for (let x = 880; x < DINO_COURSE_LENGTHS[stage] - 450; x += (stage ? 520 : 475) + Math.floor(random() * (stage ? 90 : 65))) {
    const chosenKind = (['rock', 'log', 'gap'] as const)[Math.floor(random() * 3)];
    const tall = stage > 0 && obstacles.length % (stage === 1 ? 3 : 2) === 1;
    const kind = tall ? (stage === 1 ? 'log' : 'rock') : chosenKind;
    obstacles.push({
      id: obstacles.length, x,
      width: kind === 'gap' ? (stage === 2 ? 96 : 68) + Math.floor(random() * 13) : 32 + Math.floor(random() * 10),
      height: kind === 'gap' ? 0 : tall ? (stage === 1 ? 128 : 146) : kind === 'log' ? 27 : 34,
      kind, resolved: false, bumped: false,
    });
    eggs.push({ id: eggs.length, x: x - 200, height: 25, collected: false });
    eggs.push({ id: eggs.length, x: x - 12, height: tall || (kind === 'gap' && stage === 2) ? 260 : 115, collected: false });
  }
  return { obstacles, eggs };
}

/** Physics use only active elapsed time; the shell pauses by withholding advance(). */
export class DinoSession implements MiniSession {
  readonly obstacles: DinoObstacle[];
  readonly eggs: DinoEgg[];
  readonly level: number;
  readonly character: string;
  readonly courseLength: number;
  elapsed = 0;
  distance = 0;
  height = 0;
  velocity = 0;
  stars = 0;
  mistakes = 0;
  clearedObstacles = 0;
  jumpsUsed = 0;
  jumpBurstUntil = 0;
  finished = false;
  private slowUntil = 0;
  private protectedUntil = 0;
  private feedbackUntil = 0;
  private message = '알을 모으며 숲속 결승선까지 달려요!';

  constructor(options: MiniOptions = { seed: 1701, level: 0, character: 'sprout' }) {
    this.level = courseLevel(options.level);
    this.courseLength = DINO_COURSE_LENGTHS[this.level];
    const course = makeDinoCourse(options.seed, this.level);
    this.obstacles = course.obstacles;
    this.eggs = course.eggs;
    this.character = ['sprout', 'sunny', 'berry'].includes(options.character) ? options.character : 'sprout';
  }

  get slowed(): boolean { return this.elapsed < this.slowUntil; }
  get protected(): boolean { return this.elapsed < this.protectedUntil; }
  get speed(): number { return this.slowed ? DINO_SPEED * .6 : DINO_SPEED; }
  get grounded(): boolean { return this.height <= .001 && this.velocity <= 0; }
  get jumpsRemaining(): number { return this.grounded ? 2 : Math.max(0, 2 - this.jumpsUsed); }
  get nextObstacle(): DinoObstacle | undefined {
    return this.obstacles.find(obstacle => !obstacle.resolved && obstacle.x + obstacle.width / 2 >= this.distance - 20);
  }
  /** The HUD and picture use the same reachable timing windows as the input guide. */
  get jumpCue(): DinoJumpCue | undefined {
    if (this.finished || this.slowed) return;
    const obstacle = this.nextObstacle;
    if (!obstacle || obstacle.bumped) return;
    const distance = obstacle.x - this.distance;
    if (distance <= 12 || distance > 270) return;
    if (needsDinoDoubleJump(obstacle)) {
      if (this.grounded) return distance > 190
        ? { phase: 'prepare', text: '두 번 점프 준비', shouldJump: false }
        : { phase: 'jump', text: '지금 점프!', shouldJump: true };
      if (this.jumpsUsed === 1) return distance > 120
        ? { phase: 'wait', text: '조금 기다려요', shouldJump: false }
        : { phase: 'again', text: '↑ 한 번 더!', shouldJump: true };
      return;
    }
    if (!this.grounded) return;
    return distance > 110
      ? { phase: 'prepare', text: '점프 준비!', shouldJump: false }
      : { phase: 'jump', text: '지금 점프!', shouldJump: true };
  }

  act(action: MiniAction): void {
    if (this.finished || (action !== 'jump' && action !== 'up')) return;
    const airborne = !this.grounded;
    if (!airborne) this.jumpsUsed = 1;
    else if (this.jumpsUsed < 2) {
      this.jumpsUsed = 2;
      this.jumpBurstUntil = this.elapsed + 400;
      this.message = '한 번 더 폴짝! 두 번 점프!';
      this.feedbackUntil = this.elapsed + 1_000;
    } else return;
    // Later routes give the second hop a little more lift, leaving time to react
    // to both cues while keeping the original first course and ground jump intact.
    this.velocity = airborne && this.level > 0 ? DINO_AIR_JUMP_SPEED : DINO_JUMP_SPEED;
  }

  private bump(obstacle: DinoObstacle): void {
    obstacle.bumped = true;
    this.mistakes++;
    this.slowUntil = this.elapsed + 650;
    this.protectedUntil = this.elapsed + 1_100;
    // A friendly bounce carries the dinosaur safely out of a missed gap.
    if (obstacle.kind === 'gap') {
      this.height = Math.max(this.height, 24);
      this.velocity = Math.max(this.velocity, 220);
      this.jumpsUsed = Math.max(1, this.jumpsUsed);
    }
    this.message = obstacle.kind === 'gap' ? '폴짝! 다시 달리면 돼요!' : '앗, 괜찮아! 다시 출발!';
    this.feedbackUntil = this.elapsed + 1_800;
  }

  advance(deltaMs: number): void {
    if (this.finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    // A whole run can be advanced at once without skipping objects or collisions.
    let remaining = Math.min(deltaMs, 60_000);
    while (remaining > 1e-7 && !this.finished) {
      const step = Math.min(1000 / 120, remaining);
      const seconds = step / 1000;
      this.elapsed += step;
      this.distance = Math.min(this.courseLength, this.distance + this.speed * seconds);
      this.height += this.velocity * seconds - .5 * DINO_GRAVITY * seconds * seconds;
      this.velocity -= DINO_GRAVITY * seconds;
      if (this.height <= 0) { this.height = 0; this.velocity = 0; this.jumpsUsed = 0; }

      for (const obstacle of this.obstacles) {
        if (obstacle.resolved) continue;
        const overlap = obstacle.width / 2 + (obstacle.kind === 'gap' ? -3 : 14);
        if (this.distance > obstacle.x + overlap) {
          obstacle.resolved = true;
          if (!obstacle.bumped) this.clearedObstacles++;
          continue;
        }
        if (Math.abs(this.distance - obstacle.x) > overlap) continue;
        const tooLow = this.height < (obstacle.kind === 'gap' ? 8 : obstacle.height - 4);
        if (tooLow && !this.protected && !obstacle.bumped) this.bump(obstacle);
      }
      for (const egg of this.eggs) {
        if (egg.collected || Math.abs(egg.x - this.distance) > 27) continue;
        if (Math.abs(egg.height - (this.height + 27)) <= 29) {
          egg.collected = true;
          this.stars++;
          // Preserve a collision's encouraging message during recovery.
          if (!this.slowed) {
            this.message = '공룡 알을 찾았어요! +1';
            this.feedbackUntil = this.elapsed + 1_250;
          }
        }
      }
      remaining -= step;
      if (this.distance >= this.courseLength) {
        this.finished = true;
        this.message = '결승선 도착! 멋진 공룡 탐험가!';
      }
    }
  }

  getStatus(): MiniStatus {
    const progress = this.distance / this.courseLength;
    const cue = this.jumpCue;
    return {
      score: Math.floor(this.distance / 10), stars: this.stars, progress,
      label: `${Math.ceil(Math.max(0, this.courseLength - this.distance) / DINO_SPEED)}초`,
      detail: `알 ${this.stars}개 · ${this.slowed ? '다시 힘내는 중!' : cue?.text ?? (this.grounded ? '점프 2번 준비!' : `공중 점프 ${this.jumpsRemaining}번 남음`)}`,
      finished: this.finished, won: this.finished,
      summary: `공룡 알 ${this.stars}개를 모아 숲속 길을 완주했어요! 장애물 ${this.clearedObstacles}개도 폴짝 넘었어요.`,
      feedback: this.finished || this.elapsed <= this.feedbackUntil || this.elapsed < 3_200 ? this.message : undefined,
      mistakes: this.mistakes,
      objectives: [
        { id: 'finish', label: '결승선 도착', done: this.finished },
        { id: 'eggs', label: '공룡 알 15개 모으기', done: this.stars >= 15 },
        { id: 'leaps', label: '장애물 8개 넘기', done: this.clearedObstacles >= 8 },
      ],
    };
  }
}
