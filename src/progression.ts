import { ACHIEVEMENTS, ADVENTURE_STAGES, COMPANIONS, DAILY_MISSIONS, type AchievementId, type CompanionId, type GameMode, type MissionId } from './content';

export const PROGRESS_KEY_PREFIX = 'jihan-stairs-progress-v1:';
export const MAX_RUN_RECEIPTS = 128;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type DailyProgress = { dateKey: string; stairs: number; runs: number; best: number; missionIds: MissionId[] };
export type RunReceipt = { runId: string; startedAt: number; mode: GameMode; dateKey: string; score: number; stageId?: string; completed: boolean; countedDailyRun: boolean; mistakes: number };
export type ProfileProgress = {
  version: 1; stars: number; totalStairs: number; bestRun: number; bestCombo: number; runCount: number;
  ownedCompanions: CompanionId[]; equippedCompanion: CompanionId;
  completedStages: string[]; achievements: AchievementId[]; dailyBestEver: number;
  daily: DailyProgress; receipts: RunReceipt[]; prunedBefore: number;
};
export type RunSnapshot = { runId: string; mode: GameMode; score: number; stageId?: string; completed?: boolean; dateKey?: string; maxCombo?: number; mistakes?: number };
export type ProgressUpdate = { progress: ProfileProgress; stored: boolean; accepted: boolean; earnedStars: number; newAchievements: AchievementId[]; completedMissions: MissionId[]; stageUnlocked?: string };
export type CompanionUpdate = { progress: ProfileProgress; stored: boolean; ok: boolean };

const MAX_COUNT = 1_000_000_000;
const SEOUL_OFFSET = 9 * 60 * 60 * 1000;
const modes: readonly string[] = ['challenge', 'practice', 'adventure', 'daily'];
const plainObject = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown, fallback = 0, max = MAX_COUNT): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(max, Math.floor(value)) : fallback;
const uniqueKnown = <T extends string>(value: unknown, known: readonly T[]): T[] => Array.isArray(value) ? [...new Set(value.filter((item): item is T => typeof item === 'string' && known.includes(item as T)))] : [];

