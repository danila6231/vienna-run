import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const TABLE = 'vienna_run_scores';

/** Idempotent: safe to run on every deploy. The public (anon) key may only add and read rows. */
export const SQL = `
create table if not exists public.vienna_run_scores (
  id uuid primary key,
  created_at timestamptz not null,
  board text not null check (board ~ '^[a-z0-9-]{1,24}$'),
  score integer not null check (score between 0 and 5000),
  name text check (name is null or name ~ '^[A-Za-z0-9 _-]{1,12}$'),
  preset text not null check (preset in ('easy', 'normal', 'hard', 'custom')),
  lang text not null check (lang in ('vi', 'en')),
  questions_on boolean not null,
  device text not null check (char_length(device) <= 40),
  inserted_at timestamptz not null default now()
);
create index if not exists vienna_run_scores_board_score_idx on public.vienna_run_scores (board, score desc, created_at);
alter table public.vienna_run_scores enable row level security;
revoke all on table public.vienna_run_scores from anon, authenticated;
grant select, insert on table public.vienna_run_scores to anon;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vienna_run_scores' and policyname = 'vienna_run_scores_insert') then
    create policy vienna_run_scores_insert on public.vienna_run_scores for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vienna_run_scores' and policyname = 'vienna_run_scores_select') then
    create policy vienna_run_scores_select on public.vienna_run_scores for select to anon using (true);
  end if;
end
$$;
notify pgrst, 'reload schema';
`;

export interface DbClient {
  connect(): Promise<unknown>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}
export type ClientFactory = (connectionString: string) => DbClient;

// Supabase certificates are signed by Supabase's own authority: encrypt, but don't verify the chain.
const pgClient: ClientFactory = (url) => {
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  return new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
};

/** Database addresses from the Vercel Supabase integration, direct connection first. */
export function databaseUrls(env: Record<string, string | undefined>): string[] {
  return [env.POSTGRES_URL_NON_POOLING, env.POSTGRES_URL].filter((u): u is string => typeof u === 'string' && u.trim() !== '');
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return '(unreadable address)';
  }
};

/** Creates the scores table if needed. Never throws: a failed migration must not fail the deploy. */
export async function migrate(urls: readonly string[], log: (msg: string) => void = console.log, factory: ClientFactory = pgClient): Promise<'migrated' | 'skipped' | 'failed'> {
  if (urls.length === 0) {
    log('[migrate-db] No POSTGRES_URL set: skipping (the leaderboard stays on each device).');
    return 'skipped';
  }
  for (const url of urls) {
    let client: DbClient | null = null;
    try {
      client = factory(url);
      await client.connect();
      await client.query(SQL);
      log(`[migrate-db] Table ${TABLE} is ready (via ${hostOf(url)}).`);
      return 'migrated';
    } catch (e) {
      log(`[migrate-db] Could not migrate via ${hostOf(url)}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await client?.end().catch(() => undefined);
    }
  }
  log('[migrate-db] WARNING: migration failed. The build continues; scores stay on each device until a later deploy succeeds.');
  return 'failed';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void migrate(databaseUrls(process.env)).then(() => process.exit(0));
}
