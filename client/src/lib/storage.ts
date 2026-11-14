/**
 * localStorage that never throws. Private browsing, blocked storage or a full quota
 * must not break sorting, so every read and write is wrapped and falls back quietly.
 */
export function load<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

/**
 * The app was called BinSight, then Trashify, before it became TossGuide. Move anything
 * saved under the old "binsight.*" / "trashify.*" keys (tally, faculty, context, sound,
 * outbox) to "tossguide.*" once, so nobody's tally resets because of a rename.
 * The newest name wins if a key exists under more than one name.
 */
const LEGACY_PREFIXES = ['trashify.', 'binsight.']; // newest first

export function migrateLegacyKeys(): void {
  try {
    for (const old of LEGACY_PREFIXES) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k?.startsWith(old)) continue;
        const next = `tossguide.${k.slice(old.length)}`;
        if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(k) ?? '');
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* storage unavailable: nothing to migrate */
  }
}
