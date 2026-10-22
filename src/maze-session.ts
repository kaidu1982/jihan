import type { MiniAction, MiniOptions, MiniSession, MiniStatus } from './mini-types';

export type MazePoint = { x: number; y: number };
export type MazeBoard = {
  size: number;
  tiles: string[];
  start: MazePoint;
  key: MazePoint;
  chest: MazePoint;
  gems: MazePoint[];
};

const DIRECTIONS: Record<string, MazePoint> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
export const sameMazePoint = (a: MazePoint, b: MazePoint): boolean => a.x === b.x && a.y === b.y;
const pointId = ({ x, y }: MazePoint): string => `${x},${y}`;

export function isMazePath(maze: MazeBoard, point: MazePoint): boolean {
  return maze.tiles[point.y]?.[point.x] === '.';
}

/** Inclusive shortest route. Useful both for the free hint and for accessible input helpers. */
export function getMazePath(maze: MazeBoard, from: MazePoint, to: MazePoint): MazePoint[] {
  if (!isMazePath(maze, from) || !isMazePath(maze, to)) return [];
  const queue: MazePoint[] = [{ ...from }];
  const previous = new Map<string, MazePoint | null>([[pointId(from), null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (sameMazePoint(current, to)) {
      const path: MazePoint[] = [];
      let next: MazePoint | null = current;
      while (next) {
        path.push(next);
        next = previous.get(pointId(next)) ?? null;
      }
      return path.reverse();
    }
    for (const delta of Object.values(DIRECTIONS)) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      if (!isMazePath(maze, next) || previous.has(pointId(next))) continue;
      previous.set(pointId(next), current);
      queue.push(next);
    }
  }
  return [];
}

/** A seeded, connected tree of garden paths: every key and treasure is reachable. */
export function makeMaze(seed: number, level = 0): MazeBoard {
  const stage = Number.isFinite(level) ? Math.max(0, Math.min(2, Math.floor(level))) : 0;
  const size = [7, 9, 11][stage];
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 14739) >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const cells = Array.from({ length: size }, () => Array<string>(size).fill('#'));
  const start = { x: 1, y: 1 };
  cells[start.y][start.x] = '.';
  const frontier: { from: MazePoint; to: MazePoint }[] = [];
  const addFrontier = (from: MazePoint): void => {
    for (const direction of Object.values(DIRECTIONS)) {
      const to = { x: from.x + direction.x * 2, y: from.y + direction.y * 2 };
      if (to.x > 0 && to.y > 0 && to.x < size - 1 && to.y < size - 1 && cells[to.y][to.x] === '#') {
        frontier.push({ from, to });
      }
    }
  };
  addFrontier(start);
  while (frontier.length) {
    const index = Math.floor(random() * frontier.length);
    const edge = frontier.splice(index, 1)[0];
    if (cells[edge.to.y][edge.to.x] === '.') continue;
    cells[edge.to.y][edge.to.x] = '.';
    cells[(edge.from.y + edge.to.y) / 2][(edge.from.x + edge.to.x) / 2] = '.';
    addFrontier(edge.to);
  }
  const maze: MazeBoard = { size, tiles: cells.map(row => row.join('')), start, key: start, chest: start, gems: [] };
  const rooms: MazePoint[] = [];
  for (let y = 1; y < size - 1; y += 2) for (let x = 1; x < size - 1; x += 2) rooms.push({ x, y });
  const farthest = (from: MazePoint, excluded: MazePoint[]): MazePoint => rooms
    .filter(point => !excluded.some(other => sameMazePoint(point, other)))
    .sort((a, b) => getMazePath(maze, from, b).length - getMazePath(maze, from, a).length)[0];
  maze.key = farthest(start, [start]);
  maze.chest = farthest(maze.key, [start, maze.key]);
  const solution = [...getMazePath(maze, start, maze.key), ...getMazePath(maze, maze.key, maze.chest).slice(1)];
  const candidates = solution.filter((point, index) =>
    ![start, maze.key, maze.chest].some(other => sameMazePoint(point, other)) &&
    solution.findIndex(other => sameMazePoint(point, other)) === index);
  const count = Math.min(stage + 3, candidates.length);
  maze.gems = Array.from({ length: count }, (_, index) => ({ ...candidates[Math.floor((index + .5) * candidates.length / count)] }));
  return maze;
}

