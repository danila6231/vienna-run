// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Remote } from '../../src/scores/remote';
import { toRow } from '../../src/scores/remote';
import { BOARD_CACHE_KEY, MAX_ENTRIES, SCORES_KEY, ScoreStore, type NewRound } from '../../src/scores/store';
import type { BoardRow, ScoreEntry } from '../../src/scores/types';

function memoryStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, data };
}
const brokenStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };

/** A pretend Supabase: ignores repeated ids like the real upsert, and can go offline or lose answers. */
function fakeSupabase() {
  const rows: ReturnType<typeof toRow>[] = [];
  const posts: string[][] = [];
  const state = { online: true, loseAnswer: false };
  const remote: Remote = {
    async insert(entries) {
      if (!state.online) throw new Error('offline');
      posts.push(entries.map((e) => e.id));
      for (const e of entries) if (!rows.some((r) => r.id === e.id)) rows.push(toRow(e));
      if (state.loseAnswer) throw new Error('answer lost');
    },
    async top(board, since, n) {
      if (!state.online) throw new Error('offline');
      return rows
        .filter((r) => r.board === board && r.name !== null && (!since || Date.parse(r.created_at) >= Date.parse(since)))
        .map((r): BoardRow => ({ id: r.id, at: r.created_at, name: r.name as string, score: r.score }))
        .sort((a, b) => b.score - a.score || Date.parse(a.at) - Date.parse(b.at))
        .slice(0, n);
    },
  };
  return { rows, posts, state, remote };
}

const round = (score = 50): NewRound => ({ score, preset: 'normal', lang: 'vi', questionsOn: true });
let now = new Date(2026, 9, 3, 15, 0, 0);
let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const make = (deps: Partial<ConstructorParameters<typeof ScoreStore>[0]> = {}) =>
  new ScoreStore({ storage: memoryStorage(), remote: null, board: 'booth', device: 'dev-1', now: () => now, newId: nextId, ...deps });
const entry = (over: Partial<ScoreEntry>): ScoreEntry => ({
  id: nextId(), at: now.toISOString(), board: 'booth', score: 10, name: null, preset: 'normal', lang: 'vi', questionsOn: true,
  device: 'dev-1', final: true, uploaded: true, ...over,
});

