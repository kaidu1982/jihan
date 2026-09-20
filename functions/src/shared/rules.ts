export class RuleError extends Error { readonly status = 400; }

export const RULES_VERSION = 'stairs-v1';
export const BOARD_ID = 'stairs-challenge-v1';
export const INITIAL_ENERGY = 6500;
export const MAX_ENERGY = 6500;
export const MIN_STEP_MS = 55;
export const MAX_STEPS = 5000;
export type Action = 'climb' | 'turn';
export type Mode = 'practice' | 'challenge';
export type Direction = -1 | 1;
export type InputEvent = { action: Action; at: number };
export type Step = { x: number; direction: Direction };

export function makeSteps(seed: number, count = MAX_STEPS + 2): Step[] {
  let value = seed >>> 0;
  const random = () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const steps: Step[] = [{ x: 0, direction: 1 }];
  let x = 0;
  let direction: Direction = 1;
  let streak = 0;
  for (let i = 1; i < count; i++) {
    if (i > 3 && (streak >= 5 || (streak >= 2 && random() < 0.36))) {
      direction = direction === 1 ? -1 : 1;
      streak = 0;
    }
    if (x + direction > 3 || x + direction < -3) {
      direction = direction === 1 ? -1 : 1;
      streak = 0;
    }
    x += direction;
    streak++;
    steps.push({ x, direction });
  }
  return steps;
}

export function stepEnergy(score: number): number {
  return Math.max(430, 1150 - Math.floor(score / 15) * 70);
}

export function validateRun(seed: number, inputs: InputEvent[], elapsedMs: number): number {
  if (!Array.isArray(inputs) || inputs.length > MAX_STEPS || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RuleError('올바르지 않은 플레이 기록입니다.');
  }
  const steps = makeSteps(seed, inputs.length + 2);
  let facing: Direction = 1;
  let previous = 0;
  let energy = INITIAL_ENERGY;
  let score = 0;
  for (const input of inputs) {
    if (!input || !['climb', 'turn'].includes(input.action) || !Number.isInteger(input.at) || input.at < 0 || input.at > elapsedMs + 1500) {
      throw new RuleError('입력 기록을 확인할 수 없습니다.');
    }
    const delta = input.at - previous;
    if (delta < 0 || (score > 0 && delta < MIN_STEP_MS)) throw new RuleError('입력 간격이 올바르지 않습니다.');
    energy -= delta;
    if (energy <= 0) throw new RuleError('시간이 종료된 기록입니다.');
    if (input.action === 'turn') facing = facing === 1 ? -1 : 1;
    if (steps[score + 1].direction !== facing) throw new RuleError('계단 경로와 입력이 일치하지 않습니다.');
    score++;
    energy = Math.min(MAX_ENERGY, energy + stepEnergy(score));
    previous = input.at;
  }
  return score;
}

export function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new RuleError('캐릭터 이름을 입력해 주세요.');
  const name = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N} _-]{1,12}$/u.test(name)) throw new RuleError('이름은 한글·영문·숫자로 1~12자 입력해 주세요.');
  return name;
}
