import { readJson, writeJson } from '../app/storage';
import type { Preset } from '../core/settings';
import type { Lang } from '../core/types';
import { uuid } from './ids';
import { finalName } from './names';
import type { Remote } from './remote';
import type { BoardRow, Range, ScoreEntry, SyncStatus } from './types';

export const SCORES_KEY = 'vienna-run:scores';
export const BOARD_CACHE_KEY = 'vienna-run:board-cache';
export const MAX_ENTRIES = 5000;
const SYNC_MS = 15_000;
const MAX_BACKOFF_MS = 120_000;
const BATCH = 50;

export interface NewRound {
  score: number;
  preset: Preset;
  lang: Lang;
  questionsOn: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Timers = Pick<Window, 'setTimeout' | 'clearTimeout' | 'addEventListener' | 'removeEventListener'>;

export interface ScoreStoreDeps {
  storage: StorageLike | null;
  /** Null without Supabase details (the USB copy, local builds, autoplay test runs): a local-only leaderboard. */
  remote: Remote | null;
  board: string;
  device: string;
  now?: () => Date;
  newId?: () => string;
}

interface CachedList {
  /** The local day the list belongs to ('YYYY-MM-DD'), or 'all'. */
  key: string;
  at: string;
  rows: BoardRow[];
}

interface BoardCache {
  board: string;
  today: CachedList;
  all: CachedList;
}

const PRESET_NAMES: readonly string[] = ['easy', 'normal', 'hard', 'custom'];

function isEntry(v: unknown): v is ScoreEntry {
  const e = v as ScoreEntry;
  return (
    !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) &&
    typeof e.board === 'string' && typeof e.score === 'number' && Number.isFinite(e.score) &&
    (e.name === null || typeof e.name === 'string') && PRESET_NAMES.includes(e.preset) && (e.lang === 'vi' || e.lang === 'en') &&
    typeof e.questionsOn === 'boolean' && typeof e.device === 'string' && typeof e.final === 'boolean' && typeof e.uploaded === 'boolean'
  );
}

function isRow(v: unknown): v is BoardRow {
  const r = v as BoardRow;
  return !!r && typeof r.id === 'string' && typeof r.at === 'string' && typeof r.name === 'string' && typeof r.score === 'number';
}

function isList(v: unknown): v is CachedList {
  const l = v as CachedList;
  return !!l && typeof l.key === 'string' && typeof l.at === 'string' && Array.isArray(l.rows) && l.rows.every(isRow);
}

function isCache(v: unknown): v is BoardCache {
  const c = v as BoardCache;
  return !!c && typeof c === 'object' && typeof c.board === 'string' && isList(c.today) && isList(c.all);
}

function probe(s: StorageLike | null): boolean {
  if (!s) return false;
  try {
    s.setItem('vienna-run:probe', '1');
    s.removeItem('vienna-run:probe');
    return true;
  } catch {
    return false;
  }
}

