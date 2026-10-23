export const RSVP_WPM_STORAGE_KEY = 'reading-shelf-rsvp-wpm';
export const RSVP_DEFAULT_WPM = 300;
export const RSVP_MIN_WPM = 100;
export const RSVP_MAX_WPM = 1000;

export function clampWpm(value: number): number {
  if (!Number.isFinite(value)) return RSVP_DEFAULT_WPM;
  return Math.min(RSVP_MAX_WPM, Math.max(RSVP_MIN_WPM, Math.round(value)));
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readStoredWpm(storage: Storage | null = safeStorage()): number {
  if (!storage) return RSVP_DEFAULT_WPM;
  const raw = storage.getItem(RSVP_WPM_STORAGE_KEY);
  if (raw == null || raw.trim() === '') return RSVP_DEFAULT_WPM;
  return clampWpm(Number(raw));
}

export function storeWpm(wpm: number, storage: Storage | null = safeStorage()): number {
  const next = clampWpm(wpm);
  storage?.setItem(RSVP_WPM_STORAGE_KEY, String(next));
  return next;
}
