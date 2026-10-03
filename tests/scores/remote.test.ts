import { describe, expect, it, vi } from 'vitest';
import { createSupabaseRemote, toRow, type FetchFn } from '../../src/scores/remote';
import type { ScoreEntry } from '../../src/scores/types';

const cfg = { url: 'https://abc.supabase.co', key: 'pub-key' };
const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({
  id: '00000000-0000-4000-8000-000000000001', at: '2026-10-03T03:00:00.000Z', board: 'booth', score: 120, name: 'Anna',
  preset: 'normal', lang: 'vi', questionsOn: true, device: 'dev-1', final: true, uploaded: false, ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Supabase remote', () => {
  it('uploads rounds so that repeats of earlier uploads are ignored', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json([{ id: entry().id }], 201));
    await createSupabaseRemote(cfg, fetchFn).insert([entry()]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/rest/v1/vienna_run_scores?on_conflict=id&select=id');
    expect(init.method).toBe('POST');
    const h = init.headers as Record<string, string>;
    expect(h.apikey).toBe('pub-key');
    expect(h.Authorization).toBe('Bearer pub-key');
    expect(h.Prefer).toContain('resolution=ignore-duplicates');
    expect(JSON.parse(init.body as string)).toEqual([
      { id: entry().id, created_at: '2026-10-03T03:00:00.000Z', board: 'booth', score: 120, name: 'Anna', preset: 'normal', lang: 'vi', questions_on: true, device: 'dev-1' },
    ]);
  });

  it.each<[string, FetchFn]>([
    ['a server error', async () => json({ message: 'boom' }, 500)],
    ['a missing table', async () => json({ message: 'relation does not exist' }, 404)],
    ['a wrong key', async () => json({ message: 'Invalid API key' }, 401)],
    ['a captive portal page', async () => new Response('<html>Log in to the Wi-Fi</html>', { status: 200 })],
    ['an unexpected answer', async () => json({ ok: true }, 201)],
    ['no network', async () => { throw new TypeError('Failed to fetch'); }],
  ])('treats %s as a failed upload', async (_name, fetchFn) => {
    await expect(createSupabaseRemote(cfg, fetchFn).insert([entry()])).rejects.toThrow();
  });

  it('gives up on a request that hangs', async () => {
    const hang: FetchFn = (_url, init) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    await expect(createSupabaseRemote(cfg, hang, 30).insert([entry()])).rejects.toThrow();
    await expect(createSupabaseRemote(cfg, hang, 30).top('booth', null, 10)).rejects.toThrow();
  });

  it('asks for the best named rounds of one board', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json([{ id: 'a', created_at: '2026-10-03T03:00:00+00:00', name: 'Anna', score: 120 }]));
    const rows = await createSupabaseRemote(cfg, fetchFn).top('booth', '2026-10-02T17:00:00.000Z', 10);
    expect(rows).toEqual([{ id: 'a', at: '2026-10-03T03:00:00+00:00', name: 'Anna', score: 120 }]);
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.pathname).toBe('/rest/v1/vienna_run_scores');
    expect(url.searchParams.get('board')).toBe('eq.booth');
    expect(url.searchParams.get('name')).toBe('not.is.null');
    expect(url.searchParams.get('order')).toBe('score.desc,created_at.asc');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('created_at')).toBe('gte.2026-10-02T17:00:00.000Z');
    await createSupabaseRemote(cfg, fetchFn).top('booth', null, 10);
    expect(new URL(fetchFn.mock.calls[1][0]).searchParams.has('created_at')).toBe(false);
  });

  it('rejects a board answer with broken rows', async () => {
    await expect(createSupabaseRemote(cfg, async () => json([{ id: 'a' }])).top('booth', null, 10)).rejects.toThrow();
  });

  it('only sends values the database accepts', () => {
    expect(toRow(entry({ score: 99999, name: 'bad<name>', board: 'Bad Board', device: 'd'.repeat(80) }))).toMatchObject({ score: 5000, name: null, board: 'booth', device: 'd'.repeat(40) });
    expect(toRow(entry({ score: -5 })).score).toBe(0);
  });
});
