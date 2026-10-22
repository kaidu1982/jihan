import { normalizeName } from '../functions/src/shared/rules';
import type { RunOptions } from './game-session';

export const PRACTICE_GOALS = [20, 50, 100, 'endless'] as const;
export type PracticeGoal = typeof PRACTICE_GOALS[number];
export const DEFAULT_PRACTICE_GOAL: PracticeGoal = 20;
const KEY = 'jihan-stairs-practice-v1';
type GoalStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isPracticeGoal(value: unknown): value is PracticeGoal {
  return PRACTICE_GOALS.some(goal => goal === value);
}
export function practiceGoalLabel(goal: PracticeGoal): string {
  return goal === 'endless' ? '끝없이' : `${goal}계단`;
}
export function practiceRunOptions(goal: PracticeGoal): RunOptions {
  return goal === 'endless' ? {} : { goal };
}
export function nextPracticeGoal(goal: PracticeGoal): PracticeGoal | undefined {
  return goal === 20 ? 50 : goal === 50 ? 100 : undefined;
}

/** Goal preferences live separately so older scores and adventure rewards keep their format. */
export class PracticeGoalStore {
  private goals: Record<string, PracticeGoal> = Object.create(null);
  private storage?: GoalStorage;
  constructor(storage?: GoalStorage) {
    try {
      this.storage = storage ?? globalThis.localStorage;
      const data: unknown = JSON.parse(this.storage?.getItem(KEY) || '{}');
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [key, goal] of Object.entries(data).slice(0, 1000)) {
          if (key.startsWith('name:') && isPracticeGoal(goal)) this.goals[key] = goal;
        }
      }
    } catch { /* Play remains available when storage is blocked or damaged. */ }
  }
  get(name: string): PracticeGoal {
    try { return this.goals[`name:${normalizeName(name)}`] ?? DEFAULT_PRACTICE_GOAL; }
    catch { return DEFAULT_PRACTICE_GOAL; }
  }
  select(name: string, goal: PracticeGoal): boolean {
    if (!isPracticeGoal(goal)) return false;
    try { this.goals[`name:${normalizeName(name)}`] = goal; }
    catch { return false; }
    return this.persist();
  }
  delete(name: string): boolean {
    try { delete this.goals[`name:${normalizeName(name)}`]; }
    catch { return false; }
    return this.persist();
  }
  private persist(): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(KEY, JSON.stringify(this.goals));
      return true;
    } catch { return false; }
  }
}
