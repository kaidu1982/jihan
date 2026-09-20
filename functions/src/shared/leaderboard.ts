export type ScoreEntry = { playerKey: string; name: string; score: number; achievedAt: number; runId: string };
export function insertScore(entries: ScoreEntry[], next: ScoreEntry): ScoreEntry[] {
  const previous = entries.find(entry => entry.playerKey === next.playerKey);
  if (previous && previous.score >= next.score) return entries;
  return [...entries.filter(entry => entry.playerKey !== next.playerKey), next]
    .sort((a, b) => b.score - a.score || a.achievedAt - b.achievedAt || a.playerKey.localeCompare(b.playerKey))
    .slice(0, 100);
}
