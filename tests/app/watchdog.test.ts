// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowReload, installWatchdog, shouldRefresh } from '../../src/app/watchdog';
import { CONFIG } from '../../src/config';

describe('reload guard', () => {
  it('allows up to the limit inside the window, then stops', () => {
    let h: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = allowReload(h, 1000 + i, 5, 120_000);
      expect(r.allowed).toBe(true);
      h = r.history;
    }
    expect(allowReload(h, 2000, 5, 120_000).allowed).toBe(false);
    expect(allowReload(h, 200_000, 5, 120_000).allowed).toBe(true);
  });
  it('asks for a preventive refresh after enough runs or uptime', () => {
    expect(shouldRefresh(24, 1000, CONFIG.watchdog)).toBe(false);
    expect(shouldRefresh(25, 1000, CONFIG.watchdog)).toBe(true);
    expect(shouldRefresh(1, 2 * 3_600_000, CONFIG.watchdog)).toBe(true);
  });
});

describe('installWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('shows a restart card and reloads after an error', () => {
    const reload = vi.fn();
    const w = installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload });
    w.restart('test');
    expect(document.body.textContent).toContain("Let's restart!");
    vi.advanceTimersByTime(1600);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stops reloading after too many restarts and asks for staff', () => {
    sessionStorage.setItem('vienna-run:reloads', JSON.stringify([Date.now(), Date.now(), Date.now(), Date.now(), Date.now()]));
    const reload = vi.fn();
    installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload }).restart('test');
    vi.advanceTimersByTime(5000);
    expect(reload).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('ask the staff');
  });

  it('keeps retrying slowly after too many restarts, so the booth recovers once the problem clears', () => {
    sessionStorage.setItem('vienna-run:reloads', JSON.stringify([Date.now(), Date.now(), Date.now(), Date.now(), Date.now()]));
    const reload = vi.fn();
    installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload }).restart('test');
    vi.advanceTimersByTime(59_000);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('shows the restart card in the booth language', () => {
    const reload = vi.fn();
    const w = installWatchdog({ cfg: CONFIG.watchdog, canvas: document.createElement('canvas'), lastFrameAt: () => performance.now(), reload, text: (k) => (k === 'restart' ? 'Khởi động lại nhé!' : 'Tạm nghỉ') });
    w.restart('test');
    expect(document.body.textContent).toContain('Khởi động lại nhé!');
  });
});