/** A turn-based maze has no timer: advance only animates feedback and never moves the child. */
export class MazeSession implements MiniSession {
  readonly maze: MazeBoard;
  readonly level: number;
  readonly character: string;
  position: MazePoint;
  previousPosition: MazePoint;
  movementAge = 1000;
  elapsed = 0;
  steps = 0;
  stars = 0;
  hasKey = false;
  finished = false;
  readonly collectedGems = new Set<string>();
  hintPath: MazePoint[] = [];
  feedback = '반짝이는 열쇠를 찾아보자!';
  private feedbackUntil = 0;
  private hintUntil = 0;

  constructor(options: Partial<MiniOptions> = {}) {
    this.level = Number.isFinite(options.level) ? Math.max(0, Math.min(2, Math.floor(options.level!))) : 0;
    this.character = ['child', 'fox', 'bunny'].includes(options.character ?? '') ? options.character! : 'child';
    this.maze = makeMaze(options.seed ?? 14739, this.level);
    this.position = { ...this.maze.start };
    this.previousPosition = { ...this.position };
  }

  advance(deltaMs: number): void {
    if (this.finished || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    // There is deliberately no time limit, timeout, or time-based reward.
    this.elapsed = Math.min(Number.MAX_SAFE_INTEGER, this.elapsed + deltaMs);
    this.movementAge = Math.min(1000, this.movementAge + deltaMs);
    if (this.feedbackUntil > 0 && this.elapsed >= this.feedbackUntil) {
      this.feedback = '';
      this.feedbackUntil = 0;
    }
    if (this.hintUntil > 0 && this.elapsed >= this.hintUntil) {
      this.hintPath = [];
      this.hintUntil = 0;
    }
  }

  private say(message: string): void {
    this.feedback = message;
    this.feedbackUntil = this.elapsed + 2600;
  }

  act(action: MiniAction): void {
    if (this.finished) return;
    if (action === 'hint') {
      this.hintPath = getMazePath(this.maze, this.position, this.hasKey ? this.maze.chest : this.maze.key).slice(0, 5);
      this.hintUntil = this.elapsed + 5000;
      const next = this.hintPath[1];
      const direction = next ? next.x > this.position.x ? '오른쪽' : next.x < this.position.x ? '왼쪽' : next.y > this.position.y ? '아래쪽' : '위쪽' : '';
      this.say(direction ? `다음은 ${direction}이에요. 반짝이는 발자국을 따라가 봐!` : '목표에 도착했어요!');
      return;
    }
    const delta = DIRECTIONS[action];
    if (!delta) return;
    const next = { x: this.position.x + delta.x, y: this.position.y + delta.y };
    if (!isMazePath(this.maze, next)) {
      this.say('여기는 울타리야. 다른 길을 찾아보자!');
      return;
    }
    this.previousPosition = { ...this.position };
    this.position = next;
    this.movementAge = 0;
    this.steps++;
    if (this.hintPath.length) {
      this.hintPath = getMazePath(this.maze, this.position, this.hasKey ? this.maze.chest : this.maze.key).slice(0, 5);
    }
    if (this.maze.gems.some(gem => sameMazePoint(gem, next)) && !this.collectedGems.has(pointId(next))) {
      this.collectedGems.add(pointId(next));
      this.stars++;
      this.say('보석 발견! 별 하나를 모았어.');
    }
    if (!this.hasKey && sameMazePoint(next, this.maze.key)) {
      this.hasKey = true;
      this.hintPath = [];
      this.say('열쇠를 찾았어! 이제 보물상자로 가자!');
    }
    if (sameMazePoint(next, this.maze.chest)) {
      if (!this.hasKey) {
        this.say('찰칵! 반짝이는 열쇠가 필요해.');
      } else {
        this.finished = true;
        this.stars += 5;
        this.hintPath = [];
        this.feedback = '보물상자가 열렸어! 탐험 성공!';
      }
    }
  }

  getStatus(): MiniStatus {
    return {
      score: this.steps, stars: this.stars,
      progress: this.finished ? 1 : .1 + (this.hasKey ? .5 : 0) + .25 * this.collectedGems.size / this.maze.gems.length,
      label: `${this.steps}걸음`,
      detail: this.finished ? '보물 찾기 성공!' : this.hasKey ? '🔑 열쇠 찾음 · 보물상자를 열자!' : '🔑 열쇠를 먼저 찾아보자!',
      finished: this.finished, won: this.finished,
      summary: this.finished ? `${this.steps}걸음으로 보물을 찾았어! 보석 ${this.collectedGems.size}개와 완주 별 5개를 모았어.` : '시간 제한 없이 천천히 탐험해요.',
      feedback: this.feedback,
    };
  }
}
