import type { ScoreStore } from '../functions/src/store.js';
import type { ScoreEntry } from '../functions/src/shared/leaderboard.js';
import { BOARD_ID } from '../functions/src/shared/rules.js';

/** A bounded snapshot. Conditional revision updates prevent lost concurrent scores. */
export class D1ScoreStore implements ScoreStore {
  constructor(private db: D1Database) {}
  async read(): Promise<ScoreEntry[]> {
    const row = await this.db.prepare('SELECT entries FROM leaderboards WHERE board_id = ?').bind(BOARD_ID).first<{ entries: string }>();
    if (!row) throw new Error('Leaderboard migration missing');
    return JSON.parse(row.entries);
  }
  async update(transform: (entries: ScoreEntry[]) => ScoreEntry[]): Promise<ScoreEntry[]> {
    // At most 32 SQL statements, below the free plan's 50-query limit per request.
    for (let attempt = 0; attempt < 16; attempt++) {
      const row = await this.db.prepare('SELECT entries, revision FROM leaderboards WHERE board_id = ?')
        .bind(BOARD_ID).first<{ entries: string; revision: number }>();
      if (!row) throw new Error('Leaderboard migration missing');
      const after = transform(JSON.parse(row.entries)).slice(0, 100);
      const encoded = JSON.stringify(after);
      if (encoded === row.entries) return after;
      const result = await this.db.prepare('UPDATE leaderboards SET entries = ?, revision = revision + 1 WHERE board_id = ? AND revision = ?')
        .bind(encoded, BOARD_ID, row.revision).run();
      if (result.meta.changes === 1) return after;
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * (attempt + 1) * 15));
    }
    throw Object.assign(new Error('순위표가 바빠요. 잠시 후 다시 시도해 주세요.'), { status: 503 });
  }
}
