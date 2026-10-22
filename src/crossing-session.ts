import type { MiniAction, MiniOptions, MiniSession, MiniStatus } from './mini-types';

export type CrossingRow = { index: number; kind: 'grass' | 'road' | 'crosswalk' | 'rail' | 'finish'; direction: number; speed: number; phase: number; gap: number; width: number; color: number };
export const CROSSING_COLUMNS = 7, CROSSING_MOVE_MS = 145;
export const CROSSING_WALK_MS = 7000, CROSSING_FLASH_MS = 1500, CROSSING_TRAFFIC_MS = 5500;
const SIGNAL_CYCLE_MS = CROSSING_WALK_MS + CROSSING_FLASH_MS + CROSSING_TRAFFIC_MS;
export const CROSSING_TRAIN_CLEAR_MS = 5600, CROSSING_TRAIN_WARNING_MS = 2000, CROSSING_TRAIN_PASS_MS = 1200;
export const CROSSING_TRAIN_WIDTH = 4.2;
const TRAIN_CYCLE_MS = CROSSING_TRAIN_CLEAR_MS + CROSSING_TRAIN_WARNING_MS + CROSSING_TRAIN_PASS_MS;
export type CrossingTrainState = { phase: 'clear' | 'warning' | 'passing'; remainingMs: number; center?: number; width: number };
export type CrossingSignalState = { phase: 'walk' | 'flashing' | 'traffic'; remainingMs: number; center?: number; width: number };
export type CrossingHazard = { kind: 'car' | 'train'; center: number; width: number };
export function makeCrossingCourse(seed: number, level = 0): CrossingRow[] {
  let state = (Number.isFinite(seed) ? seed : 1) >>> 0;
  const random = (): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
  const courseLevel = Number.isFinite(level) ? Math.max(0, Math.min(2, Math.floor(level))) : 0;
  const goal = [10, 14, 18][courseLevel];
  return Array.from({ length: goal + 1 }, (_, index) => ({ index,
    kind: index === goal ? 'finish' : index === 2 ? 'crosswalk' : ((courseLevel >= 1 && index === 6) || (courseLevel === 2 && index === 14)) ? 'rail'
      : index < 2 || index === 3 || index % 4 === 0 || (courseLevel >= 1 && index === 5) || (courseLevel === 2 && index === 13) ? 'grass' : 'road',
    direction: index % 2 ? 1 : -1, speed: .57 + random() * .21 + courseLevel * .07,
    phase: random() * 5.8, gap: 5.6 + random() * .8, width: 1.05 + random() * .35, color: Math.floor(random() * 4),
  }));
}

