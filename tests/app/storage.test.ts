import { describe, expect, it } from 'vitest';
import { readJson, writeJson } from '../../src/app/storage';

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, data };
};
const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

describe('safe storage', () => {
  it('round-trips JSON', () => {
    const s = memory();
    writeJson('k', ['a'], s);
    expect(readJson('k', [] as string[], isList, s)).toEqual(['a']);
  });
  it('falls back when storage is blocked or full', () => {
    expect(readJson('k', ['x'], isList, broken)).toEqual(['x']);
    expect(() => writeJson('k', ['a'], broken)).not.toThrow();
    expect(readJson('k', ['x'], isList, null)).toEqual(['x']);
  });
  it('falls back on garbage or a wrong shape', () => {
    expect(readJson('k', ['x'], isList, memory({ k: '{not json' }))).toEqual(['x']);
    expect(readJson('k', ['x'], isList, memory({ k: '42' }))).toEqual(['x']);
  });
});
