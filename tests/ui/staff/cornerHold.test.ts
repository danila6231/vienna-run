// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachCornerHold } from '../../../src/ui/staff/cornerHold';

const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe('attachCornerHold', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens only after a full hold', () => {
    const onTrigger = vi.fn();
    const zone = attachCornerHold(document.body, 3000, onTrigger);
    fire(zone, 'pointerdown');
    vi.advanceTimersByTime(2000);
    fire(zone, 'pointerup');
    vi.advanceTimersByTime(5000);
    expect(onTrigger).not.toHaveBeenCalled();
    fire(zone, 'pointerdown');
    vi.advanceTimersByTime(3000);
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
  it('is invisible interface, so a press there never starts a game', () => {
    const zone = attachCornerHold(document.body, 3000, () => undefined);
    expect(zone.dataset.ui).toBe('');
    expect(zone.textContent).toBe('');
  });
});
