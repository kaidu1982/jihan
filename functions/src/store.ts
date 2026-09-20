import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ScoreEntry } from './shared/leaderboard.js';

export interface ScoreStore {
  read(): Promise<ScoreEntry[]>;
  update(transform: (entries: ScoreEntry[]) => ScoreEntry[]): Promise<ScoreEntry[]>;
}

/** Local preview storage. Only the current top 100 is persisted; no run history. */
export class FileScoreStore implements ScoreStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private path: string) {}
  async read(): Promise<ScoreEntry[]> {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  async update(transform: (entries: ScoreEntry[]) => ScoreEntry[]): Promise<ScoreEntry[]> {
    const task = this.pending.then(async () => {
      const before = await this.read();
      const after = transform(before).slice(0, 100);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await mkdir(dirname(this.path), { recursive: true });
        await writeFile(`${this.path}.tmp`, JSON.stringify(after), { mode: 0o600 });
        await rename(`${this.path}.tmp`, this.path);
      }
      return after;
    });
    this.pending = task.catch(() => undefined);
    return task;
  }
}
