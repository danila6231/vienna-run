import { BOARD_RE } from '../core/settings';
import type { RemoteConfig } from './env';
import { NAME_RE } from './names';
import type { BoardRow, ScoreEntry } from './types';

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface Remote {
  /** Uploads rounds. Rounds uploaded before are ignored, so a retry never duplicates. Rejects on any failure. */
  insert(entries: readonly ScoreEntry[]): Promise<void>;
  /** A board's best named rounds, best first; `since` keeps only rounds from that time on. Rejects on any failure. */
  top(board: string, since: string | null, n: number): Promise<BoardRow[]>;
}

/** The table row for a round, with every value forced into what the database accepts. */
export function toRow(e: ScoreEntry) {
  return {
    id: e.id,
    created_at: e.at,
    board: BOARD_RE.test(e.board) ? e.board : 'booth',
    score: Math.max(0, Math.min(5000, Math.round(e.score))),
    name: e.name !== null && NAME_RE.test(e.name) ? e.name : null,
    preset: e.preset,
    lang: e.lang,
    questions_on: e.questionsOn,
    device: e.device.slice(0, 40),
  };
}

function toBoardRow(raw: unknown): BoardRow {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.created_at !== 'string' || typeof r.name !== 'string' || typeof r.score !== 'number') {
    throw new Error('Supabase: unexpected row');
  }
  return { id: r.id, at: r.created_at, name: r.name, score: r.score };
}

/** Plain REST calls to Supabase (no SDK). Every request gives up after `timeoutMs`. */
export function createSupabaseRemote(cfg: RemoteConfig, fetchFn: FetchFn = (url, init) => fetch(url, init), timeoutMs = 5000): Remote {
  const endpoint = `${cfg.url}/rest/v1/vienna_run_scores`;
  const auth = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };

  async function call(url: string, init: RequestInit): Promise<unknown[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
      // A Wi-Fi login page answers 200 with HTML; only a JSON list counts as success.
      const data: unknown = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Supabase: unexpected answer');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async insert(entries) {
      if (entries.length === 0) return;
      await call(`${endpoint}?on_conflict=id&select=id`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(entries.map(toRow)),
      });
    },
    async top(board, since, n) {
      const q = new URLSearchParams({ select: 'id,created_at,name,score', board: `eq.${board}`, name: 'not.is.null', order: 'score.desc,created_at.asc', limit: String(n) });
      if (since) q.append('created_at', `gte.${since}`);
      const data = await call(`${endpoint}?${q.toString()}`, { method: 'GET', headers: auth });
      return data.map(toBoardRow);
    },
  };
}
