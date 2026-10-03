export interface RemoteConfig {
  url: string;
  key: string;
}

/**
 * Supabase address and public key from the build environment (the Vercel integration's NEXT_PUBLIC_* values),
 * or null: the USB copy, local builds, or values that look wrong. Null means a local-only leaderboard.
 */
export function remoteConfigFrom(env: Record<string, unknown>): RemoteConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || !key.trim()) return null;
  const clean = url.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+$/.test(clean)) return null;
  return { url: clean, key: key.trim() };
}
