import { INITIAL_ENERGY, MAX_ENERGY, MAX_STEPS, MIN_STEP_MS, makeSteps, stepEnergy, type Action, type Direction, type InputEvent, type Mode } from '../functions/src/shared/rules';
import type { CompanionId, WorldId } from './content';

export type RunOptions = { world?: WorldId; goal?: number; mistakeLimit?: number; companion?: CompanionId; starOffset?: number };
export type RunProgress = { score: number; worldId: WorldId; combo: number; maxCombo: number; mistakes: number; mistakesLeft?: number; collected: number; nextAction: Action };
export type RunResult = { score: number; inputs: InputEvent[]; reason: 'wrong' | 'time' | 'finished'; mode: Mode; mistakes: number; maxCombo: number; collected: number };
export type StepOutcome = 'blocked' | 'mistake' | 'step';
const WORLD_ORDER: WorldId[] = ['meadow', 'sunset', 'forest', 'snow', 'space'];

export function worldForScore(score: number): WorldId {
  return WORLD_ORDER[Math.floor(Math.max(0, score) / 50) % WORLD_ORDER.length];
}

/** Pure run state. Rendering and pauses never alter the timed challenge rules. */
export class StairSession {
  readonly steps;
  readonly goal: number;
  readonly starOffset: number;
  readonly mistakeLimit?: number;
  score = 0;
  facing: Direction = 1;
  energy = INITIAL_ENERGY;
  activeTime = 0;
  combo = 0;
  maxCombo = 0;
  mistakes = 0;
  reason: RunResult['reason'] | null = null;
  private lastInput = -1000;
  private inputs: InputEvent[] = [];

  constructor(seed: number, readonly mode: Mode, readonly options: RunOptions = {}) {
    this.steps = makeSteps(seed);
    this.goal = Number.isFinite(options.goal) ? Math.max(1, Math.min(MAX_STEPS, Math.floor(options.goal!))) : MAX_STEPS;
    this.starOffset = Number.isFinite(options.starOffset) ? Math.max(0, Math.floor(options.starOffset!)) % 10 : 0;
    this.mistakeLimit = mode === 'practice' && Number.isFinite(options.mistakeLimit)
      ? Math.max(1, Math.floor(options.mistakeLimit!)) : undefined;
  }

  advance(delta: number): void {
    if (this.reason !== null) return;
    this.activeTime += delta;
    if (this.mode === 'challenge') {
      this.energy -= delta;
      if (this.energy <= 0) this.reason = 'time';
    }
  }

  act(action: Action): StepOutcome {
    if (this.reason !== null || this.activeTime - this.lastInput < MIN_STEP_MS) return 'blocked';
    this.lastInput = this.activeTime;
    const nextFacing: Direction = action === 'turn' ? (this.facing === 1 ? -1 : 1) : this.facing;
    if (this.steps[this.score + 1].direction !== nextFacing) {
      this.mistakes++;
      this.combo = 0;
      if (this.mode === 'challenge' || (this.mistakeLimit !== undefined && this.mistakes >= this.mistakeLimit)) this.reason = 'wrong';
      return 'mistake';
    }
    this.facing = nextFacing;
    this.score++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.inputs.push({ action, at: Math.round(this.activeTime) });
    this.energy = Math.min(MAX_ENERGY, this.energy + stepEnergy(this.score));
    // Complete on the final successful input, including the global safety cap.
    if (this.score >= this.goal) this.reason = 'finished';
    return 'step';
  }

  getProgress(): RunProgress {
    return {
      score: this.score, worldId: this.options.world ?? worldForScore(this.score),
      combo: this.combo, maxCombo: this.maxCombo, mistakes: this.mistakes,
      mistakesLeft: this.mistakeLimit === undefined ? undefined : Math.max(0, this.mistakeLimit - this.mistakes),
      collected: Math.floor((this.score + this.starOffset) / 10),
      nextAction: this.steps[this.score + 1].direction === this.facing ? 'climb' : 'turn',
    };
  }

  getResult(): RunResult {
    return { score: this.score, inputs: [...this.inputs], reason: this.reason ?? 'finished', mode: this.mode, mistakes: this.mistakes, maxCombo: this.maxCombo, collected: Math.floor((this.score + this.starOffset) / 10) };
  }
}
