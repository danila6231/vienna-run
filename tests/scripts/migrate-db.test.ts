import { describe, expect, it, vi } from 'vitest';
import { databaseUrls, migrate, SQL } from '../../scripts/migrate-db';

const client = (over: Partial<{ connect(): Promise<unknown>; query(sql: string): Promise<unknown>; end(): Promise<void> }> = {}) => ({
  connect: async () => undefined,
  query: async () => undefined,
  end: async () => undefined,
  ...over,
});

describe('migrate-db', () => {
  it('skips cleanly without a database address', async () => {
    const log = vi.fn();
    expect(await migrate([], log)).toBe('skipped');
    expect(log.mock.calls[0][0]).toMatch(/skipping/);
  });
  it('prefers the direct connection and falls back to the pooled one', () => {
    expect(databaseUrls({ POSTGRES_URL: 'b', POSTGRES_URL_NON_POOLING: 'a' })).toEqual(['a', 'b']);
    expect(databaseUrls({ POSTGRES_URL: 'b', POSTGRES_URL_NON_POOLING: ' ' })).toEqual(['b']);
    expect(databaseUrls({})).toEqual([]);
  });
  it('runs the SQL once and closes the connection', async () => {
    const queries: string[] = [];
    const end = vi.fn(async () => undefined);
    const factory = () => client({ query: async (sql: string) => queries.push(sql), end });
    expect(await migrate(['postgres://u:secret@db.example.com:5432/postgres'], vi.fn(), factory)).toBe('migrated');
    expect(queries).toEqual([SQL]);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('tries the next address after a failure, never throws, and never logs the password', async () => {
    const log = vi.fn();
    const factory = (url: string) => client({ connect: async () => { if (url.includes('direct')) throw new Error('ENETUNREACH'); } });
    expect(await migrate(['postgres://u:secret@direct.example.com/db', 'postgres://u:secret@pool.example.com/db'], log, factory)).toBe('migrated');
    const failing = () => client({ connect: async () => { throw new Error('down'); } });
    expect(await migrate(['postgres://u:secret@x.example.com/db'], log, failing)).toBe('failed');
    const all = log.mock.calls.flat().join('\n');
    expect(all).toContain('direct.example.com');
    expect(all).not.toContain('secret');
  });
  it('creates the table with every rule, and lets the public key only add and read scores', () => {
    for (const part of [
      'create table if not exists public.vienna_run_scores',
      'id uuid primary key',
      "board ~ '^[a-z0-9-]{1,24}$'",
      'score between 0 and 5000',
      "name ~ '^[A-Za-z0-9 _-]{1,12}$'",
      "preset in ('easy', 'normal', 'hard', 'custom')",
      "lang in ('vi', 'en')",
      'char_length(device) <= 40',
      'inserted_at timestamptz not null default now()',
      '(board, score desc, created_at)',
      'enable row level security',
      'grant select, insert on table public.vienna_run_scores to anon',
      'for insert to anon with check (true)',
      'for select to anon using (true)',
      "notify pgrst, 'reload schema'",
    ]) expect(SQL).toContain(part);
    expect(SQL).not.toMatch(/grant[^;]*(update|delete)/i);
  });
});
