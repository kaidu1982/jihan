import { normalizeName } from '../functions/src/shared/rules';

export const KART_STORAGE_KEY = 'jihan-mini-kart-v1';
type LocalStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Delete both current name-based and older profile-based records, preserving other drivers. */
export function deleteKartProgress(profileId: string, name: string, storage?: LocalStore): boolean {
  try {
    const target = storage ?? localStorage;
    const raw = target.getItem(KART_STORAGE_KEY);
    if (!raw) return true;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('records' in data) || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) return false;
    const records = data.records as Record<string, unknown>;
    const keys = [profileId, `name:${normalizeName(name)}`];
    const present = keys.filter(key => Object.hasOwn(records, key));
    if (!present.length) return true;
    for (const key of present) delete records[key];
    target.setItem(KART_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
