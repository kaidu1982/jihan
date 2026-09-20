import type { InputEvent } from '../functions/src/shared/rules';
export type Ranking = { name: string; score: number; rank: number; mine: boolean };
export type Ticket = { seed: number; token: string };
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '연결이 잠시 쉬고 있어요.');
  }
  return response.json();
}
export const api = {
  leaderboard: (profileId = '') => request<{ entries: Ranking[]; local: boolean }>(`leaderboard?profileId=${encodeURIComponent(profileId)}`),
  start: (profileId: string, name: string) => request<Ticket>('start', { profileId, name }),
  submit: (token: string, inputs: InputEvent[]) => request<{ rank: number | null; score: number }>('score', { token, inputs }),
  remove: (profileId: string) => request<{ ok: boolean }>('profile/delete', { profileId }),
};