/** The device's local calendar day, e.g. "2026-10-03". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Best score first; on a tie, whoever got there first. */
export function compareRows(a: BoardRow, b: BoardRow): number {
  return b.score - a.score || Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** One CSV cell; values that a spreadsheet would run as a formula get a leading apostrophe. */
function csvCell(v: string): string {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Every finished round is kept on this device first. Rounds whose results screen has closed are uploaded
 * to Supabase in the background; the board shows the last downloaded lists merged with this device's rounds.
 * Nothing here ever waits on the network for the game, and nothing here ever throws at the game.
 */
export class ScoreStore {
  /** False when the browser storage is blocked or broken: scores then only live until the page reloads. */
  readonly available: boolean;
  private entries: ScoreEntry[];
  private cache: BoardCache | null;
  private board: string;
  private lastResult: 'ok' | 'fail' | null = null;
  private lastSyncAt: string | null = null;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  private failures = 0;
  private syncing: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly d: ScoreStoreDeps) {
    this.board = d.board;
    this.available = probe(d.storage);
    const raw = readJson<unknown>(SCORES_KEY, null, undefined, d.storage);
    this.entries = Array.isArray(raw) ? raw.filter(isEntry) : [];
    const cache = readJson<unknown>(BOARD_CACHE_KEY, null, undefined, d.storage);
    this.cache = isCache(cache) ? cache : null;
  }

  get currentBoard(): string {
    return this.board;
  }

  setBoard(board: string): void {
    if (board === this.board) return;
    this.board = board;
    this.emit();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Logs a finished round on this device; returns its id. */
  addRound(r: NewRound): string {
    const id = (this.d.newId ?? uuid)();
    this.entries.push({
      id, at: this.now().toISOString(), board: this.board, score: r.score, name: null,
      preset: r.preset, lang: r.lang, questionsOn: r.questionsOn, device: this.d.device, final: false, uploaded: false,
    });
    this.persist();
    this.emit();
    return id;
  }

  /** Attaches a code name to a round still on its results screen. False if the name is unusable or the round has closed. */
  saveName(id: string, raw: string): boolean {
    const e = this.find(id);
    const name = finalName(raw);
    if (!e || e.final || !name) return false;
    e.name = name;
    this.persist();
    this.emit();
    return true;
  }

  /** The results screen closed: the round is queued for upload. */
  finalize(id: string): void {
    const e = this.find(id);
    if (!e || e.final) return;
    e.final = true;
    this.persist();
    this.emit();
    void this.syncNow();
  }

  /** Queues rounds left open longer than `maxAgeMs` (a crash or reload during the results screen). */
  finalizeStale(maxAgeMs: number): void {
    const cutoff = this.now().getTime() - maxAgeMs;
    let changed = false;
    for (const e of this.entries) {
      if (!e.final && Date.parse(e.at) < cutoff) {
        e.final = true;
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this.emit();
    }
  }

  /** The board for this device's board name: the last downloaded list merged with this device's named rounds. */
  top(range: Range, n = 10): BoardRow[] {
    const today = dayKey(this.now());
    const list = this.cache && this.cache.board === this.board ? this.cache[range] : null;
    const remote = list && (range === 'all' || list.key === today) ? list.rows : [];
    const local = this.entries
      .filter((e) => e.board === this.board && e.name !== null && (range === 'all' || dayKey(new Date(e.at)) === today))
      .map((e): BoardRow => ({ id: e.id, at: e.at, name: e.name as string, score: e.score }));
    const byId = new Map<string, BoardRow>();
    for (const r of [...remote, ...local]) byId.set(r.id, r);
    return [...byId.values()].sort(compareRows).slice(0, n);
  }

  /** A round's place on today's board (1-based), or null when it is not in the top `n`. */
  rankOf(id: string, n = 10): number | null {
    const i = this.top('today', n).findIndex((r) => r.id === id);
    return i < 0 ? null : i + 1;
  }

  /** Every round on this device, newest first. */
  log(): ScoreEntry[] {
    return [...this.entries].reverse();
  }

  /** Deletes a round on this device only (a waiting one is also dropped from the upload queue). */
  remove(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.persist();
    this.emit();
  }

  clearLog(): void {
    this.entries = [];
    this.persist();
    this.emit();
  }

  exportCsv(): string {
    const head = ['time', 'board', 'score', 'name', 'difficulty', 'language', 'questions', 'device', 'uploaded'];
    const rows = this.log().map((e) => [e.at, e.board, String(e.score), e.name ?? '', e.preset, e.lang, e.questionsOn ? 'on' : 'off', e.device, e.uploaded ? 'yes' : 'no']);
    return `${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
  }

  status(): SyncStatus {
    const mode = !this.d.remote ? 'local-only' : this.lastResult === null ? 'connecting' : this.lastResult === 'ok' ? 'online' : 'offline';
    return { mode, pending: this.pending().length, lastSyncAt: this.lastSyncAt };
  }

  /** Uploads waiting rounds in batches, then downloads the board lists. Never rejects. */
  syncNow(): Promise<void> {
    const remote = this.d.remote;
    if (!remote) return Promise.resolve();
    if (this.syncing) return this.syncing;
    this.lastAttemptAt = this.now().getTime();
    this.syncing = this.runSync(remote).finally(() => {
      this.syncing = null;
      this.emit();
    });
    return this.syncing;
  }

  /** Re-downloads the board unless that was tried in the last `maxAgeMs` (called from the start screen). */
  refresh(maxAgeMs: number): void {
    if (!this.d.remote || this.syncing) return;
    if (this.now().getTime() - this.lastAttemptAt < maxAgeMs) return;
    void this.syncNow();
  }

  /** Background sync: now, whenever the browser reports the connection back, and every 15 s while rounds wait (backing off to 2 min while failing). */
  start(win: Timers = window): () => void {
    if (!this.d.remote) return () => undefined;
    let stopped = false;
    let timer = 0;
    const schedule = () => {
      if (stopped) return;
      const delay = this.failures > 0 ? Math.min(MAX_BACKOFF_MS, SYNC_MS * 2 ** this.failures) : SYNC_MS;
      timer = win.setTimeout(tick, delay);
    };
    const tick = () => {
      if (stopped) return;
      this.finalizeStale(10 * 60_000);
      void (this.pending().length > 0 ? this.syncNow() : Promise.resolve()).then(schedule);
    };
    const onOnline = () => {
      void this.syncNow();
    };
    win.addEventListener('online', onOnline);
    void this.syncNow().then(schedule);
    return () => {
      stopped = true;
      win.clearTimeout(timer);
      win.removeEventListener('online', onOnline);
    };
  }

  private async runSync(remote: Remote): Promise<void> {
    try {
      for (let batch = this.pending().slice(0, BATCH); batch.length > 0; batch = this.pending().slice(0, BATCH)) {
        await remote.insert(batch);
        for (const sent of batch) {
          const e = this.find(sent.id);
          if (e) e.uploaded = true;
        }
        this.persist();
      }
      await this.fetchLists(remote);
      this.lastResult = 'ok';
      this.lastSyncAt = this.now().toISOString();
      this.failures = 0;
    } catch {
      this.lastResult = 'fail';
      this.failures++;
    }
  }

  private async fetchLists(remote: Remote): Promise<void> {
    const board = this.board;
    const now = this.now();
    const [today, all] = await Promise.all([remote.top(board, startOfDay(now).toISOString(), 10), remote.top(board, null, 10)]);
    if (board !== this.board) return; // the board changed meanwhile; the next sync fetches the new one
    const at = this.now().toISOString();
    this.cache = { board, today: { key: dayKey(now), at, rows: today }, all: { key: 'all', at, rows: all } };
    writeJson(BOARD_CACHE_KEY, this.cache, this.d.storage);
  }

  private pending(): ScoreEntry[] {
    return this.entries.filter((e) => e.final && !e.uploaded);
  }

  private find(id: string): ScoreEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  private now(): Date {
    return this.d.now?.() ?? new Date();
  }

  private persist(): void {
    if (this.entries.length > MAX_ENTRIES) {
      // Oldest uploaded rounds go first (they are safe in Supabase), then the oldest of the rest.
      let excess = this.entries.length - MAX_ENTRIES;
      this.entries = this.entries.filter((e) => !(excess > 0 && e.uploaded && excess-- > 0));
      if (this.entries.length > MAX_ENTRIES) this.entries = this.entries.slice(this.entries.length - MAX_ENTRIES);
    }
    writeJson(SCORES_KEY, this.entries, this.d.storage);
  }

  private emit(): void {
    for (const cb of [...this.listeners]) {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    }
  }
}
