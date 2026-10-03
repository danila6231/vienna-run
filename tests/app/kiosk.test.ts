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
  it('lets people select and paste inside text fields only', () => {
    const field = document.createElement('input');
    document.body.append(field);
    const inField = new Event('selectstart', { bubbles: true, cancelable: true });
    field.dispatchEvent(inField);
    expect(inField.defaultPrevented).toBe(false);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    field.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
    const outside = new Event('selectstart', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(outside);
    expect(outside.defaultPrevented).toBe(true);
    field.remove();
  });
});
