import { readJson, safeLocalStorage, writeJson } from '../app/storage';

const DEVICE_KEY = 'vienna-run:device';

/** A random version-4 UUID, also where `crypto.randomUUID` is missing (older browsers, file:// pages). */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      // fall through
    }
  }
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** This device's id, stored on first use, so the score log shows which PC a round came from. */
export function deviceId(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()): string {
  const saved = readJson<string>(DEVICE_KEY, '', (v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40, storage);
  if (saved) return saved;
  const fresh = uuid();
  writeJson(DEVICE_KEY, fresh, storage);
  return fresh;
}