export class CrossingSession implements MiniSession {
  readonly rows: CrossingRow[];
  readonly level: number;
  readonly character: string;
  readonly coins: { row: number; column: number; collected: boolean }[];
  column = 3; row = 0; visualColumn = 3; visualRow = 0;
  elapsed = 0; mistakes = 0; stars = 0; finished = false;
  feedback = '초록불에 좌우를 보고, 한 칸씩 건너봐요!';
  private checkpoint = { row: 0, column: 3 };
  private from = { row: 0, column: 3 };
  private moveElapsed = CROSSING_MOVE_MS;
  private protectedUntil = 0;
  constructor(options: MiniOptions | number = { seed: 73129, level: 0, character: 'chick' }) {
    const config = typeof options === 'number' ? { seed: options, level: 0, character: 'chick' } : options;
    this.level = Number.isFinite(config.level) ? Math.max(0, Math.min(2, Math.floor(config.level))) : 0;
    this.character = config.character; this.rows = makeCrossingCourse(config.seed, this.level);
    this.coins = this.rows.filter(item => item.kind === 'grass' && item.index > 0).map((item, i) => ({ row: item.index, column: [3, 1, 5, 2, 4][i % 5], collected: false }));
  }
  get goal(): number { return this.rows.length - 1; }
  get moving(): boolean { return this.moveElapsed < CROSSING_MOVE_MS; }
  get protected(): boolean { return this.elapsed < this.protectedUntil; }
  cars(row: CrossingRow, elapsed = this.elapsed): number[] {
    if (row.kind === 'crosswalk') {
      const signal = this.signalState(row, elapsed)!;
      return signal.phase === 'traffic' ? [signal.center!] : [];
    }
    if (row.kind !== 'road') return [];
    const base = ((row.phase + row.direction * row.speed * elapsed / 1000) % row.gap + row.gap) % row.gap;
    return [-2, -1, 0, 1, 2].map(index => base + index * row.gap).filter(center => center > -1.5 && center < CROSSING_COLUMNS + .5);
  }
  /** Green and flashing signals stop all cars; one car crosses only on the vehicle signal. */
  signalState(row: CrossingRow, elapsed = this.elapsed): CrossingSignalState | undefined {
    if (row.kind !== 'crosswalk') return undefined;
    const offset = row.phase * 250;
    const time = ((elapsed + offset) % SIGNAL_CYCLE_MS + SIGNAL_CYCLE_MS) % SIGNAL_CYCLE_MS;
    if (time < CROSSING_WALK_MS) return { phase: 'walk', remainingMs: CROSSING_WALK_MS - time, width: row.width };
    if (time < CROSSING_WALK_MS + CROSSING_FLASH_MS) return { phase: 'flashing', remainingMs: CROSSING_WALK_MS + CROSSING_FLASH_MS - time, width: row.width };
    const progress = (time - CROSSING_WALK_MS - CROSSING_FLASH_MS) / CROSSING_TRAFFIC_MS;
    // Canvas columns begin at x=38. Both endpoints put the complete car beyond the screen.
    const start = -row.width / 2 - 1, end = CROSSING_COLUMNS + row.width / 2 + 1;
    return { phase: 'traffic', remainingMs: SIGNAL_CYCLE_MS - time, width: row.width,
      center: row.direction > 0 ? start + (end - start) * progress : end - (end - start) * progress };
  }
  /** Signals and the moving train share one deterministic, pause-safe clock. */
  trainState(row: CrossingRow, elapsed = this.elapsed): CrossingTrainState | undefined {
    if (row.kind !== 'rail') return undefined;
    const offset = row.phase * 550;
    const time = ((elapsed + offset) % TRAIN_CYCLE_MS + TRAIN_CYCLE_MS) % TRAIN_CYCLE_MS;
    if (time < CROSSING_TRAIN_CLEAR_MS) return { phase: 'clear', remainingMs: CROSSING_TRAIN_CLEAR_MS - time, width: CROSSING_TRAIN_WIDTH };
    if (time < CROSSING_TRAIN_CLEAR_MS + CROSSING_TRAIN_WARNING_MS) return { phase: 'warning', remainingMs: CROSSING_TRAIN_CLEAR_MS + CROSSING_TRAIN_WARNING_MS - time, width: CROSSING_TRAIN_WIDTH };
    const progress = (time - CROSSING_TRAIN_CLEAR_MS - CROSSING_TRAIN_WARNING_MS) / CROSSING_TRAIN_PASS_MS;
    const start = -CROSSING_TRAIN_WIDTH / 2 - 1.2;
    const end = CROSSING_COLUMNS - 1 - start;
    return { phase: 'passing', remainingMs: TRAIN_CYCLE_MS - time, width: CROSSING_TRAIN_WIDTH,
      center: row.direction > 0 ? start + (end - start) * progress : end - (end - start) * progress };
  }
  /** Actual bodies only: a red warning light is never a collision. */
  hazards(row: CrossingRow, elapsed = this.elapsed): CrossingHazard[] {
    if (row.kind === 'road' || row.kind === 'crosswalk') return this.cars(row, elapsed).map(center => ({ kind: 'car', center, width: row.width }));
    const train = this.trainState(row, elapsed);
    return train?.phase === 'passing' ? [{ kind: 'train', center: train.center!, width: train.width }] : [];
  }
  act(action: MiniAction): void {
    if (this.finished || this.moving) return;
    const moves: Partial<Record<MiniAction, [number, number]>> = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };
    const move = moves[action]; if (!move) return;
    const column = this.column + move[0], row = this.row + move[1];
    if (column < 0 || column >= CROSSING_COLUMNS || row < 0 || row > this.goal) { this.feedback = '길 안에서 한 칸씩 움직여요.'; return; }
    this.from = { row: this.row, column: this.column }; this.column = column; this.row = row; this.moveElapsed = 0;
    this.feedback = this.rows[row].kind === 'road' ? '차가 오는 쪽을 살펴봐요!'
      : this.rows[row].kind === 'crosswalk' ? '횡단보도에서는 멈추지 말고 다음 풀밭으로 가요!'
      : this.rows[row].kind === 'rail' ? '기찻길은 멈추지 말고 한 칸씩 건너요!'
        : this.rows[row + 1]?.kind === 'crosswalk' ? '횡단보도 앞 풀밭이에요. 초록불을 기다려요.'
        : this.rows[row + 1]?.kind === 'rail' ? '기찻길 앞 풀밭이에요. 신호를 보고 기다려요.' : '풀밭에서는 편하게 쉬어도 돼요.';
  }
  advance(deltaMs: number): void {
    if (this.finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let remaining = Math.min(deltaMs, 60_000);
    while (remaining > 1e-7 && !this.finished) {
      const delta = Math.min(8, remaining); this.elapsed += delta; remaining -= delta;
      this.moveElapsed = Math.min(CROSSING_MOVE_MS, this.moveElapsed + delta);
      const progress = this.moveElapsed / CROSSING_MOVE_MS;
      this.visualColumn = this.from.column + (this.column - this.from.column) * progress;
      this.visualRow = this.from.row + (this.row - this.from.row) * progress;
      let hit = false;
      if (!this.protected) for (const road of this.rows) {
        if (Math.abs(this.visualRow - road.index) > .32) continue;
        if (this.hazards(road).some(hazard => Math.abs(hazard.center - this.visualColumn) < hazard.width / 2 + .22)) { hit = true; break; }
      }
      if (hit) {
        this.mistakes++; this.protectedUntil = this.elapsed + 1500;
        this.row = this.visualRow = this.checkpoint.row; this.column = this.visualColumn = this.checkpoint.column;
        this.from = { ...this.checkpoint }; this.moveElapsed = CROSSING_MOVE_MS; this.feedback = '괜찮아! 가까운 풀밭에서 다시 출발해요.';
      }
      if (!this.moving) this.arrive();
    }
  }
  private arrive(): void {
    if (this.rows[this.row].kind === 'grass') this.checkpoint = { row: this.row, column: this.column };
    const coin = this.coins.find(item => !item.collected && item.row === this.row && item.column === this.column);
    if (coin) { coin.collected = true; this.stars += 2; this.feedback = '반짝이는 별 두 개를 찾았어요!'; }
    if (this.row === this.goal && !this.finished) { this.finished = true; this.stars += 5; this.feedback = '끝까지 건넜어요! 친구들이 기다리고 있어요.'; }
  }
  getStatus(): MiniStatus {
    const collected = this.coins.filter(coin => coin.collected).length, target = Math.min(2, this.coins.length);
    const nextRail = this.rows.find(row => row.kind === 'rail' && row.index >= this.row);
    // Keep the traffic advice on roads far from the next railway: waiting is safe on grass.
    const train = nextRail && nextRail.index - this.row <= 2 ? this.trainState(nextRail) : undefined;
    const crosswalk = this.rows.find(row => row.kind === 'crosswalk' && row.index >= this.row);
    const signal = crosswalk && crosswalk.index - this.row <= 2 ? this.signalState(crosswalk) : undefined;
    const detail = this.rows[this.row].kind === 'crosswalk' ? '🚶 횡단보도에서는 멈추지 말고 다음 풀밭으로 가요!'
      : signal ? signal.phase === 'walk' ? `🚶 초록불 ${Math.ceil(signal.remainingMs / 1000)}초! 좌우를 보고 건너요.`
        : signal.phase === 'flashing' ? '🚦 초록불이 깜빡여요. 앞 풀밭에서 다음 초록불을 기다려요.'
          : `🚗 차량 신호예요. 앞 풀밭에서 ${Math.ceil(signal.remainingMs / 1000)}초 기다려요.`
      : this.rows[this.row].kind === 'rail' ? '🚂 기찻길에서는 멈추지 말고 풀밭으로 이동해요!'
      : train ? train.phase === 'clear' ? '🚦 초록불! 좌우를 보고 기찻길을 건너요.'
      : train.phase === 'warning' ? `🚦 기차가 곧 와요! 앞 풀밭에서 ${Math.ceil(train.remainingMs / 1000)}초 기다려요.`
        : '🚂 기차가 지나가요! 앞 풀밭에서 기다려요.' : '차를 살펴보고 한 칸씩! · 풀밭에서 쉬어가요';
    return { score: Math.max(0, this.row * 10 + this.stars * 5 - this.mistakes * 3), stars: this.stars,
      progress: this.row / this.goal, label: `${this.row} / ${this.goal}칸`,
      detail, finished: this.finished, won: this.finished,
      summary: `횡단보도 신호와 ${this.level ? '차·기차' : '차'}를 살피며 ${this.goal}칸을 건넜어요!`, feedback: this.feedback, mistakes: this.mistakes,
      objectives: [
        { id: 'finish', label: '친구들에게 도착', done: this.finished },
        { id: 'star-path', label: `별길 ${target}곳 찾기 (${Math.min(collected, target)}/${target})`, done: collected >= target },
        { id: 'careful', label: '실수 2번 이하로 완주', done: this.finished && this.mistakes <= 2 },
      ] };
  }
}