describe('ScoreStore', () => {
  beforeEach(() => {
    now = new Date(2026, 9, 3, 15, 0, 0);
    counter = 0;
  });

  it('keeps a round on the device and queues it only when the results screen closes', async () => {
    const sb = fakeSupabase();
    sb.state.online = false;
    const store = make({ remote: sb.remote });
    const id = store.addRound(round(80));
    expect(store.status().pending).toBe(0);
    expect(store.saveName(id, 'Anna')).toBe(true);
    store.finalize(id);
    await store.syncNow();
    expect(store.status()).toMatchObject({ mode: 'offline', pending: 1 });
    expect(store.log()[0]).toMatchObject({ id, score: 80, name: 'Anna', final: true, uploaded: false });
  });

  it('survives a reload and uploads once the connection returns', async () => {
    const sb = fakeSupabase();
    const storage = memoryStorage();
    sb.state.online = false;
    const first = make({ storage, remote: sb.remote });
    first.finalize(first.addRound(round()));
    await first.syncNow();
    const second = make({ storage, remote: sb.remote });
    expect(second.status().pending).toBe(1);
    sb.state.online = true;
    await second.syncNow();
    expect(second.status()).toMatchObject({ mode: 'online', pending: 0 });
    expect(sb.rows).toHaveLength(1);
    expect(second.status().lastSyncAt).not.toBeNull();
  });

  it('re-sends the same round after a lost answer, and the database keeps one copy', async () => {
    const sb = fakeSupabase();
    const store = make({ remote: sb.remote });
    sb.state.loseAnswer = true;
    const id = store.addRound(round());
    store.finalize(id);
    await store.syncNow();
    expect(store.status().pending).toBe(1);
    sb.state.loseAnswer = false;
    await store.syncNow();
    expect(sb.posts.flat()).toEqual([id, id]);
    expect(sb.rows).toHaveLength(1);
    expect(store.status().pending).toBe(0);
    await store.syncNow();
    expect(sb.posts.flat()).toEqual([id, id]);
  });

  it('shows unsent names at once, merged with the downloaded board, best first and earlier first on ties', async () => {
    const sb = fakeSupabase();
    const store = make({ remote: sb.remote });
    sb.rows.push(
      toRow(entry({ name: 'Early', score: 100, at: new Date(2026, 9, 3, 9).toISOString() })),
      toRow(entry({ name: 'Bea', score: 80 })),
    );
    await store.syncNow();
    sb.state.online = false;
    const mine = store.addRound(round(100));
    store.saveName(mine, 'Me');
    expect(store.top('today').map((r) => r.name)).toEqual(['Early', 'Me', 'Bea']);
    expect(store.rankOf(mine)).toBe(2);
  });

  it('keeps boards apart', () => {
    const store = make();
    store.saveName(store.addRound(round(60)), 'Booth');
    store.setBoard('test');
    store.saveName(store.addRound(round(40)), 'Laptop');
    expect(store.top('all').map((r) => r.name)).toEqual(['Laptop']);
    store.setBoard('booth');
    expect(store.top('all').map((r) => r.name)).toEqual(['Booth']);
  });

  it("counts only this device's calendar day as today", () => {
    const store = make();
    now = new Date(2026, 9, 2, 23, 50);
    store.saveName(store.addRound(round(90)), 'Late');
    now = new Date(2026, 9, 3, 0, 10);
    store.saveName(store.addRound(round(20)), 'Early');
    expect(store.top('today').map((r) => r.name)).toEqual(['Early']);
    expect(store.top('all').map((r) => r.name)).toEqual(['Late', 'Early']);
  });

  it('keeps the last downloaded board when the network fails, even after a reload', async () => {
    const sb = fakeSupabase();
    const storage = memoryStorage();
    sb.rows.push(toRow(entry({ name: 'Remote', score: 70 })));
    await make({ storage, remote: sb.remote }).syncNow();
    sb.state.online = false;
    const store = make({ storage, remote: sb.remote });
    await store.syncNow();
    expect(store.status().mode).toBe('offline');
    expect(store.top('today').map((r) => r.name)).toEqual(['Remote']);
    expect(storage.data.has(BOARD_CACHE_KEY)).toBe(true);
  });

  it("forgets yesterday's downloaded today-list", async () => {
    const sb = fakeSupabase();
    const store = make({ remote: sb.remote });
    sb.rows.push(toRow(entry({ name: 'Remote', score: 70 })));
    await store.syncNow();
    sb.state.online = false;
    now = new Date(2026, 9, 4, 9, 0);
    expect(store.top('today')).toEqual([]);
    expect(store.top('all').map((r) => r.name)).toEqual(['Remote']);
  });

  it('works without Supabase details, like the USB copy', async () => {
    const store = make({ remote: null });
    const id = store.addRound(round(30));
    store.saveName(id, 'Usb');
    store.finalize(id);
    await store.syncNow();
    expect(store.status()).toEqual({ mode: 'local-only', pending: 1, lastSyncAt: null });
    expect(store.top('today').map((r) => r.name)).toEqual(['Usb']);
  });

  it('refuses unusable names and names for closed rounds', () => {
    const store = make();
    const id = store.addRound(round());
    expect(store.saveName(id, '!!!')).toBe(false);
    expect(store.saveName('nope', 'Anna')).toBe(false);
    store.finalize(id);
    expect(store.saveName(id, 'Anna')).toBe(false);
    expect(store.log()[0].name).toBeNull();
  });

  it('drops a deleted round from the upload queue', async () => {
    const sb = fakeSupabase();
    sb.state.online = false;
    const store = make({ remote: sb.remote });
    const id = store.addRound(round());
    store.finalize(id);
    store.remove(id);
    sb.state.online = true;
    await store.syncNow();
    expect(sb.rows).toHaveLength(0);
    expect(store.log()).toHaveLength(0);
  });

  it('queues rounds a crash left on the results screen', () => {
    const storage = memoryStorage({
      [SCORES_KEY]: JSON.stringify([
        entry({ at: new Date(2026, 9, 3, 14, 50).toISOString(), final: false, uploaded: false }),
        entry({ at: new Date(2026, 9, 3, 14, 59).toISOString(), final: false, uploaded: false }),
      ]),
    });
    const store = make({ storage });
    store.finalizeStale(120_000);
    expect(store.log().map((e) => e.final)).toEqual([false, true]);
  });

  it('keeps at most 5,000 rounds, dropping the oldest uploaded ones first', () => {
    const old = Array.from({ length: MAX_ENTRIES }, (_, i) => entry({ uploaded: i !== 0, final: true }));
    const storage = memoryStorage({ [SCORES_KEY]: JSON.stringify(old) });
    const store = make({ storage });
    store.addRound(round());
    const kept = JSON.parse(storage.data.get(SCORES_KEY)!) as ScoreEntry[];
    expect(kept).toHaveLength(MAX_ENTRIES);
    expect(kept[0].id).toBe(old[0].id);
    expect(kept.some((e) => e.id === old[1].id)).toBe(false);
  });

  it('ignores damaged saved data and keeps working on a broken storage', () => {
    const good = entry({ name: 'Ok' });
    const storage = memoryStorage({ [SCORES_KEY]: JSON.stringify([{ id: 1 }, 'x', good]), [BOARD_CACHE_KEY]: '{bad' });
    expect(make({ storage }).log().map((e) => e.id)).toEqual([good.id]);
    expect(make({ storage: memoryStorage({ [SCORES_KEY]: '{bad' }) }).log()).toEqual([]);
    const broken = make({ storage: brokenStorage });
    expect(broken.available).toBe(false);
    const id = broken.addRound(round());
    expect(broken.saveName(id, 'Anna')).toBe(true);
    expect(make({ storage: null }).available).toBe(false);
  });

  it('exports the log as CSV, newest first, safe for spreadsheets', () => {
    const store = make({ device: 'pc,1' });
    store.saveName(store.addRound(round(5)), '-Bo');
    now = new Date(2026, 9, 3, 15, 5);
    store.addRound(round(7));
    const lines = store.exportCsv().trim().split('\r\n');
    expect(lines[0]).toBe('time,board,score,name,difficulty,language,questions,device,uploaded');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',7,');
    expect(lines[2]).toContain(",'-Bo,");
    expect(lines[2]).toContain('"pc,1"');
  });

  it('tells listeners about changes and survives a listener that throws', () => {
    const store = make();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.onChange(() => { throw new Error('ui bug'); });
    const cb = vi.fn();
    store.onChange(cb);
    expect(() => store.addRound(round())).not.toThrow();
    expect(cb).toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('background sync', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
    afterEach(() => vi.useRealTimers());

    it('retries in the background and right when the connection comes back', async () => {
      const sb = fakeSupabase();
      sb.state.online = false;
      const store = make({ remote: sb.remote });
      store.finalize(store.addRound(round()));
      const stop = store.start(window);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(store.status().pending).toBe(1);
      sb.state.online = true;
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(10);
      expect(store.status()).toMatchObject({ mode: 'online', pending: 0 });
      stop();
    });

    it('backs off while offline instead of hammering the network', async () => {
      const sb = fakeSupabase();
      sb.state.online = false;
      let attempts = 0;
      const counting: Remote = { insert: async (e) => { attempts++; return sb.remote.insert(e); }, top: sb.remote.top };
      const store = make({ remote: counting });
      store.finalize(store.addRound(round()));
      const stop = store.start(window);
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(attempts).toBeGreaterThanOrEqual(3);
      expect(attempts).toBeLessThanOrEqual(7);
      stop();
    });
  });
});
