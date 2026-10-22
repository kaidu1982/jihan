import { normalizeName } from '../functions/src/shared/rules';
import type { MiniGameId } from './mini-types';

export const MINI_STORAGE_KEY = 'jihan-mini-adventures-v1';
type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type MiniStageRecord = { runs: number; best: number; medals: number };
export type MiniRecord = { wallet: number; total: number; best: number; runs: number; stage: number; character: string; owned: string[]; receipts: string[]; stages: Record<string, MiniStageRecord> };
type DriverRecord = Partial<Record<MiniGameId, MiniRecord>>;
type Data = { version: 1; drivers: Record<string, DriverRecord> };
const IDS: MiniGameId[] = ['dino', 'space', 'maze', 'crossing'];
const fresh = (): MiniRecord => ({ wallet: 0, total: 0, best: 0, runs: 0, stage: 0, character: 'default', owned: [], receipts: [], stages: {} });
const integer = (value: unknown, maximum = 1_000_000_000): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, maximum) : 0;
const safeStrings = (value: unknown, maximum: number): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length < 100))].slice(-maximum) : [];
function stageRecords(value: unknown): Record<string, MiniStageRecord> {
  const stages: Record<string, MiniStageRecord> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return stages;
  for (const [key, raw] of Object.entries(value)) {
    if (!/^(0|[1-9]\d?)$/.test(key) || !raw || typeof raw !== 'object') continue;
    const record = raw as Partial<MiniStageRecord>;
    stages[key] = { runs: integer(record.runs), best: integer(record.best, 1_000_000), medals: integer(record.medals, 3) };
  }
  return stages;
}
function decode(raw: string | null): Data {
  const result: Data = { version: 1, drivers: Object.create(null) as Record<string, DriverRecord> };
  const data: unknown = JSON.parse(raw || 'null');
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('drivers' in data) || !data.drivers || typeof data.drivers !== 'object' || Array.isArray(data.drivers)) return result;
  for (const [name, games] of Object.entries(data.drivers).slice(-1000)) {
    if (!games || typeof games !== 'object' || Array.isArray(games)) continue;
    const driver: DriverRecord = {};
    for (const id of IDS) {
      const value = (games as Record<string, unknown>)[id];
      if (!value || typeof value !== 'object') continue;
      const record = value as Partial<MiniRecord>, owned = safeStrings(record.owned, 40);
      driver[id] = { wallet: integer(record.wallet), total: integer(record.total), best: integer(record.best), runs: integer(record.runs), stage: integer(record.stage, 99), character: typeof record.character === 'string' && owned.includes(record.character) ? record.character : 'default', owned, receipts: safeStrings(record.receipts, 64), stages: stageRecords(record.stages) };
    }
    result.drivers[name] = driver;
  }
  return result;
}

export class MiniProgressStore {
  private data: Data = { version: 1, drivers: Object.create(null) as Record<string, DriverRecord> };
  available = true;
  constructor(private storage?: LocalStorageLike) {
    try { this.data = decode(this.target().getItem(MINI_STORAGE_KEY)); } catch { this.available = false; }
  }
  private target(): LocalStorageLike { return this.storage ?? localStorage; }
  private mutable(name: string, id: MiniGameId): MiniRecord {
    const key = `name:${normalizeName(name)}`;
    return (this.data.drivers[key] ||= {})[id] ||= fresh();
  }
  private save(): boolean {
    try { this.target().setItem(MINI_STORAGE_KEY, JSON.stringify(this.data)); this.available = true; return true; }
    catch { this.available = false; return false; }
  }
  get(name: string, id: MiniGameId): MiniRecord {
    const data = this.mutable(name, id);
    return { ...data, owned: [...data.owned], receipts: [...data.receipts], stages: Object.fromEntries(Object.entries(data.stages).map(([key, value]) => [key, { ...value }])) };
  }
  selectStage(name: string, id: MiniGameId, stage: number): boolean {
    this.mutable(name, id).stage = integer(stage, 99);
    return this.save();
  }
  chooseCharacter(name: string, id: MiniGameId, character: string, cost: number): 'selected' | 'purchased' | 'insufficient' {
    const data = this.mutable(name, id);
    if (!data.owned.includes(character)) {
      if (!Number.isSafeInteger(cost) || cost < 0 || data.wallet < cost) return 'insufficient';
      data.wallet -= cost; data.owned.push(character); data.character = character; this.save();
      return cost ? 'purchased' : 'selected';
    }
    data.character = character; this.save(); return 'selected';
  }
  award(name: string, id: MiniGameId, runId: string, stars: number, score: number, course: { stage: number; medals: number } = { stage: 0, medals: 0 }): { duplicate: boolean; stored: boolean; record: MiniRecord } {
    const data = this.mutable(name, id);
    if (data.receipts.includes(runId)) return { duplicate: true, stored: this.available, record: this.get(name, id) };
    const reward = integer(stars, 10000), result = integer(score, 1_000_000);
    data.wallet += reward; data.total += reward;
    data.best = id === 'maze' ? data.runs ? Math.min(data.best, result) : result : Math.max(data.best, result);
    const key = String(integer(course.stage, 99)), previous = data.stages[key];
    data.stages[key] = { runs: (previous?.runs || 0) + 1, best: id === 'maze' && previous?.runs ? Math.min(previous.best, result) : Math.max(previous?.best || 0, result), medals: Math.max(previous?.medals || 0, integer(course.medals, 3)) };
    data.runs++; data.receipts = [...data.receipts, runId].slice(-64);
    return { duplicate: false, stored: this.save(), record: this.get(name, id) };
  }
}

export function deleteMiniProgress(name: string, storage?: LocalStorageLike): boolean {
  try {
    const target = storage ?? localStorage, raw = target.getItem(MINI_STORAGE_KEY);
    if (!raw) return true;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('drivers' in data) || !data.drivers || typeof data.drivers !== 'object' || Array.isArray(data.drivers)) return false;
    const drivers = data.drivers as Record<string, unknown>, key = `name:${normalizeName(name)}`;
    if (!Object.hasOwn(drivers, key)) return true;
    delete drivers[key]; target.setItem(MINI_STORAGE_KEY, JSON.stringify(data)); return true;
  } catch { return false; }
}
