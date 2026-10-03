import { describe, expect, it } from 'vitest';
import { deviceId, uuid } from '../../src/scores/ids';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};

describe('ids', () => {
  it('makes version-4 UUIDs the database accepts', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uuid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('keeps one device id per device', () => {
    const s = memory();
    const first = deviceId(s);
    expect(deviceId(s)).toBe(first);
    expect(first.length).toBeLessThanOrEqual(40);
    expect(deviceId(null)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
