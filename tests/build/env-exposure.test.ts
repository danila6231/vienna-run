import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

type Resolved = { envPrefix?: string | string[] };
const resolve = (mode: string) =>
  (config as unknown as (env: { mode: string; command: 'build'; isSsrBuild: boolean; isPreview: boolean }) => Resolved)({ mode, command: 'build', isSsrBuild: false, isPreview: false });

describe('environment exposure', () => {
  it('gives only the hosted build the public Supabase settings', () => {
    expect(resolve('production').envPrefix).toEqual(['VITE_', 'NEXT_PUBLIC_']);
    expect(resolve('offline').envPrefix).toBe('VITE_');
  });
  it('never exposes server-only secrets to the browser', () => {
    for (const mode of ['production', 'offline']) {
      for (const prefix of [resolve(mode).envPrefix ?? []].flat()) expect(['', 'SUPABASE_', 'POSTGRES_']).not.toContain(prefix);
    }
  });
  it('keeps pulled environment files (which hold the service-role key) out of git', () => {
    for (const file of ['.env', '.env.local', '.env.production.local']) {
      expect(() => execFileSync('git', ['check-ignore', '-q', file]), file).not.toThrow();
    }
  });
});