/** Korea's calendar day, independent of the browser's language and timezone. */
export function seoulDateKey(now: Date | number = Date.now()): string {
  const value = Number(now);
  if (!Number.isFinite(value)) throw new RangeError('A valid date is required.');
  return new Date(value + SEOUL_OFFSET).toISOString().slice(0, 10);
}
function validDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
/** Everyone sees the same route on the same Korean calendar day. */
export function dailySeed(dateKey = seoulDateKey()): number {
  if (!validDateKey(dateKey)) throw new RangeError('A valid Korean calendar day is required.');
  let hash = 0x811c9dc5;
  for (const letter of `jihan-daily-v1:${dateKey}`) hash = Math.imul(hash ^ letter.charCodeAt(0), 0x01000193);
  return hash >>> 0;
}
let lastRunTime = 0;
/** Timestamp makes old, evicted receipts rejectable without keeping a lifetime run log. */
export function createProgressRunId(now: Date | number = Date.now()): string {
  const time = Number(now);
  if (!Number.isSafeInteger(time) || time < 0) throw new RangeError('A valid run time is required.');
  lastRunTime = Math.max(time, lastRunTime + 1);
  const random = globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${lastRunTime}-${random}`;
}
function runTime(runId: unknown): number | null {
  if (typeof runId !== 'string' || runId.length > 100 || !/^\d{1,16}-[a-zA-Z0-9-]{8,80}$/.test(runId)) return null;
  const value = Number(runId.slice(0, runId.indexOf('-')));
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
const newDaily = (dateKey: string): DailyProgress => ({ dateKey, stairs: 0, runs: 0, best: 0, missionIds: [] });
export function freshProgress(dateKey = seoulDateKey()): ProfileProgress {
  return { version: 1, stars: 0, totalStairs: 0, bestRun: 0, bestCombo: 0, runCount: 0, ownedCompanions: ['cloud'], equippedCompanion: 'cloud', completedStages: [], achievements: [], dailyBestEver: 0, daily: newDaily(dateKey), receipts: [], prunedBefore: 0 };
}
function clone(progress: ProfileProgress): ProfileProgress {
  return { ...progress, ownedCompanions: [...progress.ownedCompanions], completedStages: [...progress.completedStages], achievements: [...progress.achievements], daily: { ...progress.daily, missionIds: [...progress.daily.missionIds] }, receipts: progress.receipts.map(receipt => ({ ...receipt })) };
}
function pruneReceipts(progress: ProfileProgress): void {
  progress.receipts.sort((a, b) => a.startedAt - b.startedAt || a.runId.localeCompare(b.runId));
  while (progress.receipts.length > MAX_RUN_RECEIPTS) {
    const oldest = progress.receipts.shift()!;
    progress.prunedBefore = Math.max(progress.prunedBefore, oldest.startedAt);
  }
}

/** Read only recognized fields. Corrupt or future schemas cannot inflate progress. */
export function normalizeProgress(value: unknown, dateKey = seoulDateKey()): ProfileProgress {
  const raw = plainObject(value);
  if (raw.version !== undefined && raw.version !== 1) return freshProgress(dateKey);
  const progress = freshProgress(dateKey);
  progress.stars = count(raw.stars);
  progress.totalStairs = count(raw.totalStairs);
  progress.bestRun = count(raw.bestRun, 0, 5000);
  progress.bestCombo = count(raw.bestCombo, 0, progress.bestRun);
  progress.runCount = count(raw.runCount);
  progress.ownedCompanions = uniqueKnown(['cloud', ...(Array.isArray(raw.ownedCompanions) ? raw.ownedCompanions : [])], COMPANIONS.map(companion => companion.id));
  if (typeof raw.equippedCompanion === 'string' && progress.ownedCompanions.includes(raw.equippedCompanion as CompanionId)) progress.equippedCompanion = raw.equippedCompanion as CompanionId;
  const stageIds = uniqueKnown(raw.completedStages, ADVENTURE_STAGES.map(stage => stage.id));
  for (const stage of ADVENTURE_STAGES) {
    if (!stageIds.includes(stage.id)) break;
    progress.completedStages.push(stage.id);
  }
  progress.achievements = uniqueKnown(raw.achievements, ACHIEVEMENTS.map(achievement => achievement.id));
  progress.dailyBestEver = count(raw.dailyBestEver, 0, 5000);
  const daily = plainObject(raw.daily);
  if (daily.dateKey === dateKey) progress.daily = { dateKey, stairs: count(daily.stairs), runs: count(daily.runs), best: count(daily.best, 0, 5000), missionIds: uniqueKnown(daily.missionIds, DAILY_MISSIONS.map(mission => mission.id)) };
  progress.dailyBestEver = Math.max(progress.dailyBestEver, progress.daily.best);
  progress.prunedBefore = count(raw.prunedBefore, 0, Number.MAX_SAFE_INTEGER);
  const ids = new Set<string>();
  if (Array.isArray(raw.receipts)) for (const entry of raw.receipts) {
    const receipt = plainObject(entry);
    const startedAt = runTime(receipt.runId);
    if (startedAt === null || !modes.includes(String(receipt.mode)) || !validDateKey(receipt.dateKey) || ids.has(receipt.runId as string)) continue;
    const stage = ADVENTURE_STAGES.find(stage => stage.id === receipt.stageId);
    if (receipt.mode === 'adventure' && !stage) continue;
    const runId = receipt.runId as string;
    ids.add(runId);
    progress.receipts.push({ runId, startedAt, mode: receipt.mode as GameMode, dateKey: receipt.dateKey, score: count(receipt.score, 0, 5000), stageId: receipt.mode === 'adventure' ? stage!.id : undefined, completed: receipt.completed === true, countedDailyRun: receipt.countedDailyRun === true, mistakes: count(receipt.mistakes, 0, 5000) });
  }
  pruneReceipts(progress);
  return progress;
}

export function achievementProgress(progress: ProfileProgress, id: string): number {
  switch (id) {
    case 'first-step': case 'stairs-300': case 'stairs-1000': return progress.totalStairs;
    case 'high-50': case 'high-100': return progress.bestRun;
    case 'adventure-first': case 'adventure-all': return progress.completedStages.length;
    case 'daily-150': return progress.dailyBestEver;
    default: return 0;
  }
}
export function missionProgress(progress: ProfileProgress, id: string): number {
  switch (id) {
    case 'daily-stairs': return progress.daily.stairs;
    case 'daily-runs': return progress.daily.runs;
    case 'daily-course': return progress.daily.best;
    default: return 0;
  }
}
export function stageIsUnlocked(progress: ProfileProgress, stageId: string): boolean {
  const index = ADVENTURE_STAGES.findIndex(stage => stage.id === stageId);
  return index >= 0 && (index === 0 || progress.completedStages.includes(ADVENTURE_STAGES[index - 1].id));
}
function rewardGoals(progress: ProfileProgress, result: ProgressUpdate, allowDaily: boolean): void {
  for (const achievement of ACHIEVEMENTS) {
    if (!progress.achievements.includes(achievement.id) && achievementProgress(progress, achievement.id) >= achievement.goal) {
      progress.achievements.push(achievement.id);
      progress.stars += achievement.reward;
      result.earnedStars += achievement.reward;
      result.newAchievements.push(achievement.id);
    }
  }
  if (allowDaily) for (const mission of DAILY_MISSIONS) {
    if (!progress.daily.missionIds.includes(mission.id) && missionProgress(progress, mission.id) >= mission.goal) {
      progress.daily.missionIds.push(mission.id);
      progress.stars += mission.reward;
      result.earnedStars += mission.reward;
      result.completedMissions.push(mission.id);
    }
  }
}

/** Pure, cumulative snapshot reducer: re-saving a paused or finished run adds no duplicate reward. */
export function recordProgress(current: ProfileProgress, snapshot: RunSnapshot, dateKey = seoulDateKey()): ProgressUpdate {
  const progress = clone(current);
  if (progress.daily.dateKey !== dateKey) progress.daily = newDaily(dateKey);
  const result: ProgressUpdate = { progress, stored: false, accepted: false, earnedStars: 0, newAchievements: [], completedMissions: [] };
  const startedAt = runTime(snapshot.runId);
  if (startedAt === null || !modes.includes(snapshot.mode) || !Number.isInteger(snapshot.score) || snapshot.score < 0 || snapshot.score > 5000 || (snapshot.dateKey !== undefined && !validDateKey(snapshot.dateKey))) return result;
  const stage = snapshot.mode === 'adventure' ? ADVENTURE_STAGES.find(stage => stage.id === snapshot.stageId) : undefined;
  if (snapshot.mode === 'adventure' && (!stage || !stageIsUnlocked(progress, stage.id))) return result;
  let receipt = progress.receipts.find(receipt => receipt.runId === snapshot.runId);
  const pinnedDay = snapshot.dateKey ?? receipt?.dateKey ?? dateKey;
  // Reject changed identity or mode, old scores, and all snapshots older than an evicted receipt.
  if (receipt && (receipt.mode !== snapshot.mode || receipt.stageId !== stage?.id || receipt.dateKey !== pinnedDay || snapshot.score < receipt.score || (receipt.completed && snapshot.score > receipt.score))) return result;
  if (!receipt && startedAt <= progress.prunedBefore) return result;
  if (!receipt) {
    receipt = { runId: snapshot.runId, startedAt, mode: snapshot.mode, dateKey: pinnedDay, score: 0, stageId: stage?.id, completed: false, countedDailyRun: false, mistakes: 0 };
    progress.receipts.push(receipt);
  }
  result.accepted = true;
  const previousScore = receipt.score;
  const delta = snapshot.score - previousScore;
  const previousStairs = progress.totalStairs;
  progress.totalStairs = Math.min(MAX_COUNT, progress.totalStairs + delta);
  progress.bestRun = Math.max(progress.bestRun, snapshot.score);
  progress.bestCombo = Math.max(progress.bestCombo, count(snapshot.maxCombo, 0, snapshot.score));
  if (previousScore === 0 && snapshot.score > 0) progress.runCount = Math.min(MAX_COUNT, progress.runCount + 1);
  const stairStars = Math.floor(progress.totalStairs / 10) - Math.floor(previousStairs / 10);
  progress.stars += stairStars;
  result.earnedStars += stairStars;
  receipt.score = snapshot.score;
  receipt.mistakes = Math.max(receipt.mistakes, count(snapshot.mistakes, 0, 5000));
  receipt.completed ||= snapshot.completed === true;
  const isToday = receipt.dateKey === dateKey;
  if (snapshot.mode === 'daily') progress.dailyBestEver = Math.max(progress.dailyBestEver, snapshot.score);
  if (isToday) {
    progress.daily.stairs = Math.min(MAX_COUNT, progress.daily.stairs + delta);
    if (snapshot.score >= 10 && !receipt.countedDailyRun) {
      progress.daily.runs = Math.min(MAX_COUNT, progress.daily.runs + 1);
      receipt.countedDailyRun = true;
    }
    if (snapshot.mode === 'daily') {
      progress.daily.best = Math.max(progress.daily.best, snapshot.score);
    }
  }
  if (stage && receipt.completed && receipt.score >= stage.goal && receipt.mistakes < 3 && !progress.completedStages.includes(stage.id)) {
    progress.completedStages.push(stage.id);
    progress.stars += stage.reward;
    result.earnedStars += stage.reward;
    result.stageUnlocked = ADVENTURE_STAGES[ADVENTURE_STAGES.indexOf(stage) + 1]?.id;
  }
  rewardGoals(progress, result, isToday);
  progress.stars = Math.min(MAX_COUNT, progress.stars);
  pruneReceipts(progress);
  return result;
}

function browserStorage(): StorageLike | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** Each local character owns its own independent progress record; no server storage. */
export class ProgressStore {
  private readonly profiles = new Map<string, ProfileProgress>();
  constructor(private readonly storage: StorageLike | undefined = browserStorage(), private readonly now: () => Date = () => new Date()) {}
  private key(profileId: string): string { return `${PROGRESS_KEY_PREFIX}${encodeURIComponent(profileId)}`; }
  private current(profileId: string): ProfileProgress {
    let progress = this.profiles.get(profileId);
    const dateKey = seoulDateKey(this.now());
    if (!progress) {
      let saved: unknown;
      try { saved = JSON.parse(this.storage?.getItem(this.key(profileId)) ?? '{}'); } catch { saved = {}; }
      progress = normalizeProgress(saved, dateKey);
      this.profiles.set(profileId, progress);
    }
    if (progress.daily.dateKey !== dateKey) progress.daily = newDaily(dateKey);
    return progress;
  }
  private save(profileId: string, progress: ProfileProgress): boolean {
    this.profiles.set(profileId, progress);
    try {
      if (!this.storage) return false;
      this.storage.setItem(this.key(profileId), JSON.stringify(progress));
      return true;
    } catch { return false; }
  }
  get(profileId: string): ProfileProgress { return clone(this.current(profileId)); }
  isStageUnlocked(profileId: string, stageId: string): boolean { return stageIsUnlocked(this.current(profileId), stageId); }
  record(profileId: string, snapshot: RunSnapshot): ProgressUpdate {
    const update = recordProgress(this.current(profileId), snapshot, seoulDateKey(this.now()));
    if (update.accepted) update.stored = this.save(profileId, update.progress);
    return { ...update, progress: clone(update.progress) };
  }
  purchase(profileId: string, companionId: string): CompanionUpdate {
    const progress = clone(this.current(profileId));
    const companion = COMPANIONS.find(companion => companion.id === companionId);
    if (!companion || (!progress.ownedCompanions.includes(companion.id) && progress.stars < companion.cost)) return { progress, stored: false, ok: false };
    if (!progress.ownedCompanions.includes(companion.id)) {
      progress.stars -= companion.cost;
      progress.ownedCompanions.push(companion.id);
    }
    progress.equippedCompanion = companion.id;
    const stored = this.save(profileId, progress);
    return { progress: clone(progress), stored, ok: true };
  }
  equip(profileId: string, companionId: string): CompanionUpdate {
    const progress = clone(this.current(profileId));
    if (!progress.ownedCompanions.includes(companionId as CompanionId)) return { progress, stored: false, ok: false };
    progress.equippedCompanion = companionId as CompanionId;
    const stored = this.save(profileId, progress);
    return { progress: clone(progress), stored, ok: true };
  }
  deleteProfileProgress(profileId: string): boolean {
    try {
      if (!this.storage) { this.profiles.delete(profileId); return false; }
      this.storage.removeItem(this.key(profileId));
      this.profiles.delete(profileId);
      return true;
    } catch { return false; }
  }
}
