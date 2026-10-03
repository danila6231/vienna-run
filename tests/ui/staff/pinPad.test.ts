// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinPad } from '../../../src/ui/staff/pinPad';

const key = (pad: PinPad, label: string) => {
  const b = [...pad.root.querySelectorAll('button')].find((x) => x.textContent === label);
  if (!b) throw new Error(`no key ${label}`);
  b.click();
};
const enter = (pad: PinPad, pin: string) => { for (const d of pin) key(pad, d); };

function setup() {
  const pad = new PinPad(document.body);
  const req = { check: (pin: string) => pin === '2468', onSuccess: vi.fn(), onCancel: vi.fn() };
  pad.open(req);
  return { pad, req };
}

describe('PinPad', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens settings on the right PIN', () => {
    const { pad, req } = setup();
    enter(pad, '2468');
    expect(req.onSuccess).toHaveBeenCalledTimes(1);
    expect(pad.isOpen).toBe(false);
  });
  it('clears a wrong PIN and gives up after three tries', () => {
    const { pad, req } = setup();
    enter(pad, '1111');
    expect(pad.isOpen).toBe(true);
    expect(pad.root.querySelectorAll('.pin-dots i.on')).toHaveLength(0);
    enter(pad, '2222');
    enter(pad, '3333');
    expect(req.onCancel).toHaveBeenCalledTimes(1);
    expect(req.onSuccess).not.toHaveBeenCalled();
    expect(pad.isOpen).toBe(false);
  });
  it('closes by itself after 20 seconds without input', () => {
    const { pad, req } = setup();
    key(pad, '2');
    vi.advanceTimersByTime(19_000);
    expect(pad.isOpen).toBe(true);
    vi.advanceTimersByTime(1_500);
    expect(req.onCancel).toHaveBeenCalledTimes(1);
    expect(pad.isOpen).toBe(false);
  });
  it('works with a keyboard, including delete and escape', () => {
    const { pad, req } = setup();
    for (const k of ['2', '4', '9', 'Backspace', '6', '8']) window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    expect(req.onSuccess).toHaveBeenCalledTimes(1);
    pad.open(req);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(req.onCancel).toHaveBeenCalledTimes(1);
  });
});
