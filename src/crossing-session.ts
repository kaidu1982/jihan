import type { MiniAction, MiniOptions, MiniSession, MiniStatus } from './mini-types';

export type CrossingRow = { index: number; kind: 'grass' | 'road' | 'finish'; direction: number; speed: number; phase: number; gap: number; width: number; color: number };
export const CROSSING_COLUMNS = 7, CROSSING_MOVE_MS = 145;
export function makeCrossingCourse(seed: number, level = 0): CrossingRow[] {
  let state = (Number.isFinite(seed) ? seed : 1) >>> 0;
  const random = (): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
  const goal = [10, 14, 18][Math.max(0, Math.min(2, Math.floor(level)))];
  return Array.from({ length: goal + 1 }, (_, index) => ({ index,
    kind: index === goal ? 'finish' : index < 2 || index % 4 === 0 ? 'grass' : 'road',
    direction: index % 2 ? 1 : -1, speed: .57 + random() * .21 + Math.min(2, Math.max(0, level)) * .07,
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
  feedback = '차가 지나간 뒤에 한 칸씩 건너봐요!';
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
    if (row.kind !== 'road') return [];
    const base = ((row.phase + row.direction * row.speed * elapsed / 1000) % row.gap + row.gap) % row.gap;
    return [-2, -1, 0, 1, 2].map(index => base + index * row.gap).filter(center => center > -1.5 && center < CROSSING_COLUMNS + .5);
  }
  act(action: MiniAction): void {
    if (this.finished || this.moving) return;
    const moves: Partial<Record<MiniAction, [number, number]>> = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };
    const move = moves[action]; if (!move) return;
    const column = this.column + move[0], row = this.row + move[1];
    if (column < 0 || column >= CROSSING_COLUMNS || row < 0 || row > this.goal) { this.feedback = '길 안에서 한 칸씩 움직여요.'; return; }
    this.from = { row: this.row, column: this.column }; this.column = column; this.row = row; this.moveElapsed = 0;
    this.feedback = this.rows[row].kind === 'road' ? '차가 오는 쪽을 살펴봐요!' : '풀밭에서는 편하게 쉬어도 돼요.';
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
        if (road.kind !== 'road' || Math.abs(this.visualRow - road.index) > .32) continue;
        if (this.cars(road).some(center => Math.abs(center - this.visualColumn) < road.width / 2 + .22)) { hit = true; break; }
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
    return { score: Math.max(0, this.row * 10 + this.stars * 5 - this.mistakes * 3), stars: this.stars,
      progress: this.row / this.goal, label: `${this.row} / ${this.goal}칸`,
      detail: `차를 살펴보고 한 칸씩! · 풀밭에서 쉬어가요`, finished: this.finished, won: this.finished,
      summary: `차를 살피며 ${this.goal}칸을 건너 친구들에게 도착했어요!`, feedback: this.feedback, mistakes: this.mistakes };
  }
}
