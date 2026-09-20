CREATE TABLE IF NOT EXISTS leaderboards (
  board_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  entries TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(entries) AND json_type(entries) = 'array' AND json_array_length(entries) <= 100)
);
INSERT OR IGNORE INTO leaderboards (board_id) VALUES ('stairs-challenge-v1');
