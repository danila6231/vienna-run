// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { installKiosk } from '../../src/app/kiosk';

describe('installKiosk', () => {
  beforeAll(() => installKiosk(document, { hideCursor: true }));

  it('blocks the long-press context menu', () => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
  it('blocks ctrl+wheel and ctrl+plus zoom but not plain scrolling', () => {
    const zoom = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true });
    document.body.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(true);
    const plain = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    const key = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
  });
  it('hides the cursor', () => {
    expect(document.body.classList.contains('hide-cursor')).toBe(true);
  });
});
