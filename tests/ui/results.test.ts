// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/config';
import { ResultsScreen } from '../../src/ui/results';

const press = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('ResultsScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('highlights the tier the player reached', () => {
    const s = new ResultsScreen(document.body, 1000);
    s.show(105, CONFIG.tiers, 2, null, () => undefined);
    expect(s.root.textContent).toContain('105');
    expect(s.root.querySelector('.r-tier')?.textContent).toBe(CONFIG.tiers[2].name);
    expect(s.root.querySelector('.ladder li.on')?.textContent).toContain(CONFIG.tiers[2].name);
  });

  it('needs a full one-second hold; a tap or a short press does nothing', () => {
    const s = new ResultsScreen(document.body, 1000);
    const done = vi.fn();
    s.show(50, CONFIG.tiers, 0, null, done);
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
