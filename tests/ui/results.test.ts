// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { ResultsScreen } from '../../src/ui/results';

const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('ResultsScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the score and nothing about gifts while gifts are switched off', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show({ score: 105, gift: null }, () => undefined);
    expect(s.root.querySelector('.r-score')?.textContent).toBe('105');
    expect((s.root.textContent ?? '').toLowerCase()).not.toMatch(/prize|gift/);
    expect(s.root.querySelector('.ladder, .r-tier, .r-gift')).toBeNull();
  });

  it('shows the prize and the ladder, with the reached tier marked, when gifts are on', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show({ score: 105, gift: { tiers: CONFIG.tiers, index: 2, url: 'gift-2.png' } }, () => undefined);
    expect(s.root.querySelector('.r-tier')?.textContent).toBe(CONFIG.tiers[2].name);
    expect(s.root.querySelector('img.r-gift')?.getAttribute('src')).toBe('gift-2.png');
    expect(s.root.querySelector('.ladder li.on')?.textContent).toContain(CONFIG.tiers[2].name);
    s.show({ score: 10, gift: null }, () => undefined);
    expect(s.root.querySelector('.ladder')).toBeNull();
  });

  it('needs a full one-second hold; a tap or a short press does nothing', () => {
    const s = new ResultsScreen(document.body, 1000);
    const done = vi.fn();
    s.show({ score: 50, gift: null }, done);
    const hold = s.root.querySelector('.r-hold')!;
    press(hold, 'pointerdown');
    vi.advanceTimersByTime(500);
    press(hold, 'pointerup');
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
    press(hold, 'pointerdown');
    vi.advanceTimersByTime(1000);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
