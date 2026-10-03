import { sanitize, type Settings } from '../core/settings';
import { readJson, safeLocalStorage, writeJson } from './storage';

export const SETTINGS_KEY = 'vienna-run:settings';

/** This device's saved settings, repaired if needed; defaults when nothing usable is stored. */
export function loadSettings(storage: Pick<Storage, 'getItem'> | null = safeLocalStorage()): Settings {
  return sanitize(readJson<unknown>(SETTINGS_KEY, null, undefined, storage));
}

export function saveSettings(s: Settings, storage: Pick<Storage, 'setItem'> | null = safeLocalStorage()): void {
  writeJson(SETTINGS_KEY, s, storage);
}
