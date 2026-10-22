import type { Action } from '../functions/src/shared/rules';
import type { RunOptions, RunProgress } from './game-session';

/** A short, repeatable route: three climbs, a first turn, then both buttons. */
export const STAIRS_LESSON = {
  seed: 246801,
  goal: 12,
  options: { world: 'meadow', goal: 12, collectStars: false } satisfies RunOptions,
} as const;

export type LessonCue = {
  step: number;
  chapter: string;
  instruction: string;
  explanation: string;
  action?: Action;
};

export function lessonCue(progress: Pick<RunProgress, 'score' | 'nextAction'>): LessonCue {
  if (progress.score >= STAIRS_LESSON.goal) {
    return { step: STAIRS_LESSON.goal, chapter: '두 버튼을 모두 배웠어요!', instruction: '조작 교실 졸업! 🎓', explanation: '이제 세계 모험으로 떠나 볼까요?' };
  }
  const step = Math.max(0, Math.floor(progress.score)) + 1;
  return {
    step,
    chapter: step <= 3 ? '1. 오르기 익히기' : step === 4 ? '2. 방향 바꾸기 익히기' : '3. 두 버튼 함께 쓰기',
    instruction: progress.nextAction === 'turn' ? '← 방향 바꾸기를 눌러요!' : '오르기를 눌러요! →',
    explanation: progress.nextAction === 'turn'
      ? '계단이 반대쪽에 있어요. 돌아서며 한 칸 올라가요.'
      : '바라보는 쪽에 계단이 있어요. 그대로 한 칸 올라가요.',
    action: progress.nextAction,
  };
}
