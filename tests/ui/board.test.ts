// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { I18n } from '../../src/i18n/i18n';
import type { BoardRow, Range, SyncStatus } from '../../src/scores/types';
import { AttractScreen } from '../../src/ui/attract';
import { boardList } from '../../src/ui/board';
import { BoardModal, type BoardSource } from '../../src/ui/boardModal';

const icons = { sacher: 'a', kipferl: 'b', melange: 'c', mozart: 'd', krampus: 'e', bomb: 'f' };
const rows: BoardRow[] = [
  { id: 'a', at: '2026-10-03T08:00:00Z', name: 'Anna', score: 150 },
  { id: 'b', at: '2026-10-03T09:00:00Z', name: '<b>Bo</b>', score: 90 },
];

function source(over: Partial<BoardSource> = {}) {
  const listeners: (() => void)[] = [];
  const top = vi.fn((range: Range) => (range === 'today' ? rows.slice(0, 1) : rows));
  const s: BoardSource = {
    available: true,
    top,
    status: (): SyncStatus => ({ mode: 'online', pending: 0, lastSyncAt: null }),
    onChange: (cb: () => void) => { listeners.push(cb); return () => undefined; },
    ...over,
  };
  return { s, top, changed: () => listeners.forEach((cb) => cb()) };
}

describe('boardList', () => {
  it('lists place, name and score, as plain text', () => {
    const list = boardList(rows, new I18n('en'), 'b');
    const items = [...list.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual(['1Anna150', '2<b>Bo</b>90']);
    expect(list.querySelector('b b')).toBeNull();
    expect(items[1].classList.contains('me')).toBe(true);
  });
  it('invites the first player when empty', () => {
    expect(boardList([], new I18n()).textContent).toBe('Hãy là người đầu tiên!');
  });
});

describe('start screen leaderboard', () => {
  it("shows today's top 10 beside the title card, with a button for the full board", () => {
    const open = vi.fn();
    const s = new AttractScreen(document.body, new I18n('en'), icons, null, open);
    s.configure(CONFIG, { showGifts: false, leaderboard: true });
    s.setBoard({ rows, state: 'ok' });
    expect(s.root.classList.contains('with-board')).toBe(true);
    expect(s.root.querySelector('.board-panel')?.textContent).toContain('Anna');
    const button = s.root.querySelector<HTMLButtonElement>('.board-open')!;
    expect(button.tagName).toBe('BUTTON');
    button.click();
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('hides the panel and centres the card when the leaderboard is off', () => {
    const s = new AttractScreen(document.body, new I18n('en'), icons, null);
    s.setBoard(null);
    expect(s.root.classList.contains('with-board')).toBe(false);
    expect(s.root.querySelector<HTMLElement>('.board-panel')!.hidden).toBe(true);
  });
  it('says when the board is offline or unavailable', () => {
    const s = new AttractScreen(document.body, new I18n('vi'), icons, null);
    s.setBoard({ rows, state: 'offline' });
    expect(s.root.textContent).toContain('Đang ngoại tuyến');
    s.setBoard({ rows: [], state: 'unavailable' });
    expect(s.root.textContent).toContain('Bảng xếp hạng tạm thời không khả dụng');
  });
});

describe('BoardModal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens on today, switches to all time, and closes', () => {
    const { s } = source();
    const m = new BoardModal(document.body, new I18n('en'), s);
    m.open();
    expect(m.isOpen).toBe(true);
    expect(m.root.querySelectorAll('.board-list li')).toHaveLength(1);
    expect(m.root.closest('[data-ui]')).not.toBeNull();
    [...m.root.querySelectorAll('button')].find((b) => b.textContent === 'All time')!.click();
    expect(m.root.querySelectorAll('.board-list li')).toHaveLength(2);
    m.root.querySelector<HTMLButtonElement>('.board-close')!.click();
    expect(m.isOpen).toBe(false);
  });
  it('closes by itself so the booth never gets stuck on it', () => {
    const m = new BoardModal(document.body, new I18n('en'), source().s);
    m.open();
    vi.advanceTimersByTime(BoardModal.IDLE_MS + 10);
    expect(m.isOpen).toBe(false);
  });
  it('highlights the player and updates when new scores arrive', () => {
    const { s, top, changed } = source();
    const m = new BoardModal(document.body, new I18n('en'), s);
    m.open('all', 'b');
    expect(m.root.querySelector('li.me')?.textContent).toContain('Bo');
    top.mockReturnValue([]);
    changed();
    expect(m.root.textContent).toContain('Be the first!');
  });
  it('explains when the board is unavailable', () => {
    const m = new BoardModal(document.body, new I18n('en'), source({ available: false }).s);
    m.open();
    expect(m.root.textContent).toContain('The leaderboard is unavailable right now');
  });
});
