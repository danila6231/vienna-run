import { describe, expect, it } from 'vitest';
import { loadSettings, saveSettings, SETTINGS_KEY } from '../../src/app/settingsStore';
import { applyPreset, defaultSettings } from '../../src/core/settings';

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};
const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };

describe('settings store', () => {
  it('round-trips saved settings', () => {
    const s = memory();
    const hard = applyPreset(defaultSettings(), 'hard');
    saveSettings(hard, s);
    expect(loadSettings(s)).toEqual(hard);
  });
  it('falls back to defaults when nothing, garbage or a broken storage is found', () => {
    expect(loadSettings(memory())).toEqual(defaultSettings());
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{oops' }))).toEqual(defaultSettings());
    expect(loadSettings(broken)).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
    expect(() => saveSettings(defaultSettings(), broken)).not.toThrow();
  });
  it('repairs a stored file with bad values instead of rejecting it', () => {
    const s = memory({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), obstacles: 999, pin: 'abcd' }) });
    expect(loadSettings(s)).toMatchObject({ obstacles: 40, pin: '2468' });
  });
});
