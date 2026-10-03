// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CONFIG } from '../../src/config';
import { attachInput } from '../../src/input/touch';

function pointer(target: EventTarget, type: string, x: number, opts: { primary?: boolean; id?: number } = {}) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    clientX: { value: x }, clientY: { value: 300 },
    isPrimary: { value: opts.primary ?? true }, pointerId: { value: opts.id ?? 1 },
  });
  target.dispatchEvent(e);
}

describe('attachInput', () => {
  let surface: HTMLDivElement;
  let onLane: Mock<(dir: -1 | 1) => void>;
  let onPress: Mock<() => void>;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    surface = document.createElement('div');
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    document.body.append(surface);
    onLane = vi.fn<(dir: -1 | 1) => void>();
    onPress = vi.fn<() => void>();
    detach = attachInput(surface, CONFIG.input, { onLane, onPress });
  });
  afterEach(() => {
    detach();
    surface.remove();
    vi.useRealTimers();
  });

  it('moves one lane per tap', () => {
    pointer(surface, 'pointerdown', 800);
    pointer(surface, 'pointerup', 801);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLane).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("counts a tap from the other hand as its own lane change, one lane per touch", () => {
    pointer(surface, 'pointerdown', 200, { id: 1 });
    pointer(surface, 'pointerdown', 800, { primary: false, id: 2 });
    pointer(surface, 'pointerup', 800, { primary: false, id: 2 });
    pointer(surface, 'pointerup', 200, { id: 1 });
    expect(onLane.mock.calls).toEqual([[-1], [1]]);
  });

  it('keeps working while a palm rests on the screen', () => {
    pointer(surface, 'pointerdown', 500, { id: 5 });
    vi.advanceTimersByTime(CONFIG.input.tapFallbackMs + 10);
    pointer(surface, 'pointerdown', 800, { primary: false, id: 6 });
    pointer(surface, 'pointerup', 800, { primary: false, id: 6 });
    expect(onLane).toHaveBeenCalledTimes(2);
    expect(onLane).toHaveBeenLastCalledWith(1);
  });

  it('still moves once when the screen never reports the release', () => {
    pointer(surface, 'pointerdown', 200);
    vi.advanceTimersByTime(CONFIG.input.tapFallbackMs + 10);
    pointer(surface, 'pointerup', 200);
    expect(onLane).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it('follows a slow swipe that is still moving when the fallback fires', () => {
    pointer(surface, 'pointerdown', 200);
    vi.advanceTimersByTime(150);
    pointer(surface, 'pointermove', 320);
    vi.advanceTimersByTime(CONFIG.input.tapFallbackMs);
    pointer(surface, 'pointerup', 400);
    expect(onLane).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('ignores presses on interface buttons', () => {
    const button = document.createElement('button');
    surface.append(button);
    pointer(button, 'pointerdown', 800);
    pointer(button, 'pointerup', 800);
    expect(onPress).not.toHaveBeenCalled();
    expect(onLane).not.toHaveBeenCalled();
  });

  it('maps arrow keys to lanes', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(onLane).toHaveBeenCalledExactlyOnceWith(-1);
  });
});
