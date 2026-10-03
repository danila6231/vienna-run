// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultsScreen } from '../../src/ui/results';

const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('ResultsScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the score and nothing about gifts', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show(105, () => undefined);
    expect(s.root.querySelector('.r-score')?.textContent).toBe('105');
    expect((s.root.textContent ?? '').toLowerCase()).not.toMatch(/prize|gift|treat/);
    expect(s.root.querySelector('.ladder, .r-tier, .r-gift')).toBeNull();
  });

  it('needs a full one-second hold; a tap or a short press does nothing', () => {
    const s = new ResultsScreen(document.body, 1000);
    const done = vi.fn();
    s.show(50, done);
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
