import { describe, expect, it } from 'vitest';
import { remoteConfigFrom } from '../../src/scores/env';

describe('remoteConfigFrom', () => {
  it('reads the Supabase address and public key from the Vercel integration', () => {
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/', NEXT_PUBLIC_SUPABASE_ANON_KEY: ' k1 ' })).toEqual({ url: 'https://abc.supabase.co', key: 'k1' });
  });
  it('falls back to the publishable key', () => {
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })?.key).toBe('sb_publishable_x');
  });
  it('stays local-only without both values, or with an address that is not https', () => {
    expect(remoteConfigFrom({})).toBeNull();
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull();
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(remoteConfigFrom({ NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toBeNull();
  });
});
