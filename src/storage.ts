import type { Mode } from '../functions/src/shared/rules';
export type Profile = { id: string; name: string; best: number; practiceBest: number };
type Saved = { profiles: Profile[]; activeId: string; sound: boolean };
const KEY = 'jihan-stairs-v1';
export function loadSaved(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const profiles = Array.isArray(saved.profiles) ? saved.profiles.filter((p: Profile) =>
      typeof p.id === 'string' && typeof p.name === 'string' && Number.isFinite(p.best) && Number.isFinite(p.practiceBest)) : [];
    return { profiles, activeId: saved.activeId || '', sound: saved.sound !== false };
  } catch { return { profiles: [], activeId: '', sound: true }; }
}
export const saved = loadSaved();
export function persist(): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); return true; } catch { return false; }
}
export function activeProfile(): Profile | undefined { return saved.profiles.find(p => p.id === saved.activeId); }
function createProfileId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID requires HTTPS; this fallback also supports phone testing on a local Wi-Fi URL.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function selectProfile(name: string): Profile {
  let profile = saved.profiles.find(p => p.name === name);
  if (!profile) {
    profile = { id: createProfileId(), name, best: 0, practiceBest: 0 };
    saved.profiles.push(profile);
  }
  saved.activeId = profile.id;
  persist();
  return profile;
}
export function rememberScore(profile: Profile, mode: Mode, score: number): { newBest: boolean; stored: boolean } {
  const field = mode === 'challenge' ? 'best' : 'practiceBest';
  const newBest = score > profile[field];
  profile[field] = Math.max(profile[field], score);
  return { newBest, stored: persist() };
}
