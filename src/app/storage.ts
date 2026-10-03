type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reads JSON; any failure (blocked, missing, garbage, wrong shape) returns the fallback. */
export function readJson<T>(key: string, fallback: T, isValid?: (v: unknown) => v is T, storage: Reader | null = safeLocalStorage()): T {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (isValid && !isValid(value)) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

/** Writes JSON; storage that is full or blocked is ignored because the game works without it. */
export function writeJson(key: string, value: unknown, storage: Writer | null = safeLocalStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // ignored on purpose
  }
}
